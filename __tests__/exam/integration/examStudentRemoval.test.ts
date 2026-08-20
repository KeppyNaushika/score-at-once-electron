/**
 * 試験から生徒を外したとき、その受験者に紐づく採点データが全て消えることの検証。
 *
 * #962 以前は ExamStudent を参照する子テーブルが1つも無く、削除経路
 * （removeStudentsFromExam）が手書きで消していた分しか消えなかった。
 * 取りこぼした行は試験のどの画面にも現れないのに成績算出では素点として算入される
 * 「孤児」になっていた。採点層を ExamStudent の子にしたことで、この 1 回の削除が
 * DB の cascade で全ての子を巻き取る。
 *
 * 削除確認モーダル（StudentRemovalConfirmModal）が以前から約束していた挙動であり、
 * このテストはその約束が実際に守られていることを固定する。
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

import { removeStudentsFromExam } from "@/electron-src/lib/prisma/examStudent"
import { getExamStudentDeletionCounts } from "@/electron-src/lib/prisma/gradingData"

import { SAW_ALL_DELETION_COUNTS } from "../../helpers/deletionCounts"
import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/**
 * 2生徒・1ページ・1設問の試験に、受験者へぶら下がる採点層を一通り作る。
 * 対象の5テーブル（答案・採点・確定・複合回答・返却版）を全て埋める。
 */
async function buildExamWithFullScoringLayer() {
  const exam = await createFullTestExam(testPrisma, {
    studentCount: 2,
    pageCount: 1,
    cropRegionsPerPage: 1,
    includeScores: true,
    includeAnnotations: true,
    includeStudentAnswerImages: true,
  })

  const [examStudentA, examStudentB] = exam.examStudents
  const cropRegion = exam.cropRegions[0]
  const user = await testPrisma.user.findFirstOrThrow()

  const compoundAnswer = await testPrisma.compoundAnswer.create({
    data: {
      id: crypto.randomUUID(),
      examPageId: exam.pages[0].id,
      label: "アイ",
      answerFormat: "multi-digit",
      correctAnswer: "42",
      points: 5,
    },
  })

  for (const examStudent of [examStudentA, examStudentB]) {
    await testPrisma.scoreDecision.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: cropRegion.id,
        examStudentId: examStudent.id,
        verdict: "correct",
        decidedByUserId: user.id,
      },
    })
    await testPrisma.compoundAnswerScore.create({
      data: {
        id: crypto.randomUUID(),
        compoundAnswerId: compoundAnswer.id,
        examStudentId: examStudent.id,
        userId: user.id,
        status: "correct",
        recognizedAnswer: "42",
      },
    })
    await testPrisma.returnSnapshot.create({
      data: {
        id: crypto.randomUUID(),
        examStudentId: examStudent.id,
        scoresJson: JSON.stringify({ v: 1, scores: [], annotations: [] }),
        totalScore: 10,
        capturedByUserId: user.id,
      },
    })
  }

  return { exam, examStudentA, examStudentB, user }
}

/** その受験者に紐づく採点層の行数（全テーブル合計と内訳） */
async function countScoringRows(examStudentId: string) {
  const [
    studentAnswerImages,
    questionScores,
    scoreDecisions,
    compoundAnswerScores,
    returnSnapshots,
    drawingAnnotations,
  ] = await Promise.all([
    testPrisma.studentAnswerImage.count({ where: { examStudentId } }),
    testPrisma.questionScore.count({ where: { examStudentId } }),
    testPrisma.scoreDecision.count({ where: { examStudentId } }),
    testPrisma.compoundAnswerScore.count({ where: { examStudentId } }),
    testPrisma.returnSnapshot.count({ where: { examStudentId } }),
    testPrisma.drawingAnnotation.count({
      where: { questionScore: { examStudentId } },
    }),
  ])
  return {
    studentAnswerImages,
    questionScores,
    scoreDecisions,
    compoundAnswerScores,
    returnSnapshots,
    drawingAnnotations,
  }
}

describe("removeStudentsFromExam", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("外した生徒の採点データが5テーブルとも残らない", async () => {
    const { exam, examStudentA, examStudentB } =
      await buildExamWithFullScoringLayer()

    // 前提: 削除前は5テーブルすべてに行がある
    const before = await countScoringRows(examStudentA.id)
    expect(before.studentAnswerImages).toBeGreaterThan(0)
    expect(before.questionScores).toBeGreaterThan(0)
    expect(before.scoreDecisions).toBeGreaterThan(0)
    expect(before.compoundAnswerScores).toBeGreaterThan(0)
    expect(before.returnSnapshots).toBeGreaterThan(0)

    await removeStudentsFromExam(
      exam.exam.id,
      [examStudentA.studentId],
      SAW_ALL_DELETION_COUNTS
    )

    expect(await countScoringRows(examStudentA.id)).toEqual({
      studentAnswerImages: 0,
      questionScores: 0,
      scoreDecisions: 0,
      compoundAnswerScores: 0,
      returnSnapshots: 0,
      drawingAnnotations: 0,
    })

    // 受験者自身も消えている
    expect(
      await testPrisma.examStudent.findUnique({
        where: { id: examStudentA.id },
      })
    ).toBeNull()

    // 残した生徒の採点は巻き添えにしない
    const remaining = await countScoringRows(examStudentB.id)
    expect(remaining.questionScores).toBeGreaterThan(0)
    expect(remaining.scoreDecisions).toBe(1)
    expect(remaining.compoundAnswerScores).toBe(1)
    expect(remaining.returnSnapshots).toBe(1)
  })

  it("生徒（人）そのものは消えない — 消えるのはその試験の受験だけ", async () => {
    const { exam, examStudentA } = await buildExamWithFullScoringLayer()

    await removeStudentsFromExam(
      exam.exam.id,
      [examStudentA.studentId],
      SAW_ALL_DELETION_COUNTS
    )

    const student = await testPrisma.student.findUnique({
      where: { id: examStudentA.studentId },
    })
    expect(student).not.toBeNull()
  })

  it("削除確認の件数は cascade で消える範囲を数える（安全と誤表示しない）", async () => {
    const { exam, examStudentA } = await buildExamWithFullScoringLayer()

    // 答案と採点行だけを先に消し、確定・複合回答・返却版だけが残った状態にする。
    // 数える範囲が削除範囲より狭いと、ここで「採点データなし」と誤表示してしまう。
    await testPrisma.studentAnswerImage.deleteMany({
      where: { examStudentId: examStudentA.id },
    })
    await testPrisma.questionScore.deleteMany({
      where: { examStudentId: examStudentA.id },
    })

    const deletionCounts = await getExamStudentDeletionCounts(exam.exam.id, [
      examStudentA.studentId,
    ])

    // 答案と採点行は消したので、残るのは確定・複合回答・返却版の3件。
    // 数える範囲が削除範囲より狭いとここが3件に届かず、モーダルが
    // 「採点データがないため安全に削除できます」と誤表示してしまう
    expect(deletionCounts).toEqual([
      { countedName: "採点データ", shownCount: 3 },
    ])
  })

  it("外した生徒を再追加しても採点は復元されない（破棄は取り消せない）", async () => {
    const { exam, examStudentA } = await buildExamWithFullScoringLayer()

    await removeStudentsFromExam(
      exam.exam.id,
      [examStudentA.studentId],
      SAW_ALL_DELETION_COUNTS
    )

    const readded = await testPrisma.examStudent.create({
      data: {
        id: crypto.randomUUID(),
        examId: exam.exam.id,
        studentId: examStudentA.studentId,
        status: "participating",
      },
    })

    expect(await countScoringRows(readded.id)).toEqual({
      studentAnswerImages: 0,
      questionScores: 0,
      scoreDecisions: 0,
      compoundAnswerScores: 0,
      returnSnapshots: 0,
      drawingAnnotations: 0,
    })
  })
})
