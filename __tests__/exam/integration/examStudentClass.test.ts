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

import {
  addStudentsFromClass,
  getClassMembersForExam,
  getStudentClassInfo,
  getStudentClassInfoForExam,
} from "@/electron-src/lib/prisma/examClass"
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

  const classA = await testPrisma.classroom.create({
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

  await testPrisma.studentClassroomMembership.create({
    data: {
      studentId: active.id,
      classroomId: classA.id,
      attendanceNumber: 1,
      startDate: new Date("2024-04-01"), // examDate(2024-04-10)より前に開始
    },
  })
  await testPrisma.studentClassroomMembership.create({
    data: {
      studentId: left.id,
      classroomId: classA.id,
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
      await testPrisma.studentClassroomMembership.deleteMany({
        where: { classroomId: classA.id, studentId: { not: left.id } },
      })

      const activeResult = await getClassesNotInExam(exam.id, true)
      expect(
        activeResult.classes!.map((classroom) => classroom.name)
      ).not.toContain("3年A組")

      const allResult = await getClassesNotInExam(exam.id, false)
      expect(allResult.classes!.map((classroom) => classroom.name)).toContain(
        "3年A組"
      )
    })
  })

  describe("将来始まる所属（基準日より後に入学/転入）", () => {
    /** examDate(2024-04-10) より後に始まる所属を持つ生徒を classA に追加 */
    async function addFutureStudent(classroomId: string) {
      const future = await testPrisma.student.create({
        data: {
          studentNumber: "E003",
          lastName: "転入",
          firstName: "次郎",
          lastNameKana: "テンニュウ",
          firstNameKana: "ジロウ",
        },
      })
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: future.id,
          classroomId,
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
      expect(
        students.students!.map((student) => student.studentNumber)
      ).toEqual(["E001"])
    })

    it("activeOnly=true の個別追加候補に将来始まる所属の生徒は含まれない", async () => {
      const { exam, classA } = await createTestData()
      await addFutureStudent(classA.id)

      const result = await getStudentsNotInExam(exam.id, true)

      expect(result.students!.map((student) => student.studentNumber)).toEqual([
        "E001",
      ])
    })

    it("activeOnly=false なら将来始まる所属の生徒も対象になる", async () => {
      const { exam, classA } = await createTestData()
      await addFutureStudent(classA.id)

      const result = await getStudentsNotInExam(exam.id, false)

      const numbers = result
        .students!.map((student) => student.studentNumber)
        .sort()
      expect(numbers).toEqual(["E001", "E002", "E003"])
    })
  })

  describe("getStudentsNotInExam", () => {
    it("activeOnly=true は在籍中の所属がある生徒のみ返す", async () => {
      const { exam } = await createTestData()

      const result = await getStudentsNotInExam(exam.id, true)

      expect(result.success).toBe(true)
      expect(result.students!.map((student) => student.studentNumber)).toEqual([
        "E001",
      ])
    })

    it("activeOnly=false は在籍終了の生徒も返す", async () => {
      const { exam } = await createTestData()

      const result = await getStudentsNotInExam(exam.id, false)

      const numbers = result
        .students!.map((student) => student.studentNumber)
        .sort()
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

  // P3修正: 在籍解決（採番・表示）も受験日基準で判定する
  describe("getStudentClassInfoForExam（受験日スナップショット）", () => {
    it("受験日時点で在籍する生徒のみ学級情報を解決する", async () => {
      const { exam, classA, active, left } = await createTestData()
      // administered=true の ExamClass を作る（両方を受験者に追加）
      await addStudentsFromClass(exam.id, classA.id, false)

      const info = await getStudentClassInfoForExam(exam.id)

      // 受験日(2024-04-10)に在籍中の active のみ解決。転出済み left は除外
      expect(Object.keys(info)).toEqual([active.id])
      expect(info[active.id].className).toBe("3年A組")
      expect(info[active.id].attendanceNumber).toBe(1)
      expect(info[left.id]).toBeUndefined()
    })

    it("getStudentClassInfo は受験日に在籍しない生徒へ null を返す", async () => {
      const { exam, classA, active, left } = await createTestData()
      await addStudentsFromClass(exam.id, classA.id, false)

      const activeInfo = await getStudentClassInfo(exam.id, active.id)
      expect(activeInfo.className).toBe("3年A組")
      expect(activeInfo.attendanceNumber).toBe(1)

      const leftInfo = await getStudentClassInfo(exam.id, left.id)
      expect(leftInfo.className).toBeNull()
      expect(leftInfo.attendanceNumber).toBeNull()
    })
  })

  // Phase 1: 登録学級ごとの集計エンジン（受験日基準・重複カウント）
  describe("getClassMembersForExam（集計エンジン）", () => {
    it("登録学級ごとに受験日所属生徒を返し、1人が複数学級に重複カウントされる", async () => {
      const { exam, classA, active, left } = await createTestData()

      // 第2学級（バスケ部）を作り、active を classA/classB の両方に所属させる
      const classB = await testPrisma.classroom.create({
        data: { name: "バスケ部", grade: 3 },
      })
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: active.id,
          classroomId: classB.id,
          attendanceNumber: 5,
          startDate: new Date("2024-04-01"),
        },
      })

      // 両学級を試験へ登録
      await addStudentsFromClass(exam.id, classA.id, false)
      await addStudentsFromClass(exam.id, classB.id, false)

      const members = await getClassMembersForExam(exam.id)
      const idsOf = (member: (typeof members)[number]) =>
        member.classroom.memberships.map((membership) => membership.studentId)

      const a = members.find((member) => member.classroomId === classA.id)!
      const b = members.find((member) => member.classroomId === classB.id)!

      // classA: 受験日在籍の active のみ（転出済み left は除外）
      expect(idsOf(a)).toEqual([active.id])
      // classB: active（複数学級に重複カウント）
      expect(idsOf(b)).toEqual([active.id])
      // left はどの学級の集計にも含まれない
      expect(members.flatMap(idsOf)).not.toContain(left.id)
      // 生徒ごと追加した学級は teacherStat / studentReport が true
      expect(a.teacherStat).toBe(true)
      expect(a.studentReport).toBe(true)
      expect(b.teacherStat).toBe(true)
    })
  })
})
