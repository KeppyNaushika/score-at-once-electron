/**
 * GradeStudent / GradeClassroom 統合テスト
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
  addStudentsFromClassroomToGrade,
  addStudentsToGrade,
  getAvailableClassroomsForGrade,
  getAvailableStudentsForGrade,
  getGradeClassroomRemovalPreview,
  getGradeClassrooms,
  getStudentsByGradeId,
  removeClassroomFromGrade,
  setGradeClassroomOrders,
  updateGradeStudentOrders,
} from "@/electron-src/lib/prisma/gradeStudent"

import { SAW_ALL_DELETION_COUNTS } from "../../helpers/deletionCounts"
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

  const classroomA = await testPrisma.classroom.create({
    data: { name: "1年A組", grade: 1 },
  })

  const classroomB = await testPrisma.classroom.create({
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

  // classroomAに student1, student2 を所属させる
  await testPrisma.studentClassroomMembership.create({
    data: {
      studentId: student1.id,
      classroomId: classroomA.id,
      attendanceNumber: 1,
    },
  })
  await testPrisma.studentClassroomMembership.create({
    data: {
      studentId: student2.id,
      classroomId: classroomA.id,
      attendanceNumber: 2,
    },
  })

  // classroomBに student3 を所属させる
  await testPrisma.studentClassroomMembership.create({
    data: {
      studentId: student3.id,
      classroomId: classroomB.id,
      attendanceNumber: 1,
    },
  })

  return { grade, classroomA, classroomB, student1, student2, student3 }
}

describe("GradeStudent / GradeClassroom", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  describe("addStudentsFromClassroomToGrade", () => {
    it("学級から生徒を一括追加できる", async () => {
      const { grade, classroomA } = await createTestData()

      const result = await addStudentsFromClassroomToGrade(
        grade.id,
        classroomA.id
      )
      expect(result.added).toBe(2)
      expect(result.skipped).toBe(0)
    })

    it("既に追加済みの生徒はスキップされる", async () => {
      const { grade, classroomA } = await createTestData()

      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      const result = await addStudentsFromClassroomToGrade(
        grade.id,
        classroomA.id
      )
      expect(result.added).toBe(0)
      expect(result.skipped).toBe(2)
    })

    it("GradeClassroomが作成される", async () => {
      const { grade, classroomA } = await createTestData()

      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const classrooms = await getGradeClassrooms(grade.id)
      expect(classrooms).toHaveLength(1)
      expect(classrooms[0].className).toBe("1年A組")
    })

    it("複数学級の追加でorderが正しく設定される", async () => {
      const { grade, classroomA, classroomB } = await createTestData()

      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      await addStudentsFromClassroomToGrade(grade.id, classroomB.id)

      const classrooms = await getGradeClassrooms(grade.id)
      expect(classrooms).toHaveLength(2)
      expect(classrooms[0].order).toBe(0)
      expect(classrooms[1].order).toBe(1)
    })

    it("customOrderが出席番号順で連番になる", async () => {
      const { grade, classroomA } = await createTestData()

      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const students = await getStudentsByGradeId(grade.id)
      expect(students).toHaveLength(2)
      expect(students[0].customOrder).toBe(1)
      expect(students[1].customOrder).toBe(2)
    })
  })

  describe("getStudentsByGradeId", () => {
    it("生徒一覧を取得できる", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await getStudentsByGradeId(grade.id)
      expect(result).toHaveLength(2)
      expect(result[0].student.lastName).toBe("山田")
    })

    it("生徒0人の場合は空配列を返す", async () => {
      const grade = await testPrisma.grade.create({
        data: { name: "空PJ" },
      })

      const result = await getStudentsByGradeId(grade.id)
      expect(result).toHaveLength(0)
    })

    it("memberships情報が含まれる", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await getStudentsByGradeId(grade.id)

      expect(result[0].student.memberships.length).toBeGreaterThan(0)
      expect(result[0].student.memberships[0].classroom.name).toBe("1年A組")
    })
  })

  describe("getGradeClassrooms", () => {
    it("登録学級一覧を取得できる", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await getGradeClassrooms(grade.id)
      expect(result).toHaveLength(1)
      expect(result[0].className).toBe("1年A組")
      expect(result[0].studentCount).toBe(2)
    })
  })

  describe("getAvailableClassroomsForGrade", () => {
    it("未登録の学級一覧を取得できる", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await getAvailableClassroomsForGrade(grade.id)
      // classroomAは登録済みなので、classroomBのみ
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("1年B組")
    })

    it("全学級が登録済みのとき空配列を返す", async () => {
      const { grade, classroomA, classroomB } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      await addStudentsFromClassroomToGrade(grade.id, classroomB.id)

      const result = await getAvailableClassroomsForGrade(grade.id)
      expect(result).toHaveLength(0)
    })
  })

  describe("addStudentsToGrade（個別追加）", () => {
    it("生徒を個別に追加できる", async () => {
      const { grade, student3 } = await createTestData()

      const result = await addStudentsToGrade(grade.id, [student3.id])
      expect(result.addedCount).toBe(1)
      expect(result.skippedCount).toBe(0)

      const students = await getStudentsByGradeId(grade.id)
      expect(students).toHaveLength(1)
      expect(students[0].student.lastName).toBe("鈴木")
    })

    it("既に追加済みの生徒はスキップされる", async () => {
      const { grade, student3 } = await createTestData()

      await addStudentsToGrade(grade.id, [student3.id])
      const result = await addStudentsToGrade(grade.id, [student3.id])

      expect(result.addedCount).toBe(0)
      expect(result.skippedCount).toBe(1)
    })

    it("customOrderが既存の末尾に連番で付与される", async () => {
      const { grade, classroomA, student3 } = await createTestData()

      // 学級から2名追加（customOrder 1,2）
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      // 個別で student3 を追加 → customOrder 3
      await addStudentsToGrade(grade.id, [student3.id])

      const students = await getStudentsByGradeId(grade.id)
      const target = students.find(
        (student) => student.studentId === student3.id
      )
      expect(target?.customOrder).toBe(3)
    })
  })

  describe("getAvailableStudentsForGrade（個別追加候補）", () => {
    /** 未所属の生徒と、所属が終了済みの生徒を追加する */
    async function addEdgeCaseStudents(classroomId: string) {
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
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: ended.id,
          classroomId,
          attendanceNumber: 50,
          startDate: new Date("2019-04-01"),
          endDate: new Date("2020-03-31"),
        },
      })
      return { noMembership, ended }
    }

    it("activeOnly=true は未在籍・在籍中の生徒を返す（過去在籍のみ除外）", async () => {
      const { grade, classroomA } = await createTestData()
      await addEdgeCaseStudents(classroomA.id)

      const result = await getAvailableStudentsForGrade(grade.id, true)
      // student1,2,3 + 未所属S100（過去在籍=卒業済みS101のみ除外）。
      // activeOnly は「未在籍または在籍中」を残し過去在籍だけを除外する仕様
      // （availableStudents.ts）。
      expect(result).toHaveLength(4)
      const numbers = result.map((student) => student.studentNumber).sort()
      expect(numbers).toEqual(["S001", "S002", "S003", "S100"])
    })

    it("activeOnly=false は未所属・在籍終了の生徒も含む", async () => {
      const { grade, classroomA } = await createTestData()
      await addEdgeCaseStudents(classroomA.id)

      const result = await getAvailableStudentsForGrade(grade.id, false)
      // 3 + 未所属 + 卒業済み = 5
      expect(result).toHaveLength(5)
    })

    it("既に成績へ追加済みの生徒は候補から除外される", async () => {
      const { grade, classroomA } = await createTestData()
      // classroomAの student1,2 を追加
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await getAvailableStudentsForGrade(grade.id, true)

      // 残りは student3 のみ
      expect(result).toHaveLength(1)
      expect(result[0].studentNumber).toBe("S003")
    })

    it("activeOnly=true は基準日より後に始まる所属の生徒を除外する", async () => {
      // referenceDate(2024-04-01) を基準に、開始済み/将来開始の生徒を判定する
      const grade = await testPrisma.grade.create({
        data: { name: "基準日PJ", referenceDate: new Date("2024-04-01") },
      })
      const classX = await testPrisma.classroom.create({
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
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: current.id,
          classroomId: classX.id,
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
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: future.id,
          classroomId: classX.id,
          attendanceNumber: 60,
          startDate: new Date("2024-05-01"), // 基準日より後に開始
          endDate: null,
        },
      })

      const activeResult = await getAvailableStudentsForGrade(grade.id, true)
      const activeNumbers = activeResult.map((student) => student.studentNumber)
      // 在籍中の S301 のみ。将来開始の S300 は除外
      expect(activeNumbers).toContain("S301")
      expect(activeNumbers).not.toContain("S300")

      const allResult = await getAvailableStudentsForGrade(grade.id, false)
      // activeOnly=false なら将来開始の生徒も含む
      expect(allResult.map((student) => student.studentNumber)).toContain(
        "S300"
      )
    })
  })

  describe("getAvailableClassroomsForGrade（在籍フィルタ）", () => {
    it("在籍中の生徒が0名の学級は activeOnly=true で非表示", async () => {
      const { grade } = await createTestData()

      // 在籍終了済みの生徒だけが所属する学級C
      const classC = await testPrisma.classroom.create({
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
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: alum.id,
          classroomId: classC.id,
          attendanceNumber: 1,
          startDate: new Date("2019-04-01"),
          endDate: new Date("2020-03-31"),
        },
      })

      const activeResult = await getAvailableClassroomsForGrade(grade.id, true)
      const activeNames = activeResult.map((classroom) => classroom.name)
      // classC は在籍中0名なので非表示（classroomA, classroomB は表示）
      expect(activeNames).not.toContain("1年C組")
      expect(activeNames).toEqual(expect.arrayContaining(["1年A組", "1年B組"]))

      const allResult = await getAvailableClassroomsForGrade(grade.id, false)
      const allNames = allResult.map((classroom) => classroom.name)
      // activeOnly=false なら在籍終了の生徒も数えるので classC も表示
      expect(allNames).toContain("1年C組")
    })
  })

  describe("updateGradeStudentOrders", () => {
    it("生徒の並び順を更新できる", async () => {
      const { grade, classroomA, student1, student2 } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      // student2を先頭に
      await updateGradeStudentOrders(grade.id, [
        { studentId: student2.id, customOrder: 1 },
        { studentId: student1.id, customOrder: 2 },
      ])

      const students = await getStudentsByGradeId(grade.id)
      expect(students[0].student.lastName).toBe("佐藤")
      expect(students[1].student.lastName).toBe("山田")
    })
  })

  describe("removeClassroomFromGrade", () => {
    it("学級を削除すると関連する生徒も削除される", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await removeClassroomFromGrade(
        grade.id,
        classroomA.id,
        true,
        SAW_ALL_DELETION_COUNTS
      )
      expect(result.removedStudents).toBe(2)

      const students = await getStudentsByGradeId(grade.id)
      expect(students).toHaveLength(0)
    })

    it("他の学級にも所属する生徒は削除されない", async () => {
      const { grade, classroomA, classroomB, student1 } = await createTestData()

      // student1をclassroomBにも所属させる
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: student1.id,
          classroomId: classroomB.id,
          attendanceNumber: 99,
        },
      })

      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      await addStudentsFromClassroomToGrade(grade.id, classroomB.id)

      // classroomAを削除
      const result = await removeClassroomFromGrade(
        grade.id,
        classroomA.id,
        true,
        SAW_ALL_DELETION_COUNTS
      )
      // student1はclassroomBにも属しているので削除されない、student2のみ削除
      expect(result.removedStudents).toBe(1)

      const students = await getStudentsByGradeId(grade.id)
      // student1（classroomAとclassroomBに所属）+ student3（classroomBのみ） = 2人残る
      expect(students.length).toBe(2)
    })

    it("削除後にGradeClassroomも削除される", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      await removeClassroomFromGrade(
        grade.id,
        classroomA.id,
        true,
        SAW_ALL_DELETION_COUNTS
      )

      const classrooms = await getGradeClassrooms(grade.id)
      expect(classrooms).toHaveLength(0)
    })

    it("deleteStudents=false なら登録解除のみで生徒は残る", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const result = await removeClassroomFromGrade(
        grade.id,
        classroomA.id,
        false,
        SAW_ALL_DELETION_COUNTS
      )
      expect(result.removedStudents).toBe(0)

      // GradeClassroom は外れるが、生徒は対象に残る
      const classrooms = await getGradeClassrooms(grade.id)
      expect(classrooms).toHaveLength(0)
      const students = await getStudentsByGradeId(grade.id)
      expect(students).toHaveLength(2)
    })
  })

  describe("getGradeClassroomRemovalPreview", () => {
    it("専属生徒（この学級にのみ所属）の数を返す", async () => {
      const { grade, classroomA } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)

      const preview = await getGradeClassroomRemovalPreview(
        grade.id,
        classroomA.id
      )
      // classroomA の student1,2 は他学級に属さない → 2名が削除対象
      expect(preview).toEqual([
        { countedName: "この学級にのみ所属する生徒", shownCount: 2 },
      ])
    })

    it("他学級にも所属する生徒は削除対象に数えない", async () => {
      const { grade, classroomA, classroomB, student1 } = await createTestData()
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: student1.id,
          classroomId: classroomB.id,
          attendanceNumber: 99,
        },
      })
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      await addStudentsFromClassroomToGrade(grade.id, classroomB.id)

      const preview = await getGradeClassroomRemovalPreview(
        grade.id,
        classroomA.id
      )

      // student1 は classroomB にも属するため、classroomA 専属は student2 のみ
      expect(preview).toEqual([
        { countedName: "この学級にのみ所属する生徒", shownCount: 1 },
      ])
    })
  })

  describe("setGradeClassroomOrders", () => {
    it("学級の並び順を更新できる", async () => {
      const { grade, classroomA, classroomB } = await createTestData()
      await addStudentsFromClassroomToGrade(grade.id, classroomA.id)
      await addStudentsFromClassroomToGrade(grade.id, classroomB.id)

      // 初期は classroomA(0), classroomB(1)。逆順にする
      await setGradeClassroomOrders(grade.id, [classroomB.id, classroomA.id])

      const classrooms = await getGradeClassrooms(grade.id)
      const byName = new Map(
        classrooms.map((classroom) => [classroom.className, classroom.order])
      )
      expect(byName.get("1年B組")).toBe(0)
      expect(byName.get("1年A組")).toBe(1)
    })
  })
})
