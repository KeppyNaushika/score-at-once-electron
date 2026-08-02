/**
 * 試験の裁定サマリ（getExamDecisionSummary）統合テスト
 *
 * この経路はテストから一度も呼ばれていなかった。裁定サマリは「出力を止めずに伝える」ための
 * 唯一の導線なので、競合を数え落とすと誤った点数のまま黙って書き出される。
 *
 * 解決ルール自体は resolveEffectiveScores のテストが持つ。ここで固定するのは
 * サマリ側の派生計算 — 裁定対象の抽出、失点見込み、担当と進捗の数え方。
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

import { buildAssignmentId } from "@/electron-src/lib/prisma/cropRegionAssignment"
import { getExamDecisionSummary } from "@/electron-src/lib/prisma/scoreDecisionSummary"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 追加の採点者を作る。メンバーにするかどうかで担当の数え方が変わる */
async function createGrader(name: string, examId: string | null) {
  const user = await testPrisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: `grader_${crypto.randomUUID()}`,
      name,
      role: "teacher",
    },
  })
  if (examId) {
    await testPrisma.userExam.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        examId,
        role: "GRADER",
      },
    })
  }
  return user
}

async function assignGrader(cropRegionId: string, userId: string) {
  await testPrisma.cropRegionAssignment.create({
    // 決定論的id。uuid を振ると2端末で同値別idの行ができて同期で衝突する
    data: { id: buildAssignmentId(cropRegionId, userId), cropRegionId, userId },
  })
}

describe("試験の裁定サマリ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("裁定対象が無くても全ての設問を配点つきで返す", async () => {
    const fixture = await createFullTestExam(testPrisma, {})

    const result = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    const { summary } = result

    expect(summary.questions).toHaveLength(fixture.cropRegions.length)
    for (const [index, question] of summary.questions.entries()) {
      expect(question.cropRegionId).toBe(fixture.cropRegions[index].id)
      expect(question.questionLabel).toBe(fixture.cropRegions[index].label)
      expect(question.maxScore).toBe(fixture.cropRegions[index].points)
      expect(question.cells).toEqual([])
    }
    expect(summary.conflictCount).toBe(0)
    expect(summary.staleCount).toBe(0)
    expect(summary.totalScoreImpact).toBe(0)
    // 採点者が1人の試験は常に合意で解決される（個人利用と同一挙動）
    expect(summary.graderCount).toBe(1)
  })

  it("食い違ったセルを競合として挙げ、失われうる点を見積もる", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const [firstCropRegion] = fixture.cropRegions
    const otherGrader = await createGrader("別の採点者", fixture.exam.id)
    await testPrisma.questionScore.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: firstCropRegion.id,
        examStudentId: examStudent.id,
        userId: otherGrader.id,
        status: "incorrect",
        partialScore: null,
      },
    })

    const result = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )
    if (!result.success) throw new Error(result.error)
    const { summary } = result

    expect(summary.conflictCount).toBe(1)
    expect(summary.graderCount).toBe(2)
    // 未解決のまま出力すると、正答(10点)側の主張が失われうる
    expect(summary.totalScoreImpact).toBe(10)

    const question = summary.questions.find(
      (candidate) => candidate.cropRegionId === firstCropRegion.id
    )!
    expect(question.cells).toHaveLength(1)
    const [cell] = question.cells
    expect(cell.reason).toBe("conflict")
    expect(cell.examStudentId).toBe(examStudent.id)
    expect(cell.scoreImpact).toBe(10)
    expect(cell.decision).toBeNull()
    // 裁定画面は誰が何を主張したかを出す
    expect(cell.proposals).toHaveLength(2)
    expect(
      cell.proposals.map((proposal) => proposal.scoreValue).sort()
    ).toEqual([0, 10])
    expect(cell.proposals.map((proposal) => proposal.userName).sort()).toEqual(
      [fixture.user.name, otherGrader.name].sort()
    )
    // 氏名は裁定対象セルの分だけ引く。ID がそのまま出ていたら引けていない
    expect(cell.studentName).not.toBe(examStudent.id)
  })

  it("確定より新しい提案が入ったセルを stale として挙げる", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const [firstCropRegion] = fixture.cropRegions
    // 提案（試験作成時）より前に確定していた、という状態を作る
    await testPrisma.scoreDecision.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: firstCropRegion.id,
        examStudentId: examStudent.id,
        verdict: "partial",
        score: 3,
        comment: "部分点で確定",
        decidedByUserId: fixture.user.id,
        decidedAt: new Date("2020-01-01"),
      },
    })

    const result = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )
    if (!result.success) throw new Error(result.error)
    const { summary } = result

    expect(summary.staleCount).toBe(1)
    expect(summary.conflictCount).toBe(0)
    expect(summary.decidedCount).toBe(1)
    // 確定済みなので出力は止まらない（失点見込みは立たない）
    expect(summary.totalScoreImpact).toBe(0)

    const question = summary.questions.find(
      (candidate) => candidate.cropRegionId === firstCropRegion.id
    )!
    expect(question.decidedCount).toBe(1)
    const [cell] = question.cells
    expect(cell.reason).toBe("stale")
    expect(cell.decision!.verdict).toBe("partial")
    expect(cell.decision!.score).toBe(3)
    expect(cell.decision!.decidedByName).toBe(fixture.user.name)
  })

  it("担当は試験のメンバーだけを数える", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [firstCropRegion, secondCropRegion] = fixture.cropRegions
    const member = await createGrader("担当の先生", fixture.exam.id)
    const nonMember = await createGrader("外れた先生", null)
    await assignGrader(firstCropRegion.id, member.id)
    await assignGrader(secondCropRegion.id, nonMember.id)

    const result = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )
    if (!result.success) throw new Error(result.error)
    const { summary } = result

    const assigned = summary.questions.find(
      (question) => question.cropRegionId === firstCropRegion.id
    )!
    expect(assigned.assignees.map((grader) => grader.userName)).toEqual([
      member.name,
    ])
    // まだ1件も採点していない
    expect(assigned.assignees[0].scoredCount).toBe(0)

    // 非メンバーの割当が残っていても担当としては数えない
    // （担当が居るのに誰も採点できない設問が生まれるため）
    const orphaned = summary.questions.find(
      (question) => question.cropRegionId === secondCropRegion.id
    )!
    expect(orphaned.assignees).toEqual([])

    expect(
      summary.members.map((memberRow) => memberRow.userName).sort()
    ).toEqual([fixture.user.name, member.name].sort())
  })

  it("担当者の採点済み件数は未採点行を除いて数える", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: false,
    })
    const [firstCropRegion] = fixture.cropRegions
    const [firstExamStudent, secondExamStudent] = fixture.examStudents
    const member = await createGrader("担当の先生", fixture.exam.id)
    await assignGrader(firstCropRegion.id, member.id)
    await testPrisma.questionScore.createMany({
      data: [
        {
          id: crypto.randomUUID(),
          cropRegionId: firstCropRegion.id,
          examStudentId: firstExamStudent.id,
          userId: member.id,
          status: "correct",
          partialScore: null,
        },
        {
          id: crypto.randomUUID(),
          cropRegionId: firstCropRegion.id,
          examStudentId: secondExamStudent.id,
          userId: member.id,
          status: "unscored",
          partialScore: null,
        },
      ],
    })

    const result = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )
    if (!result.success) throw new Error(result.error)

    const question = result.summary.questions.find(
      (candidate) => candidate.cropRegionId === firstCropRegion.id
    )!
    // 初期化が作る unscored 行は採点の意思表示ではない
    expect(question.assignees[0].scoredCount).toBe(1)
    expect(question.scoredCount).toBe(1)
    expect(result.summary.graderCount).toBe(1)
  })

  it("進捗の分母は答案がある受験者数", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeStudentAnswerImages: true,
    })

    const result = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )
    if (!result.success) throw new Error(result.error)

    for (const question of result.summary.questions) {
      // 答案は受験者×ページぶんあるが、分母は受験者の人数
      expect(question.totalStudents).toBe(fixture.examStudents.length)
      expect(question.scoredCount).toBe(fixture.examStudents.length)
    }
  })

  it("確定できるのは OWNER だけ", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const grader = await createGrader("担当の先生", fixture.exam.id)

    const asOwner = await getExamDecisionSummary(
      fixture.exam.id,
      fixture.user.id
    )
    const asGrader = await getExamDecisionSummary(fixture.exam.id, grader.id)

    if (!asOwner.success || !asGrader.success) throw new Error("failed")
    expect(asOwner.summary.canDecide).toBe(true)
    expect(asGrader.summary.canDecide).toBe(false)
  })
})
