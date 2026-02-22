/**
 * GradeProjectStudent / GradeProjectClass 統合テスト
 *
 * 学級登録・生徒一括追加・並び順変更・学級削除を検証
 */

import { PrismaClient } from "@prisma/client"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("@/electron-src/lib/prisma/client", () => {
  const { PrismaClient: PC } = require("@prisma/client")
  const p = path.resolve(__dirname, "../../../data/test-database.db")
  const client = new PC({
    datasources: { db: { url: `file:${p}` } },
    log: ["error"],
  })
  return { default: client }
})

import {
  cleanupTestDatabase,
  disconnectTestPrisma,
} from "@/__tests__/helpers/testPrismaClient"
import {
  addStudentsFromClassToGradeProject,
  getAvailableClassesForGradeProject,
  getGradeProjectClasses,
  getStudentsByGradeProjectId,
  removeClassFromGradeProject,
  updateGradeProjectStudentOrders,
} from "@/electron-src/lib/prisma/gradeProjectStudent"

const testPrisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB_PATH}` } },
  log: ["error"],
})

/** テスト用のGradeProject + Class + Students を作成するヘルパー */
async function createTestData() {
  const gradeProject = await testPrisma.gradeProject.create({
    data: { name: "テスト成績PJ" },
  })

  const classA = await testPrisma.class.create({
    data: { name: "1年A組", grade: 1 },
  })

  const classB = await testPrisma.class.create({
    data: { name: "1年B組", grade: 1 },
  })

  const student1 = await testPrisma.student.create({
    data: {
      studentNumber: "S001",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })

  const student2 = await testPrisma.student.create({
    data: {
      studentNumber: "S002",
      lastName: "佐藤",
      firstName: "花子",
      lastNameKana: "サトウ",
      firstNameKana: "ハナコ",
    },
  })

  const student3 = await testPrisma.student.create({
    data: {
      studentNumber: "S003",
      lastName: "鈴木",
      firstName: "一郎",
      lastNameKana: "スズキ",
      firstNameKana: "イチロウ",
    },
  })

  // classAに student1, student2 を所属させる
  await testPrisma.studentClassMembership.create({
    data: {
      studentId: student1.id,
      classId: classA.id,
      attendanceNumber: 1,
    },
  })
  await testPrisma.studentClassMembership.create({
    data: {
      studentId: student2.id,
      classId: classA.id,
      attendanceNumber: 2,
    },
  })

  // classBに student3 を所属させる
  await testPrisma.studentClassMembership.create({
    data: {
      studentId: student3.id,
      classId: classB.id,
      attendanceNumber: 1,
    },
  })

  return { gradeProject, classA, classB, student1, student2, student3 }
}

describe("GradeProjectStudent / GradeProjectClass", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("addStudentsFromClassToGradeProject", () => {
    it("学級から生徒を一括追加できる", async () => {
      const { gradeProject, classA } = await createTestData()

      const result = await addStudentsFromClassToGradeProject(
        gradeProject.id,
        classA.id
      )

      expect(result.success).toBe(true)
      expect(result.added).toBe(2)
      expect(result.skipped).toBe(0)
    })

    it("既に追加済みの生徒はスキップされる", async () => {
      const { gradeProject, classA } = await createTestData()

      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)
      const result = await addStudentsFromClassToGradeProject(
        gradeProject.id,
        classA.id
      )

      expect(result.success).toBe(true)
      expect(result.added).toBe(0)
      expect(result.skipped).toBe(2)
    })

    it("GradeProjectClassが作成される", async () => {
      const { gradeProject, classA } = await createTestData()

      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const classes = await getGradeProjectClasses(gradeProject.id)
      expect(classes.success).toBe(true)
      expect(classes.classes).toHaveLength(1)
      expect(classes.classes![0].className).toBe("1年A組")
    })

    it("複数学級の追加でorderが正しく設定される", async () => {
      const { gradeProject, classA, classB } = await createTestData()

      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)
      await addStudentsFromClassToGradeProject(gradeProject.id, classB.id)

      const classes = await getGradeProjectClasses(gradeProject.id)
      expect(classes.classes).toHaveLength(2)
      expect(classes.classes![0].order).toBe(0)
      expect(classes.classes![1].order).toBe(1)
    })

    it("customOrderが出席番号順で連番になる", async () => {
      const { gradeProject, classA } = await createTestData()

      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const students = await getStudentsByGradeProjectId(gradeProject.id)
      expect(students.success).toBe(true)
      expect(students.students).toHaveLength(2)
      expect(students.students![0].customOrder).toBe(1)
      expect(students.students![1].customOrder).toBe(2)
    })
  })

  describe("getStudentsByGradeProjectId", () => {
    it("生徒一覧を取得できる", async () => {
      const { gradeProject, classA } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const result = await getStudentsByGradeProjectId(gradeProject.id)

      expect(result.success).toBe(true)
      expect(result.students).toHaveLength(2)
      expect(result.students![0].student.lastName).toBe("山田")
    })

    it("生徒0人の場合は空配列を返す", async () => {
      const gradeProject = await testPrisma.gradeProject.create({
        data: { name: "空PJ" },
      })

      const result = await getStudentsByGradeProjectId(gradeProject.id)

      expect(result.success).toBe(true)
      expect(result.students).toHaveLength(0)
    })

    it("memberships情報が含まれる", async () => {
      const { gradeProject, classA } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const result = await getStudentsByGradeProjectId(gradeProject.id)

      expect(result.students![0].student.memberships.length).toBeGreaterThan(0)
      expect(result.students![0].student.memberships[0].class.name).toBe(
        "1年A組"
      )
    })
  })

  describe("getGradeProjectClasses", () => {
    it("登録学級一覧を取得できる", async () => {
      const { gradeProject, classA } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const result = await getGradeProjectClasses(gradeProject.id)

      expect(result.success).toBe(true)
      expect(result.classes).toHaveLength(1)
      expect(result.classes![0].className).toBe("1年A組")
      expect(result.classes![0].studentCount).toBe(2)
    })
  })

  describe("getAvailableClassesForGradeProject", () => {
    it("未登録の学級一覧を取得できる", async () => {
      const { gradeProject, classA } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const result = await getAvailableClassesForGradeProject(gradeProject.id)

      expect(result.success).toBe(true)
      // classAは登録済みなので、classBのみ
      expect(result.classes).toHaveLength(1)
      expect(result.classes![0].name).toBe("1年B組")
    })

    it("全学級が登録済みのとき空配列を返す", async () => {
      const { gradeProject, classA, classB } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)
      await addStudentsFromClassToGradeProject(gradeProject.id, classB.id)

      const result = await getAvailableClassesForGradeProject(gradeProject.id)

      expect(result.success).toBe(true)
      expect(result.classes).toHaveLength(0)
    })
  })

  describe("updateGradeProjectStudentOrders", () => {
    it("生徒の並び順を更新できる", async () => {
      const { gradeProject, classA, student1, student2 } =
        await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      // student2を先頭に
      const result = await updateGradeProjectStudentOrders(gradeProject.id, [
        { studentId: student2.id, customOrder: 1 },
        { studentId: student1.id, customOrder: 2 },
      ])

      expect(result.success).toBe(true)

      const students = await getStudentsByGradeProjectId(gradeProject.id)
      expect(students.students![0].student.lastName).toBe("佐藤")
      expect(students.students![1].student.lastName).toBe("山田")
    })
  })

  describe("removeClassFromGradeProject", () => {
    it("学級を削除すると関連する生徒も削除される", async () => {
      const { gradeProject, classA } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      const result = await removeClassFromGradeProject(
        gradeProject.id,
        classA.id
      )

      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(2)

      const students = await getStudentsByGradeProjectId(gradeProject.id)
      expect(students.students).toHaveLength(0)
    })

    it("他の学級にも所属する生徒は削除されない", async () => {
      const { gradeProject, classA, classB, student1 } = await createTestData()

      // student1をclassBにも所属させる
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: student1.id,
          classId: classB.id,
          attendanceNumber: 99,
        },
      })

      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)
      await addStudentsFromClassToGradeProject(gradeProject.id, classB.id)

      // classAを削除
      const result = await removeClassFromGradeProject(
        gradeProject.id,
        classA.id
      )

      expect(result.success).toBe(true)
      // student1はclassBにも属しているので削除されない、student2のみ削除
      expect(result.removedStudents).toBe(1)

      const students = await getStudentsByGradeProjectId(gradeProject.id)
      // student1（classAとclassBに所属）+ student3（classBのみ） = 2人残る
      expect(students.students!.length).toBe(2)
    })

    it("削除後にGradeProjectClassも削除される", async () => {
      const { gradeProject, classA } = await createTestData()
      await addStudentsFromClassToGradeProject(gradeProject.id, classA.id)

      await removeClassFromGradeProject(gradeProject.id, classA.id)

      const classes = await getGradeProjectClasses(gradeProject.id)
      expect(classes.classes).toHaveLength(0)
    })
  })
})
