/**
 * 個人成績表のデータ取得（fetchIndividualReportData）統合テスト
 *
 * この経路にはテストが1本も無かった。main が統計を算出していたのを renderer へ移し、
 * 母集団（ReportPopulation）を試験に1つだけ返す形へ変えた際、配線は typecheck しか
 * 通っていない状態だった。
 *
 * ここで固定するのは「main が何を返すか」だけで、統計そのものは renderer 側
 * （computeReportData）のテストが持つ。main が計算しないことも合わせて確かめる。
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

import { fetchIndividualReportData } from "@/electron-src/lib/export/individual-report/dataFetcher"
import { DEFAULT_INDIVIDUAL_REPORT_OPTIONS } from "@/electron-src/lib/export/individual-report/types"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 既存の割り当てを消してから、全設問を1つの小計へ割り当て直す */
async function assignAllQuestionsTo(
  subtotalId: string,
  cropRegionIds: string[]
) {
  await testPrisma.cropSubtotal.deleteMany({
    where: { cropRegionId: { in: cropRegionIds } },
  })
  for (const cropRegionId of cropRegionIds) {
    await testPrisma.cropSubtotal.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId,
        subtotalId,
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    })
  }
}

async function fetchReport(examId: string, selectedExamStudentIds: string[]) {
  return fetchIndividualReportData({
    examId,
    selectedExamStudentIds,
    options: DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  })
}

describe("個人成績表のデータ取得", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("母集団は試験に1つで、選択した生徒の数に依らない", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })
    const [firstExamStudent] = fixture.examStudents

    const oneStudent = await fetchReport(fixture.exam.id, [firstExamStudent.id])
    const allStudents = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    expect(oneStudent.success).toBe(true)
    expect(allStudents.success).toBe(true)

    // 選択1名でも母集団は全受験者ぶん。生徒ごとに複製していた頃はここが1件だった
    expect(oneStudent.population!.rawTotalScores).toHaveLength(
      fixture.examStudents.length
    )
    expect(oneStudent.population!.rawTotalScores).toEqual(
      allStudents.population!.rawTotalScores
    )

    // レポートは選択した生徒の分だけ
    expect(oneStudent.reports).toHaveLength(1)
    expect(allStudents.reports).toHaveLength(fixture.examStudents.length)
  })

  it("母集団の合計点は受験者IDと得点で構成される", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    const rawTotalScores = result.population!.rawTotalScores
    for (const examStudent of fixture.examStudents) {
      const entry = rawTotalScores.find(
        (rawTotalScore) => rawTotalScore.studentId === examStudent.studentId
      )
      expect(entry).toBeDefined()
      expect(
        typeof entry!.totalScore === "number" || entry!.totalScore === null
      ).toBe(true)
    }
  })

  it("小計点は QUESTION_ASSIGNMENT の割り当てから算出される", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })
    const [subtotal] = fixture.subtotals
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    await assignAllQuestionsTo(subtotal.id, cropRegionIds)

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    const reported = result.population!.subtotals.find(
      (reportSubtotal) => reportSubtotal.subtotalId === subtotal.id
    )
    expect(reported).toBeDefined()
    // 満点は割り当てた設問の配点合計
    expect(reported!.maxScore).toBe(
      fixture.cropRegions.reduce(
        (sum, cropRegion) => sum + cropRegion.points,
        0
      )
    )

    const subtotalRawScores = result.population!.subtotalRawScores.find(
      (entry) => entry.subtotalId === subtotal.id
    )
    expect(subtotalRawScores).toBeDefined()
    expect(subtotalRawScores!.scores.length).toBe(fixture.examStudents.length)
  })

  it("割り当てが無ければ小計点は算出されない", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })
    // 設問と小計の紐付けを全て外す（小計は残るが、算入する設問が無い状態）
    await testPrisma.cropSubtotal.deleteMany({})

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    for (const reportSubtotal of result.population!.subtotals) {
      expect(reportSubtotal.maxScore).toBe(0)
    }
  })

  it("学級は生徒表示（studentReport）対象だけを、所属生徒つきで返す", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    const classrooms = result.population!.classrooms
    expect(classrooms).toHaveLength(1)
    expect(classrooms[0].classroomId).toBe(fixture.classroom.id)
    expect(classrooms[0].className).toBe(fixture.classroom.name)
    // 学級との比較は renderer が memberStudentIds から交差を取る
    expect(classrooms[0].memberStudentIds.sort()).toEqual(
      fixture.students.map((student) => student.id).sort()
    )
  })

  it("生徒表示を外した学級は母集団に載らない", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })
    await testPrisma.examClassroom.update({
      where: { id: fixture.examClassroom.id },
      data: { studentReport: false },
    })

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    expect(result.population!.classrooms).toHaveLength(0)
  })

  it("main は統計を算出しない（母集団と元データだけを返す）", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
    })

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    // 平均・偏差値・順位・箱ひげ図は renderer（computeReportData）の担当。
    // main が算出して返していた頃の形が復活していないことを固定する
    const report = result.reports![0] as unknown as Record<string, unknown>
    expect(report.statistics).toBeUndefined()
    expect(
      (result.population as unknown as Record<string, unknown>).overall
    ).toBeUndefined()
  })

  it("試験タグと試験名を返す", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeV140Data: true,
    })

    const result = await fetchReport(
      fixture.exam.id,
      fixture.examStudents.map((examStudent) => examStudent.id)
    )

    expect(result.examInfo!.examName).toBe(fixture.exam.examName)
    expect(Array.isArray(result.examInfo!.tags)).toBe(true)
  })

  it("存在しない試験ではエラーを返す", async () => {
    const result = await fetchReport("non-existent-exam", [])

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
