/**
 * 1段目のルーブリック項目・教員の指示と、1段目のあとに続く2段目（項目の案）を、偽の事業者で
 * テスト DB に対して走らせる（docs/vlm-grading-design.md §3-1・§3-3・§3-4・§3-6）。
 *
 * 外部へは何も送らない。答案画像は合成した PNG、応答は合成した JSON。
 */

import * as fs from "fs"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { createGradingJobRunner } from "@/electron-src/lib/aiGrading/gradingJobRunner"
import type { GradingRequest } from "@/electron-src/lib/aiGrading/providers/types"
import { listAiRubricProposalRunsByCropRegion } from "@/electron-src/lib/prisma/aiRubricProposal"
import { createRubricItem } from "@/electron-src/lib/prisma/rubricItem"
import { STAGE2_TEMPLATE_VERSION } from "@/lib/shared/aiGrading/stage2Grouping"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"
import {
  completedResponse,
  createAiGradingFixture,
  createFakeProvider,
  createTestDependencies,
  PARTIAL_JUDGEMENT,
} from "./helpers/aiGradingFixture"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createAiGradingFixture>>
const dataDirectories: string[] = []

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createAiGradingFixture(testPrisma)
  dataDirectories.push(fixture.dataDirectory)
})

afterAll(async () => {
  dataDirectories.forEach((dataDirectory) =>
    fs.rmSync(dataDirectory, { recursive: true, force: true })
  )
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const examStudentIds = () =>
  fixture.exam.examStudents.map((examStudent) => examStudent.id)

const startInput = () => ({
  promptId: fixture.prompt.id,
  examStudentIds: examStudentIds(),
  provider: "anthropic" as const,
  model: "claude-test",
  effort: "medium" as const,
  mode: "realtime" as const,
  imageScale: 1,
})

const textOf = (request: GradingRequest) =>
  request.fixedParts
    .map((part) => (part.kind === "text" ? part.text : "<image>"))
    .join("\n")

/** 検証を通る2段目の応答（A1・A2 を「解が無い」、A3 は案に入れない） */
const GROUPING_RESPONSE = {
  proposals: [
    {
      label: "解が無い",
      description: "因数分解までで解を書いていない",
      adviceDraft: "最後に解を書こう。",
      matchedRubricItemId: null,
      memberAnswerKeys: ["A1", "A2"],
      options: [
        {
          effectKind: "adjust",
          pointDelta: -2,
          setStatus: null,
          setScore: null,
          rationale: "解が無い分を引く",
          recommended: true,
        },
        {
          effectKind: "set",
          pointDelta: null,
          setStatus: "incorrect",
          setScore: null,
          rationale: "解が無ければ誤答",
          recommended: false,
        },
      ],
    },
  ],
  notes: "模範解答が途中式を省いている",
}

/** 1段目を走らせ、続く2段目まで待つ */
async function gradeAndGroup(
  fake: ReturnType<typeof createFakeProvider>,
  actorUserId = fixture.exam.user.id
) {
  const runner = createGradingJobRunner(
    createTestDependencies(fake.provider, fixture.dataDirectory)
  )
  const { run, finished } = await runner.startGradingRun(
    startInput(),
    actorUserId
  )
  await finished
  return { runner, gradeRun: run }
}

describe("1段目のあとに続く2段目", () => {
  it("判定の出た試行を仮の番号で文字だけ送り、案・選択肢・答案を試行の id へ戻して書く", async () => {
    const fake = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
      respondGrouping: async () => completedResponse(GROUPING_RESPONSE),
    })
    const { gradeRun } = await gradeAndGroup(fake)

    expect(fake.groupingRequests).toHaveLength(1)
    const [groupingRequest] = fake.groupingRequests
    expect(groupingRequest.variableParts).toEqual([])
    expect(
      groupingRequest.fixedParts.every((part) => part.kind === "text")
    ).toBe(true)
    const sentText = textOf(groupingRequest)
    expect(sentText).toContain("[A1]")
    expect(sentText).toContain("[A3]")
    expect(sentText).toContain(PARTIAL_JUDGEMENT.observation)
    // 試行・受験者の id も氏名も送らない
    const attempts = await testPrisma.aiGradingAttempt.findMany({
      where: { runId: gradeRun.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })
    attempts.forEach((attempt) => {
      expect(sentText).not.toContain(attempt.id)
      expect(sentText).not.toContain(attempt.examStudentId)
    })
    fixture.exam.students.forEach((student) => {
      expect(sentText).not.toContain(student.lastName + student.firstName)
    })

    const groupRun = await testPrisma.aiGradingRun.findFirstOrThrow({
      where: { purpose: "group" },
    })
    expect(groupRun).toMatchObject({
      status: "ended",
      templateVersion: STAGE2_TEMPLATE_VERSION,
      promptId: gradeRun.promptId,
      mode: "realtime",
      notes: GROUPING_RESPONSE.notes,
      inputTokens: 100,
      outputTokens: 20,
    })

    const [proposalRun] = await listAiRubricProposalRunsByCropRegion(
      fixture.cropRegion.id,
      fixture.exam.user.id
    )
    expect(proposalRun.id).toBe(groupRun.id)
    const [proposal] = proposalRun.rubricProposals
    expect(proposal).toMatchObject({
      label: "解が無い",
      adviceDraft: "最後に解を書こう。",
      matchedRubricItemId: null,
      sortOrder: 0,
    })
    expect(
      proposal.options.map((option) => [
        option.effectKind,
        option.pointDelta?.toNumber() ?? null,
        option.setStatus,
        option.recommended,
      ])
    ).toEqual([
      ["adjust", -2, null, true],
      ["set", null, "incorrect", false],
    ])
    // A1・A2 は2段目へ送った並び（試行を作った順）の1件目・2件目
    expect(proposal.members.map((member) => member.attemptId).sort()).toEqual(
      [attempts[0].id, attempts[1].id].sort()
    )
    expect(proposal.responses).toEqual([])
  })

  it("2段目の応答が検証で外れたら、2段目の実行を失敗にして案を書かない", async () => {
    const fake = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
      respondGrouping: async () =>
        completedResponse({
          ...GROUPING_RESPONSE,
          proposals: [
            { ...GROUPING_RESPONSE.proposals[0], memberAnswerKeys: ["A9"] },
          ],
        }),
    })
    await gradeAndGroup(fake)

    const groupRun = await testPrisma.aiGradingRun.findFirstOrThrow({
      where: { purpose: "group" },
    })
    expect(groupRun.status).toBe("failed")
    expect(await testPrisma.aiRubricProposal.count()).toBe(0)
  })

  it("判定が1件も出なければ2段目を送らない。送り直しは実行した教員だけができる", async () => {
    const fake = createFakeProvider({
      respond: async () => completedResponse({ status: "maru" }),
    })
    const { runner, gradeRun } = await gradeAndGroup(fake)
    expect(fake.groupingRequests).toHaveLength(0)
    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "group" } })
    ).toBe(0)

    await expect(
      runner.startGroupingRun(gradeRun.id, fixture.otherUser.id)
    ).rejects.toThrow("実行した教員だけ")
    expect(
      await runner.startGroupingRun(gradeRun.id, fixture.exam.user.id)
    ).toBeNull()
  })
})

describe("1段目のルーブリック項目", () => {
  it("項目の一覧を送り、送った文をプロンプトの新しい行に写し、当てはまりを書く", async () => {
    const rubricItem = await createRubricItem(
      {
        cropRegionId: fixture.cropRegion.id,
        label: "解が無い",
        adviceText: "",
        sortOrder: 0,
        effectKind: "adjust",
        pointDelta: -2,
        setStatus: null,
        setScore: null,
      },
      fixture.exam.user.id
    )
    const fake = createFakeProvider({
      respond: async () =>
        completedResponse({
          ...PARTIAL_JUDGEMENT,
          matchedRubricItemIds: [rubricItem.id],
        }),
    })
    const { gradeRun } = await gradeAndGroup(fake)

    const [stage1Request] = fake.gradeRequests
    expect(textOf(stage1Request)).toContain(
      `## ルーブリック項目\n- id: ${rubricItem.id} ／ −2点 ／ 解が無い`
    )
    expect(stage1Request.outputSchemaName).toBe("stage1_grading")
    expect(JSON.stringify(stage1Request.outputSchema)).toContain(rubricItem.id)

    // 項目を作る前に作ったプロンプトは一覧が空なので、新しい行を作って送る
    const sendingPrompt = await testPrisma.aiPrompt.findUniqueOrThrow({
      where: { id: gradeRun.promptId },
    })
    expect(sendingPrompt.id).not.toBe(fixture.prompt.id)
    expect(sendingPrompt.parentPromptId).toBe(fixture.prompt.id)
    expect(sendingPrompt.renderedRubricItems).toContain(rubricItem.id)
    expect(sendingPrompt.rubricText).toBe(fixture.prompt.rubricText)

    const matches = await testPrisma.aiAttemptRubricMatch.findMany({
      where: { attempt: { runId: gradeRun.id } },
    })
    expect(matches).toHaveLength(3)
    expect(new Set(matches.map((match) => match.rubricItemId))).toEqual(
      new Set([rubricItem.id])
    )

    // 2段目にも、既存の項目に当たることを添える
    expect(textOf(fake.groupingRequests[0])).toContain(
      `当てはまる既存の項目: ${rubricItem.id}`
    )

    // 同じ項目の一覧なら、その行をそのまま使う（新しい行を作らない）
    const second = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(second.provider, fixture.dataDirectory)
    )
    const { run: secondRun, finished } = await runner.startGradingRun(
      { ...startInput(), promptId: sendingPrompt.id },
      fixture.exam.user.id
    )
    await finished
    expect(secondRun.promptId).toBe(sendingPrompt.id)
  })

  it("問いかけの「その他」に書いた指示を、次の往復の1段目と2段目に添える", async () => {
    const first = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
      respondGrouping: async () => completedResponse(GROUPING_RESPONSE),
    })
    await gradeAndGroup(first)
    const proposal = await testPrisma.aiRubricProposal.findFirstOrThrow()
    await testPrisma.aiRubricProposalResponse.create({
      data: {
        proposalId: proposal.id,
        optionId: null,
        freeText: "途中式が無ければ誤答にする",
      },
    })

    const second = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    await gradeAndGroup(second)
    const instructionSection = "## 教員の指示\n- 途中式が無ければ誤答にする"
    expect(textOf(second.gradeRequests[0])).toContain(instructionSection)
    expect(textOf(second.groupingRequests[0])).toContain(instructionSection)

    // 別の教員の往復には添えない
    const colleague = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    await gradeAndGroup(colleague, fixture.otherUser.id)
    expect(textOf(colleague.gradeRequests[0])).not.toContain("教員の指示")
  })
})
