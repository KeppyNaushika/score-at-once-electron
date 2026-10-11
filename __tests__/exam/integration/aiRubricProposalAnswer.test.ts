/**
 * 問いかけ（AI の項目の案）への答えの下書きと確定（docs/vlm-grading-design.md §3-5・§5-3）。
 *
 * - 答え（下書き）は AI の層の行だけを書き、教員の層（項目・適用・採点）には何も書かない
 * - 確定すると、選択肢なら項目を作り、渡した答案の自分の採点行に当て、答えを確定済みにする
 * - 選び直し（確定済みの案に答え直して確定）は同じ項目の効き方を変える（項目を2つ作らない）
 * - 既存の項目に当たる案は、その項目を当てるだけで値を変えない
 * - 「その他」は確定で前に当てた項目を外す。確定した指示だけを次の往復に添える
 * - 1件ずつ採点の答えは答案ごとの点を持ち、点を書き終えてから確定済みにする
 * - 案の外の問いかけの答え（答案ごと）と、問いかけで決めた点の書き込み
 * - 答えられるのは実行した教員だけ。案に入っていない答案には当てない
 *
 * 実行・試行・案は合成した行（外部へは送らない）。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { recordAiAttemptResponses } from "@/electron-src/lib/prisma/aiAttemptResponse"
import {
  markAiQuestioningCommitted,
  writeAiQuestioningScores,
} from "@/electron-src/lib/prisma/aiQuestioningScore"
import {
  commitAiRubricProposalResponse,
  listAiRubricProposalRunsByCropRegion,
  listTeacherInstructions,
  recordAiRubricProposalDraft,
} from "@/electron-src/lib/prisma/aiRubricProposal"
import { createRubricItem } from "@/electron-src/lib/prisma/rubricItem"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
let otherUserId: string

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: 3,
    includeScores: false,
  })
  await testPrisma.cropRegion.update({
    where: { id: cropRegionId() },
    data: { points: 5, scoringMethod: "deduction" },
  })
  const otherUser = await testPrisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: `other_${crypto.randomUUID()}`,
      name: "別の採点者",
    },
  })
  otherUserId = otherUser.id
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const cropRegionId = () => fixture.cropRegions[0].id
const ownerId = () => fixture.user.id
const examStudentId = (index: number) => fixture.examStudents[index].id

/**
 * 1段目と2段目の実行と、受験者 0・1 を答案に持つ案1つ（減点の推奨と、誤答の選択肢）を作る。
 * matchedRubricItemId を渡せば既存の項目に当たる案にする
 */
async function createProposal(matchedRubricItemId: string | null = null) {
  const prompt = await testPrisma.aiPrompt.create({
    data: { cropRegionId: cropRegionId(), createdByUserId: ownerId() },
  })
  const runBase = {
    userId: ownerId(),
    promptId: prompt.id,
    templateVersion: "test",
    provider: "anthropic",
    model: "claude-test",
    effort: "low",
    mode: "realtime",
    status: "ended",
    submittedClientId: "client-test",
  }
  const gradeRun = await testPrisma.aiGradingRun.create({
    data: {
      ...runBase,
      purpose: "grade",
      attempts: {
        create: [0, 1, 2].map((index) => ({
          examStudentId: examStudentId(index),
          state: "succeeded",
          status: "partial",
        })),
      },
    },
    include: { attempts: true },
  })
  const attemptOf = (index: number) => {
    const attempt = gradeRun.attempts.find(
      (candidate) => candidate.examStudentId === examStudentId(index)
    )
    if (!attempt) throw new Error("試行がありません")
    return attempt
  }
  const groupRun = await testPrisma.aiGradingRun.create({
    data: { ...runBase, purpose: "group" },
  })
  return testPrisma.aiRubricProposal.create({
    data: {
      runId: groupRun.id,
      label: "単位が無い",
      description: "数値は正しいが単位が無い",
      adviceDraft: "単位を書こう。",
      matchedRubricItemId,
      options: {
        create: [
          {
            effectKind: "adjust",
            pointDelta: -1,
            rationale: "単位の分を引く",
            recommended: true,
            sortOrder: 0,
          },
          {
            effectKind: "set",
            setStatus: "incorrect",
            rationale: "誤答にする",
            sortOrder: 1,
          },
        ],
      },
      members: {
        create: [
          { attemptId: attemptOf(0).id },
          { attemptId: attemptOf(1).id },
        ],
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  })
}

const ownRowsWithApplications = () =>
  testPrisma.questionScore.findMany({
    where: { cropRegionId: cropRegionId(), userId: ownerId() },
    include: { rubricApplications: true },
  })

/** 答える（下書き）→ 確定する */
async function draftAndCommit(
  input: {
    proposalId: string
    optionId: string | null
    freeText: string
    examStudentIds: string[]
  },
  actorUserId = ownerId()
) {
  const draft = await recordAiRubricProposalDraft(
    {
      proposalId: input.proposalId,
      optionId: input.optionId,
      freeText: input.freeText,
      manualScores: [],
    },
    actorUserId
  )
  return commitAiRubricProposalResponse(
    { responseId: draft.id, examStudentIds: input.examStudentIds },
    actorUserId
  )
}

/** 案の答案の試行の id（受験者の番号から） */
async function attemptIdOf(proposalId: string, index: number) {
  const member = await testPrisma.aiRubricProposalMember.findFirstOrThrow({
    where: { proposalId, attempt: { examStudentId: examStudentId(index) } },
  })
  return member.attemptId
}

describe("下書き", () => {
  it("答えても教員の層には何も書かず、確定するまで下書きのまま", async () => {
    const proposal = await createProposal()
    const draft = await recordAiRubricProposalDraft(
      {
        proposalId: proposal.id,
        optionId: proposal.options[0].id,
        freeText: "",
        manualScores: [],
      },
      ownerId()
    )
    expect(draft).toMatchObject({ committedAt: null, resultRubricItemId: null })
    expect(await testPrisma.rubricItem.count()).toBe(0)
    expect(await testPrisma.rubricApplication.count()).toBe(0)
    expect(await testPrisma.questionScore.count()).toBe(0)

    const [proposalRun] = await listAiRubricProposalRunsByCropRegion(
      cropRegionId(),
      ownerId()
    )
    expect(proposalRun.rubricProposals[0].responses).toHaveLength(1)
    expect(proposalRun.rubricProposals[0].responses[0].committedAt).toBeNull()
  })

  it("答えの種類を混ぜた答えと、配点を超える点は拒む", async () => {
    const proposal = await createProposal()
    const attemptId = await attemptIdOf(proposal.id, 0)
    await expect(
      recordAiRubricProposalDraft(
        {
          proposalId: proposal.id,
          optionId: proposal.options[0].id,
          freeText: "指示",
          manualScores: [],
        },
        ownerId()
      )
    ).rejects.toThrow("指示や点は付けません")
    await expect(
      recordAiRubricProposalDraft(
        {
          proposalId: proposal.id,
          optionId: null,
          freeText: "",
          manualScores: [{ attemptId, status: "partial", partialScore: 9 }],
        },
        ownerId()
      )
    ).rejects.toThrow("配点まで")
    expect(await testPrisma.aiRubricProposalResponse.count()).toBe(0)
  })
})

describe("選択肢を選んで確定する", () => {
  it("項目を作って答えを確定済みにし、渡した答案の自分の採点行に当てる", async () => {
    const proposal = await createProposal()
    const [recommended] = proposal.options

    const { response, touchedRows } = await draftAndCommit({
      proposalId: proposal.id,
      optionId: recommended.id,
      freeText: "",
      examStudentIds: [examStudentId(0), examStudentId(1)],
    })

    const items = await testPrisma.rubricItem.findMany({
      where: { cropRegionId: cropRegionId() },
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: "単位が無い",
      adviceText: "単位を書こう。",
      effectKind: "adjust",
      createdByUserId: ownerId(),
    })
    expect(items[0].pointDelta?.toNumber()).toBe(-1)
    expect(response).toMatchObject({
      optionId: recommended.id,
      resultRubricItemId: items[0].id,
      freeText: "",
    })
    expect(response.committedAt).not.toBeNull()
    expect(touchedRows.map((row) => row.examStudentId).sort()).toEqual(
      [examStudentId(0), examStudentId(1)].sort()
    )
    touchedRows.forEach((row) => {
      expect(row.userId).toBe(ownerId())
      expect(row.rubricApplications.map((app) => app.rubricItemId)).toEqual([
        items[0].id,
      ])
    })
    // AI の層からは点を書かない（点の計算と書き込みは renderer が続けて行う）
    expect(touchedRows.every((row) => row.status === "unscored")).toBe(true)

    // 確定済みの答えをもう一度確定しても、何もしない
    const again = await commitAiRubricProposalResponse(
      { responseId: response.id, examStudentIds: [examStudentId(0)] },
      ownerId()
    )
    expect(again.touchedRows).toEqual([])
    expect(await testPrisma.rubricItem.count()).toBe(1)
  })

  it("選び直しは同じ項目の効き方を変え、項目を2つ作らない", async () => {
    const proposal = await createProposal()
    const [recommended, incorrect] = proposal.options
    const input = {
      proposalId: proposal.id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
    }
    await draftAndCommit({ ...input, optionId: recommended.id })
    const { response } = await draftAndCommit({
      ...input,
      optionId: incorrect.id,
    })

    const items = await testPrisma.rubricItem.findMany({
      where: { cropRegionId: cropRegionId() },
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      effectKind: "set",
      setStatus: "incorrect",
      pointDelta: null,
    })
    expect(response.resultRubricItemId).toBe(items[0].id)
    expect(
      await testPrisma.aiRubricProposalResponse.count({
        where: { proposalId: proposal.id },
      })
    ).toBe(2)
  })

  it("既存の項目に当たる案は、その項目を当てるだけで値を変えない", async () => {
    const existing = await createRubricItem(
      {
        cropRegionId: cropRegionId(),
        label: "単位なし（既存）",
        adviceText: "",
        sortOrder: 0,
        effectKind: "adjust",
        pointDelta: -2,
        setStatus: null,
        setScore: null,
      },
      ownerId()
    )
    const proposal = await createProposal(existing.id)

    const { response, touchedRows } = await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(1)],
    })

    expect(response.resultRubricItemId).toBe(existing.id)
    const items = await testPrisma.rubricItem.findMany({
      where: { cropRegionId: cropRegionId() },
    })
    expect(items).toHaveLength(1)
    expect(items[0].pointDelta?.toNumber()).toBe(-2)
    expect(touchedRows[0].rubricApplications[0].rubricItemId).toBe(existing.id)
  })
})

describe("「その他」", () => {
  it("確定で前に当てた項目を外し、確定した指示だけを次の往復に添える", async () => {
    const proposal = await createProposal()
    await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0), examStudentId(1)],
    })

    // 下書きのうちは添えない
    const draft = await recordAiRubricProposalDraft(
      {
        proposalId: proposal.id,
        optionId: null,
        freeText: " 単位が無くても cm が明らかなら減点しない ",
        manualScores: [],
      },
      ownerId()
    )
    expect(await listTeacherInstructions(cropRegionId(), ownerId())).toEqual([])

    const { response, touchedRows } = await commitAiRubricProposalResponse(
      {
        responseId: draft.id,
        examStudentIds: [examStudentId(0), examStudentId(1)],
      },
      ownerId()
    )
    expect(response).toMatchObject({
      optionId: null,
      resultRubricItemId: null,
      freeText: "単位が無くても cm が明らかなら減点しない",
    })
    expect(touchedRows).toHaveLength(2)
    const rows = await ownRowsWithApplications()
    expect(rows.every((row) => row.rubricApplications.length === 0)).toBe(true)

    expect(await listTeacherInstructions(cropRegionId(), ownerId())).toEqual([
      "単位が無くても cm が明らかなら減点しない",
    ])
    // 別の教員の往復には添えない
    expect(await listTeacherInstructions(cropRegionId(), otherUserId)).toEqual(
      []
    )

    // 選択肢で答え直して確定すると、その指示は効かなくなる。前に作った項目を使い回す
    await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [],
    })
    expect(await listTeacherInstructions(cropRegionId(), ownerId())).toEqual([])
    expect(await testPrisma.rubricItem.count()).toBe(1)
  })
})

describe("1件ずつ自分で採点する", () => {
  it("答案ごとの点を答えに持ち、確定では前の項目を外すだけで確定済みにはしない", async () => {
    const proposal = await createProposal()
    await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0), examStudentId(1)],
    })
    const attemptId = await attemptIdOf(proposal.id, 0)
    const draft = await recordAiRubricProposalDraft(
      {
        proposalId: proposal.id,
        optionId: null,
        freeText: "",
        manualScores: [{ attemptId, status: "partial", partialScore: 2.5 }],
      },
      ownerId()
    )
    expect(draft.scores).toHaveLength(1)
    expect(draft.scores[0].partialScore?.toNumber()).toBe(2.5)

    const { response, touchedRows } = await commitAiRubricProposalResponse(
      {
        responseId: draft.id,
        examStudentIds: [examStudentId(0), examStudentId(1)],
      },
      ownerId()
    )
    expect(response.committedAt).toBeNull()
    expect(touchedRows).toHaveLength(2)
    expect(await listTeacherInstructions(cropRegionId(), ownerId())).toEqual([])

    // 点を書いてから確定済みにする（採点キーと同じ書き方）
    await writeAiQuestioningScores(
      {
        cropRegionId: cropRegionId(),
        scores: [
          {
            examStudentId: examStudentId(0),
            status: "partial",
            partialScore: 2.5,
          },
        ],
      },
      ownerId()
    )
    await markAiQuestioningCommitted(
      { proposalResponseIds: [draft.id], attemptResponseIds: [] },
      ownerId()
    )
    const written = await testPrisma.questionScore.findFirstOrThrow({
      where: {
        cropRegionId: cropRegionId(),
        userId: ownerId(),
        examStudentId: examStudentId(0),
      },
    })
    expect(written.status).toBe("partial")
    expect(written.partialScore?.toNumber()).toBe(2.5)
    const marked = await testPrisma.aiRubricProposalResponse.findUniqueOrThrow({
      where: { id: draft.id },
    })
    expect(marked.committedAt).not.toBeNull()
  })
})

describe("案の外の問いかけ（答案ごとの答え）", () => {
  it("答案ごとに下書きを書き、教員の採点は変えない。他の教員の答えとしては書けない", async () => {
    const proposal = await createProposal()
    const attemptId = await attemptIdOf(proposal.id, 0)
    const [written] = await recordAiAttemptResponses(
      {
        responses: [
          {
            attemptId,
            choice: "rescore",
            status: "incorrect",
            partialScore: null,
          },
        ],
      },
      ownerId()
    )
    expect(written).toMatchObject({ choice: "rescore", committedAt: null })
    expect(await testPrisma.questionScore.count()).toBe(0)

    await expect(
      recordAiAttemptResponses(
        {
          responses: [
            {
              attemptId,
              choice: "keep",
              status: "correct",
              partialScore: null,
            },
          ],
        },
        ownerId()
      )
    ).rejects.toThrow("点を持ちません")
    await expect(
      recordAiAttemptResponses(
        {
          responses: [
            { attemptId, choice: "keep", status: null, partialScore: null },
          ],
        },
        otherUserId
      )
    ).rejects.toThrow("実行した教員だけ")

    // 他の教員は確定済みにできない
    await markAiQuestioningCommitted(
      { proposalResponseIds: [], attemptResponseIds: [written.id] },
      otherUserId
    )
    expect(
      (
        await testPrisma.aiAttemptResponse.findUniqueOrThrow({
          where: { id: written.id },
        })
      ).committedAt
    ).toBeNull()
  })
})

describe("答えられないもの", () => {
  it("実行した教員でなければ拒み、案に入っていない答案や別の案の選択肢も拒む", async () => {
    const proposal = await createProposal()
    const otherProposal = await createProposal()
    const base = {
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      manualScores: [],
    }
    await expect(
      recordAiRubricProposalDraft(base, otherUserId)
    ).rejects.toThrow("実行した教員だけ")
    await expect(
      recordAiRubricProposalDraft(
        { ...base, optionId: otherProposal.options[0].id },
        ownerId()
      )
    ).rejects.toThrow("この案のものではありません")
    const draft = await recordAiRubricProposalDraft(base, ownerId())
    await expect(
      commitAiRubricProposalResponse(
        { responseId: draft.id, examStudentIds: [examStudentId(2)] },
        ownerId()
      )
    ).rejects.toThrow("案に入っていない答案")
    await expect(
      commitAiRubricProposalResponse(
        { responseId: draft.id, examStudentIds: [examStudentId(0)] },
        otherUserId
      )
    ).rejects.toThrow("実行した教員だけ")
    expect(await testPrisma.rubricItem.count()).toBe(0)
  })
})
