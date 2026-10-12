/**
 * 問いかけ（AI の項目の案）への答えの下書きと確定（docs/vlm-grading-design.md §3-5・§5-3）。
 *
 * - 答え（下書き）は AI の層の行だけを書き、教員の層（項目・適用・採点）には何も書かない
 * - 確定すると、選択肢なら項目を作り、渡した答案の自分の採点行に当て、答えを確定済みにする
 * - 選び直し（確定済みの案に答え直して確定）は同じ項目の効き方を変える（項目を2つ作らない）
 * - 既存の項目に当たる案は、その項目を当てるだけで値を変えない
 * - 「その他」は確定で前に当てた項目を外す。確定した指示だけを次の往復に添える
 * - 直した助言は案ごと・教員ごとの行に持ち（1打鍵ごとに同じ行を書き換える）、確定で項目の助言にする
 *   （新しい項目・既存の項目に当たる案・選び直し）。最後の確定より前に直した文は効かない
 * - 「その他」の欄の文も案ごと・教員ごとの行に持ち（1打鍵ごとに同じ行を書き換える）、捨てるときは自分の行だけを消す
 * - 自分で採点の答えは答案ごとの点を持ち、点を書き終えてから確定済みにする
 * - 案の外の問いかけの答え（答案ごと）と、問いかけで決めた点の書き込み
 * - 答えられるのは実行した教員だけ。案に入っていない答案には当てない
 * - 類型方式の設問（§4-8-6）: 案の選択肢の類型を書き、確定で類型にする項目を作る。教員が決めた類型は
 *   設問の類型表の類型だけを受け、類型の書き込みで書く。正答・誤答・部分点は拒む
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
  recordAiRubricProposals,
  setAiRubricProposalAdviceDraft,
} from "@/electron-src/lib/prisma/aiRubricProposal"
import {
  discardAiRubricProposalInstructionDrafts,
  setAiRubricProposalInstructionDraft,
} from "@/electron-src/lib/prisma/aiRubricProposalInstructionDraft"
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
    adviceText?: string | null
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
  if (input.adviceText !== undefined && input.adviceText !== null) {
    await setAiRubricProposalAdviceDraft(
      { proposalId: input.proposalId, adviceText: input.adviceText },
      actorUserId
    )
  }
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
          manualScores: [
            {
              attemptId,
              status: "partial",
              partialScore: 9,
              scaleLevelId: null,
            },
          ],
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
        setScaleLevelId: null,
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

describe("「その他」の欄の文", () => {
  it("案ごと・教員ごとの1行をその場で書き換え、答えの行は書かない。実行した教員だけが書ける", async () => {
    const proposal = await createProposal()
    await setAiRubricProposalInstructionDraft(
      { proposalId: proposal.id, instructionText: "途" },
      ownerId()
    )
    const updated = await setAiRubricProposalInstructionDraft(
      { proposalId: proposal.id, instructionText: "途中式があれば部分点 " },
      ownerId()
    )
    expect(updated.instructionText).toBe("途中式があれば部分点 ")
    expect(await testPrisma.aiRubricProposalInstructionDraft.count()).toBe(1)
    expect(await testPrisma.aiRubricProposalResponse.count()).toBe(0)
    await expect(
      setAiRubricProposalInstructionDraft(
        { proposalId: proposal.id, instructionText: "他人" },
        otherUserId
      )
    ).rejects.toThrow("AI採点を実行した教員だけ")

    // 一覧の案に、自分の書いている文が同梱される
    const [proposalRun] = await listAiRubricProposalRunsByCropRegion(
      cropRegionId(),
      ownerId()
    )
    expect(
      proposalRun.rubricProposals[0].instructionDrafts.map(
        (instructionDraft) => instructionDraft.instructionText
      )
    ).toEqual(["途中式があれば部分点 "])
  })

  it("捨てると、渡した案の自分の行だけを消す", async () => {
    const proposal = await createProposal()
    await setAiRubricProposalInstructionDraft(
      { proposalId: proposal.id, instructionText: "消える指示" },
      ownerId()
    )
    await testPrisma.aiRubricProposalInstructionDraft.create({
      data: {
        proposalId: proposal.id,
        userId: otherUserId,
        instructionText: "他人の行",
      },
    })
    const discarded = await discardAiRubricProposalInstructionDrafts(
      { proposalIds: [proposal.id] },
      ownerId()
    )
    expect(discarded.count).toBe(1)
    const remaining =
      await testPrisma.aiRubricProposalInstructionDraft.findMany()
    expect(remaining.map((row) => row.instructionText)).toEqual(["他人の行"])
    expect(
      await discardAiRubricProposalInstructionDrafts(
        { proposalIds: [] },
        ownerId()
      )
    ).toEqual({ count: 0 })
  })
})

describe("直した助言", () => {
  it("案ごと・教員ごとの1行をその場で書き換え、項目には確定まで書かない。実行した教員だけが書ける", async () => {
    const proposal = await createProposal()
    await setAiRubricProposalAdviceDraft(
      { proposalId: proposal.id, adviceText: "単" },
      ownerId()
    )
    const updated = await setAiRubricProposalAdviceDraft(
      { proposalId: proposal.id, adviceText: " 単位まで書こう。 " },
      ownerId()
    )
    expect(updated.adviceText).toBe(" 単位まで書こう。 ")
    expect(await testPrisma.aiRubricProposalAdviceDraft.count()).toBe(1)
    expect(await testPrisma.aiRubricProposalResponse.count()).toBe(0)
    expect(await testPrisma.rubricItem.count()).toBe(0)
    await expect(
      setAiRubricProposalAdviceDraft(
        { proposalId: proposal.id, adviceText: "他人" },
        otherUserId
      )
    ).rejects.toThrow("AI採点を実行した教員だけ")

    // 一覧の案に、自分の直した文が同梱される
    const [proposalRun] = await listAiRubricProposalRunsByCropRegion(
      cropRegionId(),
      ownerId()
    )
    expect(
      proposalRun.rubricProposals[0].adviceDrafts.map(
        (adviceDraft) => adviceDraft.adviceText
      )
    ).toEqual([" 単位まで書こう。 "])
  })

  it("答える前に直した文も、確定で項目の助言になる（前後の空白は落とす）", async () => {
    const proposal = await createProposal()
    await setAiRubricProposalAdviceDraft(
      { proposalId: proposal.id, adviceText: " 単位まで書こう。 " },
      ownerId()
    )
    await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
    })
    const [item] = await testPrisma.rubricItem.findMany()
    expect(item.adviceText).toBe("単位まで書こう。")
  })

  it("最後の確定より前に直した文は効かず、確定のあとで直した項目の助言を上書きしない", async () => {
    const proposal = await createProposal()
    await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
      adviceText: "古い文。",
    })
    const [item] = await testPrisma.rubricItem.findMany()
    // 確定のあとに、項目の助言をほかの画面で直した
    await testPrisma.rubricItem.update({
      where: { id: item.id },
      data: { adviceText: "項目で直した文。" },
    })
    await testPrisma.aiRubricProposalAdviceDraft.updateMany({
      data: { updatedAt: new Date(Date.now() - 60_000) },
    })
    const reselected = await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[1].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
    })
    expect(reselected.adviceChangedRubricItemId).toBeNull()
    const after = await testPrisma.rubricItem.findUniqueOrThrow({
      where: { id: item.id },
    })
    expect(after.adviceText).toBe("項目で直した文。")
  })

  it("新しく作る項目の助言は、直した文（空なら助言なし）。直していなければ AI の文案", async () => {
    const editedProposal = await createProposal()
    await draftAndCommit({
      proposalId: editedProposal.id,
      optionId: editedProposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
      adviceText: "cm を付けよう。",
    })
    const emptiedProposal = await createProposal()
    await draftAndCommit({
      proposalId: emptiedProposal.id,
      optionId: emptiedProposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(1)],
      adviceText: "",
    })
    const untouchedProposal = await createProposal()
    await draftAndCommit({
      proposalId: untouchedProposal.id,
      optionId: untouchedProposal.options[0].id,
      freeText: "",
      examStudentIds: [],
    })
    const items = await testPrisma.rubricItem.findMany({
      orderBy: { sortOrder: "asc" },
    })
    expect(items.map((item) => item.adviceText)).toEqual([
      "cm を付けよう。",
      "",
      "単位を書こう。",
    ])
  })

  it("既存の項目に当たる案は、直したときだけ項目の助言を書き換えて、その項目を返す", async () => {
    const existing = await createRubricItem(
      {
        cropRegionId: cropRegionId(),
        label: "単位の欠け",
        adviceText: "単位に気をつけよう。",
        effectKind: "adjust",
        pointDelta: -1,
        setStatus: null,
        setScore: null,
        setScaleLevelId: null,
        sortOrder: 0,
      },
      ownerId()
    )
    const proposal = await createProposal(existing.id)
    const untouched = await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
    })
    expect(untouched.adviceChangedRubricItemId).toBeNull()
    const same = await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
      adviceText: "単位に気をつけよう。",
    })
    expect(same.adviceChangedRubricItemId).toBeNull()

    const edited = await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
      adviceText: "単位を忘れずに。",
    })
    expect(edited.adviceChangedRubricItemId).toBe(existing.id)
    const item = await testPrisma.rubricItem.findUniqueOrThrow({
      where: { id: existing.id },
    })
    expect(item).toMatchObject({
      adviceText: "単位を忘れずに。",
      label: "単位の欠け",
    })
    expect(item.pointDelta?.toNumber()).toBe(-1)

    // 一覧には当たる項目と、答えで結び付けた項目が同梱される（助言の欄の文を画面が選ぶ）
    const [proposalRun] = await listAiRubricProposalRunsByCropRegion(
      cropRegionId(),
      ownerId()
    )
    const [listed] = proposalRun.rubricProposals
    expect(listed.matchedRubricItem?.adviceText).toBe("単位を忘れずに。")
    expect(listed.responses.at(-1)?.resultRubricItem?.id).toBe(existing.id)
  })

  it("選び直しで使い回す項目も、直した助言にする", async () => {
    const proposal = await createProposal()
    await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[0].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
    })
    const reselected = await draftAndCommit({
      proposalId: proposal.id,
      optionId: proposal.options[1].id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
      adviceText: "答えを見直そう。",
    })
    const items = await testPrisma.rubricItem.findMany()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      adviceText: "答えを見直そう。",
      effectKind: "set",
    })
    expect(reselected.adviceChangedRubricItemId).toBe(items[0].id)
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

describe("自分で採点する", () => {
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
        manualScores: [
          {
            attemptId,
            status: "partial",
            partialScore: 2.5,
            scaleLevelId: null,
          },
        ],
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
            scaleLevelId: null,
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
            scaleLevelId: null,
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
              scaleLevelId: null,
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
            {
              attemptId,
              choice: "keep",
              status: null,
              partialScore: null,
              scaleLevelId: null,
            },
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

describe("類型方式の設問", () => {
  /** 設問を類型方式にし、使う類型表（A・B）と、使わない類型表（X）を作る */
  async function setUpScaleQuestion() {
    const createScale = (name: string, labels: string[]) =>
      testPrisma.scoreScale.create({
        data: {
          examId: fixture.exam.id,
          name,
          levels: {
            create: labels.map((label, sortOrder) => ({
              label,
              description: `${label} の説明`,
              score: 5 - sortOrder * 2,
              sortOrder,
            })),
          },
        },
        include: { levels: { orderBy: { sortOrder: "asc" } } },
      })
    const scale = await createScale("記述の類型", ["A", "B"])
    const otherScale = await createScale("別の類型表", ["X"])
    await testPrisma.cropRegion.update({
      where: { id: cropRegionId() },
      data: { scoringMethod: "scale", scoreScaleId: scale.id },
    })
    return {
      levelA: scale.levels[0],
      levelB: scale.levels[1],
      otherLevel: otherScale.levels[0],
    }
  }

  it("2段目の案の選択肢の類型を書き、確定で類型にする項目を作る", async () => {
    const { levelA, levelB } = await setUpScaleQuestion()
    const seeded = await createProposal()
    const attemptId = await attemptIdOf(seeded.id, 0)
    await recordAiRubricProposals(
      seeded.runId,
      [
        {
          label: "根拠が1つだけ",
          description: "根拠を1つ挙げているが、2つ目が無い。",
          adviceDraft: "もう1つの理由も書き足そう。",
          matchedRubricItemId: null,
          memberAnswerKeys: ["A1"],
          options: [
            {
              effectKind: "set",
              pointDelta: null,
              setStatus: "evaluated",
              setScore: null,
              setScaleLevelId: levelB.id,
              rationale: "根拠が1つ",
              recommended: true,
            },
            {
              effectKind: "set",
              pointDelta: null,
              setStatus: "evaluated",
              setScore: null,
              setScaleLevelId: levelA.id,
              rationale: "十分",
              recommended: false,
            },
          ],
        },
      ],
      new Map([["A1", attemptId]])
    )
    const proposal = await testPrisma.aiRubricProposal.findFirstOrThrow({
      where: { runId: seeded.runId, label: "根拠が1つだけ" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    })
    expect(
      proposal.options.map((option) => [
        option.setStatus,
        option.setScaleLevelId,
        option.setScore,
      ])
    ).toEqual([
      ["evaluated", levelB.id, null],
      ["evaluated", levelA.id, null],
    ])

    const draft = await recordAiRubricProposalDraft(
      {
        proposalId: proposal.id,
        optionId: proposal.options[0].id,
        freeText: "",
        manualScores: [],
      },
      ownerId()
    )
    const { response } = await commitAiRubricProposalResponse(
      { responseId: draft.id, examStudentIds: [examStudentId(0)] },
      ownerId()
    )
    expect(response.committedAt).not.toBeNull()
    const createdItem = await testPrisma.rubricItem.findUniqueOrThrow({
      where: { id: response.resultRubricItemId ?? "" },
    })
    expect(createdItem).toMatchObject({
      effectKind: "set",
      setStatus: "evaluated",
      setScore: null,
      setScaleLevelId: levelB.id,
    })
  })

  it("自分で採点した類型を答えに持ち、設問の類型表の類型だけを受ける", async () => {
    const { levelA, otherLevel } = await setUpScaleQuestion()
    const proposal = await createProposal()
    const attemptId = await attemptIdOf(proposal.id, 0)
    const draftWith = (score: {
      status: "evaluated" | "partial" | "pending"
      partialScore: number | null
      scaleLevelId: string | null
    }) =>
      recordAiRubricProposalDraft(
        {
          proposalId: proposal.id,
          optionId: null,
          freeText: "",
          manualScores: [{ attemptId, ...score }],
        },
        ownerId()
      )

    const draft = await draftWith({
      status: "evaluated",
      partialScore: null,
      scaleLevelId: levelA.id,
    })
    expect(draft.scores[0]).toMatchObject({
      status: "evaluated",
      scaleLevelId: levelA.id,
      partialScore: null,
    })

    await expect(
      draftWith({
        status: "evaluated",
        partialScore: null,
        scaleLevelId: otherLevel.id,
      })
    ).rejects.toThrow("この設問の類型表の類型ではありません")
    await expect(
      draftWith({ status: "evaluated", partialScore: null, scaleLevelId: null })
    ).rejects.toThrow("この設問の類型表の類型ではありません")
    await expect(
      draftWith({ status: "partial", partialScore: 2, scaleLevelId: null })
    ).rejects.toThrow("正答・誤答・部分点")
    await expect(
      draftWith({ status: "pending", partialScore: 2, scaleLevelId: null })
    ).rejects.toThrow("点を付けません")
    await expect(
      draftWith({
        status: "pending",
        partialScore: null,
        scaleLevelId: levelA.id,
      })
    ).rejects.toThrow("類型を持ちません")
  })

  it("問いかけで決めた類型は類型の書き込みで書き、ほかの類型表の類型は拒む", async () => {
    const { levelA, levelB, otherLevel } = await setUpScaleQuestion()
    await writeAiQuestioningScores(
      {
        cropRegionId: cropRegionId(),
        scores: [
          {
            examStudentId: examStudentId(0),
            status: "evaluated",
            partialScore: null,
            scaleLevelId: levelA.id,
          },
          {
            examStudentId: examStudentId(1),
            status: "evaluated",
            partialScore: null,
            scaleLevelId: levelB.id,
          },
          {
            examStudentId: examStudentId(2),
            status: "no_answer",
            partialScore: null,
            scaleLevelId: null,
          },
        ],
      },
      ownerId()
    )
    const rows = await testPrisma.questionScore.findMany({
      where: { cropRegionId: cropRegionId(), userId: ownerId() },
    })
    const rowOf = (index: number) =>
      rows.find((row) => row.examStudentId === examStudentId(index))
    expect(rowOf(0)).toMatchObject({
      status: "evaluated",
      scaleLevelId: levelA.id,
      partialScore: null,
    })
    expect(rowOf(1)).toMatchObject({
      status: "evaluated",
      scaleLevelId: levelB.id,
    })
    expect(rowOf(2)).toMatchObject({ status: "no_answer", scaleLevelId: null })

    await expect(
      writeAiQuestioningScores(
        {
          cropRegionId: cropRegionId(),
          scores: [
            {
              examStudentId: examStudentId(0),
              status: "evaluated",
              partialScore: null,
              scaleLevelId: otherLevel.id,
            },
          ],
        },
        ownerId()
      )
    ).rejects.toThrow("この設問の類型表の類型ではありません")
    await expect(
      writeAiQuestioningScores(
        {
          cropRegionId: cropRegionId(),
          scores: [
            {
              examStudentId: examStudentId(0),
              status: "correct",
              partialScore: null,
              scaleLevelId: null,
            },
          ],
        },
        ownerId()
      )
    ).rejects.toThrow("正答・誤答・部分点")
    // 拒んだ書き込みは何も変えない
    expect(
      (
        await testPrisma.questionScore.findFirstOrThrow({
          where: {
            cropRegionId: cropRegionId(),
            userId: ownerId(),
            examStudentId: examStudentId(0),
          },
        })
      ).scaleLevelId
    ).toBe(levelA.id)
  })

  it("類型方式でない設問には類型を付けられない", async () => {
    const { levelA } = await setUpScaleQuestion()
    await testPrisma.cropRegion.update({
      where: { id: cropRegionId() },
      data: { scoringMethod: "deduction" },
    })
    await expect(
      writeAiQuestioningScores(
        {
          cropRegionId: cropRegionId(),
          scores: [
            {
              examStudentId: examStudentId(0),
              status: "evaluated",
              partialScore: null,
              scaleLevelId: levelA.id,
            },
          ],
        },
        ownerId()
      )
    ).rejects.toThrow("類型方式でない設問には、類型を付けられません")
  })

  it("案の外の問いかけの答えに類型を持ち、設問の類型表の類型だけを受ける", async () => {
    const { levelB, otherLevel } = await setUpScaleQuestion()
    const proposal = await createProposal()
    const attemptId = await attemptIdOf(proposal.id, 0)
    const [written] = await recordAiAttemptResponses(
      {
        responses: [
          {
            attemptId,
            choice: "rescore",
            status: "evaluated",
            partialScore: null,
            scaleLevelId: levelB.id,
          },
        ],
      },
      ownerId()
    )
    expect(written).toMatchObject({
      status: "evaluated",
      scaleLevelId: levelB.id,
    })
    await expect(
      recordAiAttemptResponses(
        {
          responses: [
            {
              attemptId,
              choice: "rescore",
              status: "evaluated",
              partialScore: null,
              scaleLevelId: otherLevel.id,
            },
          ],
        },
        ownerId()
      )
    ).rejects.toThrow("この設問の類型表の類型ではありません")
  })
})
