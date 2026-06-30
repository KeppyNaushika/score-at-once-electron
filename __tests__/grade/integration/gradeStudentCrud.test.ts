/**
 * GradeStudent / GradeClass 統合テスト
 *
 * 学級登録・生徒一括追加・並び順変更・学級削除を検証
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
  addStudentsFromClassToGrade,
  addStudentsToGrade,
  getAvailableClassesForGrade,
  getAvailableStudentsForGrade,
  getGradeClasses,
  getGradeClassRemovalPreview,
  getStudentsByGradeId,
  removeClassFromGrade,
  setGradeClassOrders,
  updateGradeStudentOrders,
} from "@/electron-src/lib/prisma/gradeStudent"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** テスト用のGrade + Class + Students を作成するヘルパー */
async function createTestData() {
  const grade = await testPrisma.grade.create({
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

  return { grade, classA, classB, student1, student2, student3 }
}

describe("GradeStudent / GradeClass", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("addStudentsFromClassToGrade", () => {
    it("学級から生徒を一括追加できる", async () => {
      const { grade, classA } = await createTestData()

      const result = await addStudentsFromClassToGrade(grade.id, classA.id)

      expect(result.success).toBe(true)
      expect(result.added).toBe(2)
      expect(result.skipped).toBe(0)
    })

    it("既に追加済みの生徒はスキップされる", async () => {
      const { grade, classA } = await createTestData()

      await addStudentsFromClassToGrade(grade.id, classA.id)
      const result = await addStudentsFromClassToGrade(grade.id, classA.id)

      expect(result.success).toBe(true)
      expect(result.added).toBe(0)
      expect(result.skipped).toBe(2)
    })

    it("GradeClassが作成される", async () => {
      const { grade, classA } = await createTestData()

      await addStudentsFromClassToGrade(grade.id, classA.id)

      const classes = await getGradeClasses(grade.id)
      expect(classes.success).toBe(true)
      expect(classes.classes).toHaveLength(1)
      expect(classes.classes![0].className).toBe("1年A組")
    })

    it("複数学級の追加でorderが正しく設定される", async () => {
      const { grade, classA, classB } = await createTestData()

      await addStudentsFromClassToGrade(grade.id, classA.id)
      await addStudentsFromClassToGrade(grade.id, classB.id)

      const classes = await getGradeClasses(grade.id)
      expect(classes.classes).toHaveLength(2)
      expect(classes.classes![0].order).toBe(0)
      expect(classes.classes![1].order).toBe(1)
    })

    it("customOrderが出席番号順で連番になる", async () => {
      const { grade, classA } = await createTestData()

      await addStudentsFromClassToGrade(grade.id, classA.id)

      const students = await getStudentsByGradeId(grade.id)
      expect(students.success).toBe(true)
      expect(students.students).toHaveLength(2)
      expect(students.students![0].customOrder).toBe(1)
      expect(students.students![1].customOrder).toBe(2)
    })
  })

  describe("getStudentsByGradeId", () => {
    it("生徒一覧を取得できる", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await getStudentsByGradeId(grade.id)

      expect(result.success).toBe(true)
      expect(result.students).toHaveLength(2)
      expect(result.students![0].student.lastName).toBe("山田")
    })

    it("生徒0人の場合は空配列を返す", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "空PJ" },
      })

      const result = await getStudentsByGradeId(grade.id)

      expect(result.success).toBe(true)
      expect(result.students).toHaveLength(0)
    })

    it("memberships情報が含まれる", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await getStudentsByGradeId(grade.id)

      expect(result.students![0].student.memberships.length).toBeGreaterThan(0)
      expect(result.students![0].student.memberships[0].class.name).toBe(
        "1年A組"
      )
    })
  })

  describe("getGradeClasses", () => {
    it("登録学級一覧を取得できる", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await getGradeClasses(grade.id)

      expect(result.success).toBe(true)
      expect(result.classes).toHaveLength(1)
      expect(result.classes![0].className).toBe("1年A組")
      expect(result.classes![0].studentCount).toBe(2)
    })
  })

  describe("getAvailableClassesForGrade", () => {
    it("未登録の学級一覧を取得できる", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await getAvailableClassesForGrade(grade.id)

      expect(result.success).toBe(true)
      // classAは登録済みなので、classBのみ
      expect(result.classes).toHaveLength(1)
      expect(result.classes![0].name).toBe("1年B組")
    })

    it("全学級が登録済みのとき空配列を返す", async () => {
      const { grade, classA, classB } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)
      await addStudentsFromClassToGrade(grade.id, classB.id)

      const result = await getAvailableClassesForGrade(grade.id)

      expect(result.success).toBe(true)
      expect(result.classes).toHaveLength(0)
    })
  })

  describe("addStudentsToGrade（個別追加）", () => {
    it("生徒を個別に追加できる", async () => {
      const { grade, student3 } = await createTestData()

      const result = await addStudentsToGrade(grade.id, [student3.id])

      expect(result.success).toBe(true)
      expect(result.addedCount).toBe(1)
      expect(result.skippedCount).toBe(0)

      const students = await getStudentsByGradeId(grade.id)
      expect(students.students).toHaveLength(1)
      expect(students.students![0].student.lastName).toBe("鈴木")
    })

    it("既に追加済みの生徒はスキップされる", async () => {
      const { grade, student3 } = await createTestData()

      await addStudentsToGrade(grade.id, [student3.id])
      const result = await addStudentsToGrade(grade.id, [student3.id])

      expect(result.addedCount).toBe(0)
      expect(result.skippedCount).toBe(1)
    })

    it("customOrderが既存の末尾に連番で付与される", async () => {
      const { grade, classA, student3 } = await createTestData()

      // 学級から2名追加（customOrder 1,2）
      await addStudentsFromClassToGrade(grade.id, classA.id)
      // 個別で student3 を追加 → customOrder 3
      await addStudentsToGrade(grade.id, [student3.id])

      const students = await getStudentsByGradeId(grade.id)
      const target = students.students!.find((s) => s.studentId === student3.id)
      expect(target?.customOrder).toBe(3)
    })
  })

  describe("getAvailableStudentsForGrade（個別追加候補）", () => {
    /** 未所属の生徒と、所属が終了済みの生徒を追加する */
    async function addEdgeCaseStudents(classId: string) {
      const noMembership = await testPrisma.student.create({
        data: {
          studentNumber: "S100",
          lastName: "未所属",
          firstName: "太郎",
          lastNameKana: "ミショゾク",
          firstNameKana: "タロウ",
        },
      })
      const ended = await testPrisma.student.create({
        data: {
          studentNumber: "S101",
          lastName: "卒業",
          firstName: "花子",
          lastNameKana: "ソツギョウ",
          firstNameKana: "ハナコ",
        },
      })
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: ended.id,
          classId,
          attendanceNumber: 50,
          startDate: new Date("2019-04-01"),
          endDate: new Date("2020-03-31"),
        },
      })
      return { noMembership, ended }
    }

    it("activeOnly=true は在籍中の所属がある生徒のみ返す", async () => {
      const { grade, classA } = await createTestData()
      await addEdgeCaseStudents(classA.id)

      const result = await getAvailableStudentsForGrade(grade.id, true)

      expect(result.success).toBe(true)
      // student1,2,3 のみ（未所属・卒業済みは除外）
      expect(result.students).toHaveLength(3)
      const numbers = result.students!.map((s) => s.studentNumber).sort()
      expect(numbers).toEqual(["S001", "S002", "S003"])
    })

    it("activeOnly=false は未所属・在籍終了の生徒も含む", async () => {
      const { grade, classA } = await createTestData()
      await addEdgeCaseStudents(classA.id)

      const result = await getAvailableStudentsForGrade(grade.id, false)

      expect(result.success).toBe(true)
      // 3 + 未所属 + 卒業済み = 5
      expect(result.students).toHaveLength(5)
    })

    it("既に成績へ追加済みの生徒は候補から除外される", async () => {
      const { grade, classA } = await createTestData()
      // classAの student1,2 を追加
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await getAvailableStudentsForGrade(grade.id, true)

      // 残りは student3 のみ
      expect(result.students).toHaveLength(1)
      expect(result.students![0].studentNumber).toBe("S003")
    })

    it("activeOnly=true は基準日より後に始まる所属の生徒を除外する", async () => {
      // referenceDate(2024-04-01) を基準に、開始済み/将来開始の生徒を判定する
      const grade = await testPrisma.grade.create({
        data: { name: "基準日PJ", referenceDate: new Date("2024-04-01") },
      })
      const classX = await testPrisma.class.create({
        data: { name: "2年X組", grade: 2 },
      })
      // 基準日より前に開始済み（在籍中）
      const current = await testPrisma.student.create({
        data: {
          studentNumber: "S301",
          lastName: "在籍",
          firstName: "太郎",
          lastNameKana: "ザイセキ",
          firstNameKana: "タロウ",
        },
      })
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: current.id,
          classId: classX.id,
          attendanceNumber: 1,
          startDate: new Date("2023-04-01"),
          endDate: null,
        },
      })
      // 基準日より後に開始（転入予定）
      const future = await testPrisma.student.create({
        data: {
          studentNumber: "S300",
          lastName: "転入",
          firstName: "三郎",
          lastNameKana: "テンニュウ",
          firstNameKana: "サブロウ",
        },
      })
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: future.id,
          classId: classX.id,
          attendanceNumber: 60,
          startDate: new Date("2024-05-01"), // 基準日より後に開始
          endDate: null,
        },
      })

      const activeResult = await getAvailableStudentsForGrade(grade.id, true)
      const activeNumbers = activeResult.students!.map((s) => s.studentNumber)
      // 在籍中の S301 のみ。将来開始の S300 は除外
      expect(activeNumbers).toContain("S301")
      expect(activeNumbers).not.toContain("S300")

      const allResult = await getAvailableStudentsForGrade(grade.id, false)
      // activeOnly=false なら将来開始の生徒も含む
      expect(allResult.students!.map((s) => s.studentNumber)).toContain("S300")
    })
  })

  describe("getAvailableClassesForGrade（在籍フィルタ）", () => {
    it("在籍中の生徒が0名の学級は activeOnly=true で非表示", async () => {
      const { grade } = await createTestData()

      // 在籍終了済みの生徒だけが所属する学級C
      const classC = await testPrisma.class.create({
        data: { name: "1年C組", grade: 1 },
      })
      const alum = await testPrisma.student.create({
        data: {
          studentNumber: "S200",
          lastName: "退学",
          firstName: "次郎",
          lastNameKana: "タイガク",
          firstNameKana: "ジロウ",
        },
      })
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: alum.id,
          classId: classC.id,
          attendanceNumber: 1,
          startDate: new Date("2019-04-01"),
          endDate: new Date("2020-03-31"),
        },
      })

      const activeResult = await getAvailableClassesForGrade(grade.id, true)
      const activeNames = activeResult.classes!.map((c) => c.name)
      // classC は在籍中0名なので非表示（classA, classB は表示）
      expect(activeNames).not.toContain("1年C組")
      expect(activeNames).toEqual(expect.arrayContaining(["1年A組", "1年B組"]))

      const allResult = await getAvailableClassesForGrade(grade.id, false)
      const allNames = allResult.classes!.map((c) => c.name)
      // activeOnly=false なら在籍終了の生徒も数えるので classC も表示
      expect(allNames).toContain("1年C組")
    })
  })

  describe("updateGradeStudentOrders", () => {
    it("生徒の並び順を更新できる", async () => {
      const { grade, classA, student1, student2 } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      // student2を先頭に
      const result = await updateGradeStudentOrders(grade.id, [
        { studentId: student2.id, customOrder: 1 },
        { studentId: student1.id, customOrder: 2 },
      ])

      expect(result.success).toBe(true)

      const students = await getStudentsByGradeId(grade.id)
      expect(students.students![0].student.lastName).toBe("佐藤")
      expect(students.students![1].student.lastName).toBe("山田")
    })
  })

  describe("removeClassFromGrade", () => {
    it("学級を削除すると関連する生徒も削除される", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await removeClassFromGrade(grade.id, classA.id)

      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(2)

      const students = await getStudentsByGradeId(grade.id)
      expect(students.students).toHaveLength(0)
    })

    it("他の学級にも所属する生徒は削除されない", async () => {
      const { grade, classA, classB, student1 } = await createTestData()

      // student1をclassBにも所属させる
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: student1.id,
          classId: classB.id,
          attendanceNumber: 99,
        },
      })

      await addStudentsFromClassToGrade(grade.id, classA.id)
      await addStudentsFromClassToGrade(grade.id, classB.id)

      // classAを削除
      const result = await removeClassFromGrade(grade.id, classA.id)

      expect(result.success).toBe(true)
      // student1はclassBにも属しているので削除されない、student2のみ削除
      expect(result.removedStudents).toBe(1)

      const students = await getStudentsByGradeId(grade.id)
      // student1（classAとclassBに所属）+ student3（classBのみ） = 2人残る
      expect(students.students!.length).toBe(2)
    })

    it("削除後にGradeClassも削除される", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      await removeClassFromGrade(grade.id, classA.id)

      const classes = await getGradeClasses(grade.id)
      expect(classes.classes).toHaveLength(0)
    })

    it("deleteStudents=false なら登録解除のみで生徒は残る", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const result = await removeClassFromGrade(grade.id, classA.id, false)

      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(0)

      // GradeClass は外れるが、生徒は対象に残る
      const classes = await getGradeClasses(grade.id)
      expect(classes.classes).toHaveLength(0)
      const students = await getStudentsByGradeId(grade.id)
      expect(students.students).toHaveLength(2)
    })
  })

  describe("getGradeClassRemovalPreview", () => {
    it("専属生徒（この学級にのみ所属）の数を返す", async () => {
      const { grade, classA } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)

      const preview = await getGradeClassRemovalPreview(grade.id, classA.id)

      expect(preview.success).toBe(true)
      // classA の student1,2 は他学級に属さない → 2名が削除対象
      expect(preview.exclusiveCount).toBe(2)
    })

    it("他学級にも所属する生徒は削除対象に数えない", async () => {
      const { grade, classA, classB, student1 } = await createTestData()
      await testPrisma.studentClassMembership.create({
        data: {
          studentId: student1.id,
          classId: classB.id,
          attendanceNumber: 99,
        },
      })
      await addStudentsFromClassToGrade(grade.id, classA.id)
      await addStudentsFromClassToGrade(grade.id, classB.id)

      const preview = await getGradeClassRemovalPreview(grade.id, classA.id)

      // student1 は classB にも属するため、classA 専属は student2 のみ
      expect(preview.exclusiveCount).toBe(1)
    })
  })

  describe("setGradeClassOrders", () => {
    it("学級の並び順を更新できる", async () => {
      const { grade, classA, classB } = await createTestData()
      await addStudentsFromClassToGrade(grade.id, classA.id)
      await addStudentsFromClassToGrade(grade.id, classB.id)

      // 初期は classA(0), classB(1)。逆順にする
      const result = await setGradeClassOrders(grade.id, [classB.id, classA.id])
      expect(result.success).toBe(true)

      const classes = await getGradeClasses(grade.id)
      const byName = new Map(
        classes.classes!.map((c) => [c.className, c.order])
      )
      expect(byName.get("1年B組")).toBe(0)
      expect(byName.get("1年A組")).toBe(1)
    })
  })
})
