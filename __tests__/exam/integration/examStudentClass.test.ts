/**
 * Exam の生徒・学級 在籍フィルタ統合テスト
 *
 * examDate を基準日とした在籍判定（activeOnly）と、0名学級の非表示を検証する。
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

import { addStudentsFromClass } from "@/electron-src/lib/prisma/examClass"
import {
  getClassesNotInExam,
  getStudentsForExam,
  getStudentsNotInExam,
} from "@/electron-src/lib/prisma/examStudent"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/**
 * examDate=2024-04-10 の試験と、在籍中/在籍終了の生徒を持つ学級を作成
 */
async function createTestData() {
  const exam = await testPrisma.exam.create({
    data: { examName: "テスト試験", examDate: new Date("2024-04-10") },
  })

  const classA = await testPrisma.class.create({
    data: { name: "3年A組", grade: 3 },
  })

  // 在籍中（endDate なし）
  const active = await testPrisma.student.create({
    data: {
      studentNumber: "E001",
      lastName: "在籍",
      firstName: "太郎",
      lastNameKana: "ザイセキ",
      firstNameKana: "タロウ",
    },
  })
  // examDate より前に在籍終了（転出）
  const left = await testPrisma.student.create({
    data: {
      studentNumber: "E002",
      lastName: "転出",
      firstName: "花子",
      lastNameKana: "テンシュツ",
      firstNameKana: "ハナコ",
    },
  })

  await testPrisma.studentClassMembership.create({
    data: {
      studentId: active.id,
      classId: classA.id,
      attendanceNumber: 1,
      startDate: new Date("2024-04-01"), // examDate(2024-04-10)より前に開始
    },
  })
  await testPrisma.studentClassMembership.create({
    data: {
      studentId: left.id,
      classId: classA.id,
      attendanceNumber: 2,
      startDate: new Date("2023-04-01"),
      endDate: new Date("2024-03-31"), // examDate(2024-04-10)より前に終了
    },
  })

  return { exam, classA, active, left }
}

describe("Exam 在籍フィルタ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("addStudentsFromClass", () => {
    it("activeOnly=true は examDate 時点で在籍中の生徒のみ追加する", async () => {
      const { exam, classA } = await createTestData()

      const result = await addStudentsFromClass(exam.id, classA.id, true)

      // 在籍中の active のみ（転出済みの left は除外）
      expect(result.added).toBe(1)

      const students = await getStudentsForExam(exam.id)
      expect(students.students).toHaveLength(1)
      expect(students.students![0].studentNumber).toBe("E001")
    })

    it("activeOnly=false は在籍終了の生徒も追加する", async () => {
      const { exam, classA } = await createTestData()

      const result = await addStudentsFromClass(exam.id, classA.id, false)

      expect(result.added).toBe(2)
    })
  })

  describe("getClassesNotInExam", () => {
    it("activeOnly=true は在籍中の生徒数で0名学級を非表示にする", async () => {
      const { exam, classA, left } = await createTestData()

      // active を退会させ、在籍中0名にする（left は転出済み）
      await testPrisma.studentClassMembership.deleteMany({
        where: { classId: classA.id, studentId: { not: left.id } },
      })

      const activeResult = await getClassesNotInExam(exam.id, true)
      expect(activeResult.classes!.map((c) => c.name)).not.toContain("3年A組")

      const allResult = await getClassesNotInExam(exam.id, false)
      expect(allResult.classes!.map((c) => c.name)).toContain("3年A組")
    })
  })

  describe("将来始まる所属（基準日より後に入学/転入）", () => {
    /** examDate(2024-04-10) より後に始まる所属を持つ生徒を classA に追加 */
    async function addFutureStudent(classId: string) {
      const future = await testPrisma.student.create({
        data: {
          studentNumber: "E003",
          lastName: "転入",
          firstName: "次郎",
          lastNameKana: "テンニュウ",
          firstNameKana: "ジロウ",
        },
      })
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: future.id,
          classId,
          attendanceNumber: 3,
          startDate: new Date("2024-05-01"), // examDate より後に開始
          endDate: null,
        },
      })
      return { future }
    }

    it("activeOnly=true は将来始まる所属の生徒を追加しない", async () => {
      const { exam, classA } = await createTestData()
      await addFutureStudent(classA.id)

      const result = await addStudentsFromClass(exam.id, classA.id, true)

      // 在籍中の active のみ。転入予定(E003)も転出済み(E002)も除外
      expect(result.added).toBe(1)
      const students = await getStudentsForExam(exam.id)
      expect(students.students!.map((s) => s.studentNumber)).toEqual(["E001"])
    })

    it("activeOnly=true の個別追加候補に将来始まる所属の生徒は含まれない", async () => {
      const { exam, classA } = await createTestData()
      await addFutureStudent(classA.id)

      const result = await getStudentsNotInExam(exam.id, true)

      expect(result.students!.map((s) => s.studentNumber)).toEqual(["E001"])
    })

    it("activeOnly=false なら将来始まる所属の生徒も対象になる", async () => {
      const { exam, classA } = await createTestData()
      await addFutureStudent(classA.id)

      const result = await getStudentsNotInExam(exam.id, false)

      const numbers = result.students!.map((s) => s.studentNumber).sort()
      expect(numbers).toEqual(["E001", "E002", "E003"])
    })
  })

  describe("getStudentsNotInExam", () => {
    it("activeOnly=true は在籍中の所属がある生徒のみ返す", async () => {
      const { exam } = await createTestData()

      const result = await getStudentsNotInExam(exam.id, true)

      expect(result.success).toBe(true)
      expect(result.students!.map((s) => s.studentNumber)).toEqual(["E001"])
    })

    it("activeOnly=false は在籍終了の生徒も返す", async () => {
      const { exam } = await createTestData()

      const result = await getStudentsNotInExam(exam.id, false)

      const numbers = result.students!.map((s) => s.studentNumber).sort()
      expect(numbers).toEqual(["E001", "E002"])
    })

    it("既に試験へ追加済みの生徒は候補から除外される", async () => {
      const { exam, classA } = await createTestData()
      await addStudentsFromClass(exam.id, classA.id, true)

      const result = await getStudentsNotInExam(exam.id, true)

      // active は追加済みなので候補に残らない
      expect(result.students).toHaveLength(0)
    })
  })
})
