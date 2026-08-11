/**
 * 書き出しの採番学級（学年・学級名・出席番号）が実際に反映されることの固定。
 *
 * `studentPlacements` は renderer が採番解決して main へ渡すマップで、**キーは Student.id**
 * （学級所属 StudentClassroomMembership は人に紐づくため）。採点層を ExamStudent 経由へ
 * 配線変更したとき、この引き当てまで機械的に `examStudent.id` へ変えてしまうと、
 * `Record<string, StudentExportPlacement>` は型が何も言わないので typecheck は通り、
 * 実行時だけ全件ミスして memberships[0] へ黙ってフォールバックする
 * （＝Excel と個人成績表の学級名・出席番号が誤ったまま配布される）。
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

import { fetchExportData } from "@/electron-src/lib/export/excel/dataFetcher"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

describe("書き出しの採番学級の引き当て", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("Student.id キーの studentPlacements が出力へ反映される", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: true,
    })
    const [examStudent] = fixture.examStudents
    const [student] = fixture.students

    const result = await fetchExportData(
      fixture.exam.id,
      [examStudent.id],
      // renderer が渡す形（キーは人としての生徒ID）
      {
        [student.id]: {
          grade: 3,
          className: "3年A組",
          attendanceNumber: 7,
        },
      }
    )

    const [scoringData] = result.scoringData
    expect(scoringData.grade).toBe("3")
    expect(scoringData.className).toBe("3年A組")
    expect(scoringData.attendanceNumber).toBe(7)
  })

  it("受験者IDをキーにしたマップは引き当たらない（取り違えの検知）", async () => {
    const fixture = await createFullTestExam(testPrisma, {
      studentCount: 1,
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: true,
    })
    const [examStudent] = fixture.examStudents

    const result = await fetchExportData(fixture.exam.id, [examStudent.id], {
      [examStudent.id]: {
        grade: 3,
        className: "3年A組",
        attendanceNumber: 7,
      },
    })

    const [scoringData] = result.scoringData
    // 引き当たらず memberships[0] へフォールバックするので、渡した値にはならない
    expect(scoringData.className).not.toBe("3年A組")
    expect(scoringData.attendanceNumber).not.toBe(7)
  })
})
