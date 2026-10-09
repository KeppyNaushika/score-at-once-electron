/**
 * 問いかけ（AI の項目の案）への答えの反映（docs/vlm-grading-design.md §3-5・§5-3）。
 *
 * - 選択肢を選ぶと項目を作り、答えを記録し、渡した答案の自分の採点行に当てる
 * - 選び直しは同じ項目の効き方を変える（項目を2つ作らない）
 * - 既存の項目に当たる案は、その項目を当てるだけで値を変えない
 * - 「その他」は指示を記録し、前の答えで当てた項目を外す。指示は次の往復に添える
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

import {
  answerAiRubricProposal,
  listAiRubricProposalRunsByCropRegion,
  listTeacherInstructions,
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

describe("選択肢を選ぶ", () => {
  it("項目を作って答えを記録し、渡した答案の自分の採点行に当てる", async () => {
    const proposal = await createProposal()
    const [recommended] = proposal.options

    const { response, touchedRows } = await answerAiRubricProposal(
      {
        proposalId: proposal.id,
        optionId: recommended.id,
        freeText: "",
        examStudentIds: [examStudentId(0), examStudentId(1)],
        adviceText: "単位 cm を書こう。",
      },
      ownerId()
    )

    const items = await testPrisma.rubricItem.findMany({
      where: { cropRegionId: cropRegionId() },
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: "単位が無い",
      adviceText: "単位 cm を書こう。",
      effectKind: "adjust",
      createdByUserId: ownerId(),
    })
    expect(items[0].pointDelta?.toNumber()).toBe(-1)
    expect(response).toMatchObject({
      optionId: recommended.id,
      resultRubricItemId: items[0].id,
      freeText: "",
    })
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

    const [proposalRun] = await listAiRubricProposalRunsByCropRegion(
      cropRegionId(),
      ownerId()
    )
    expect(proposalRun.rubricProposals[0].responses).toHaveLength(1)
    expect(proposalRun.rubricProposals[0].members[0].attempt.state).toBe(
      "succeeded"
    )
  })

  it("選び直しは同じ項目の効き方を変え、項目を2つ作らない", async () => {
    const proposal = await createProposal()
    const [recommended, incorrect] = proposal.options
    const input = {
      proposalId: proposal.id,
      freeText: "",
      examStudentIds: [examStudentId(0)],
    }
    await answerAiRubricProposal(
      { ...input, optionId: recommended.id },
      ownerId()
    )
    const { response } = await answerAiRubricProposal(
      { ...input, optionId: incorrect.id },
      ownerId()
    )

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

    const { response, touchedRows } = await answerAiRubricProposal(
      {
        proposalId: proposal.id,
        optionId: proposal.options[0].id,
        freeText: "",
        examStudentIds: [examStudentId(1)],
      },
      ownerId()
    )

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
  it("指示を記録して次の往復に添え、前の答えで当てた項目を外す", async () => {
    const proposal = await createProposal()
    await answerAiRubricProposal(
      {
        proposalId: proposal.id,
        optionId: proposal.options[0].id,
        freeText: "",
        examStudentIds: [examStudentId(0), examStudentId(1)],
      },
      ownerId()
    )

    const { response, touchedRows } = await answerAiRubricProposal(
      {
        proposalId: proposal.id,
        optionId: null,
        freeText: " 単位が無くても cm が明らかなら減点しない ",
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

    // 選択肢で答え直すと、その指示は効かなくなる
    await answerAiRubricProposal(
      {
        proposalId: proposal.id,
        optionId: proposal.options[0].id,
        freeText: "",
        examStudentIds: [],
      },
      ownerId()
    )
    expect(await listTeacherInstructions(cropRegionId(), ownerId())).toEqual([])
  })

  it("指示が空なら記録しない", async () => {
    const proposal = await createProposal()
    await expect(
      answerAiRubricProposal(
        {
          proposalId: proposal.id,
          optionId: null,
          freeText: "  ",
          examStudentIds: [],
        },
        ownerId()
      )
    ).rejects.toThrow("指示を書いてください")
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
      examStudentIds: [examStudentId(0)],
    }
    await expect(answerAiRubricProposal(base, otherUserId)).rejects.toThrow(
      "実行した教員だけ"
    )
    await expect(
      answerAiRubricProposal(
        { ...base, examStudentIds: [examStudentId(2)] },
        ownerId()
      )
    ).rejects.toThrow("案に入っていない答案")
    await expect(
      answerAiRubricProposal(
        { ...base, optionId: otherProposal.options[0].id },
        ownerId()
      )
    ).rejects.toThrow("この案のものではありません")
    expect(await testPrisma.rubricItem.count()).toBe(0)
    expect(await testPrisma.aiRubricProposalResponse.count()).toBe(0)
  })
})
