/**
 * Coursework（試験外成績資料）lib の統合テスト
 *
 * coursework.ts の CRUD・評価項目・点数 upsert・名簿操作・削除ブロックを検証する。
 */
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

import {
  addStudentsFromClassroomToCoursework,
  addStudentsToCoursework,
  batchUpsertCourseworkScores,
  createCoursework,
  createCourseworkItem,
  deleteCoursework,
  deleteCourseworkItem,
  getCourseworkById,
  getCourseworkCandidates,
  getCourseworkClassroomRemovalPreview,
  getCourseworkClassrooms,
  getCourseworks,
  getCourseworkScoresByItemId,
  getCourseworkStudents,
  removeClassroomFromCoursework,
  removeStudentsFromCoursework,
  setCourseworkClassroomOrders,
  updateCoursework,
  updateCourseworkItem,
  updateCourseworkStudentOrders,
} from "@/electron-src/lib/prisma/coursework"
import { createDataSource } from "@/electron-src/lib/prisma/gradeDataSource"
import { createGradeItem } from "@/electron-src/lib/prisma/gradeItem"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

async function createStudents() {
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
  return { student1, student2 }
}

describe("Coursework CRUD", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("資料を作成・取得・更新できる", async () => {
    const created = await createCoursework({
      name: "第2回レポート",
      description: "説明",
      date: "2026-06-01T00:00:00.000+00:00",
    })
    expect(created.success).toBe(true)
    const id = created.coursework!.id

    const fetched = await getCourseworkById(id)
    expect(fetched.success).toBe(true)
    expect(fetched.coursework!.name).toBe("第2回レポート")

    const updated = await updateCoursework(id, { name: "改題レポート" })
    expect(updated.success).toBe(true)
    expect(updated.coursework!.name).toBe("改題レポート")
  })

  it("一覧と詳細は件数表示が読む評価項目・名簿を行として返す", async () => {
    const created = await createCoursework({ name: "件数の出る資料" })
    const courseworkId = created.coursework!.id
    // 作成直後の返り値も一覧・詳細と同じ形（型がそう名乗っている）
    expect(created.coursework!.items).toEqual([])
    expect(created.coursework!.students).toEqual([])

    await createCourseworkItem({ courseworkId, name: "知識", maxScore: 100 })
    await createCourseworkItem({ courseworkId, name: "技能", maxScore: 50 })
    const student = await testPrisma.student.create({
      data: {
        studentNumber: "C001",
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
      },
    })
    await addStudentsToCoursework(courseworkId, [student.id])

    // 件数を数えるのは renderer。main は `_count` を作らず行を渡し切る
    const list = await getCourseworks()
    const listed = list.courseworks!.find(
      (coursework) => coursework.id === courseworkId
    )!
    expect(listed.items.length).toBe(2)
    expect(listed.students.length).toBe(1)

    const detail = await getCourseworkById(courseworkId)
    expect(detail.coursework!.items.length).toBe(2)
    expect(detail.coursework!.students.length).toBe(1)

    // 満点は Decimal のまま渡すと renderer 側で壊れる
    expect(typeof listed.items[0].maxScore).toBe("number")
  })

  it("更新後の返り値も評価項目・名簿を保つ", async () => {
    const created = await createCoursework({ name: "更新される資料" })
    const courseworkId = created.coursework!.id
    await createCourseworkItem({ courseworkId, name: "知識", maxScore: 100 })

    const updated = await updateCoursework(courseworkId, { name: "改題" })

    expect(updated.coursework!.name).toBe("改題")
    expect(updated.coursework!.items.length).toBe(1)
    expect(updated.coursework!.students).toEqual([])
  })

  it("評価項目を作成（変換表付き）・更新・削除できる", async () => {
    const courseworkResult = await createCoursework({ name: "資料" })
    const itemRes = await createCourseworkItem({
      courseworkId: courseworkResult.coursework!.id,
      name: "知識",
      maxScore: 100,
      inputMode: "letter",
      letterScales: [
        { label: "A", score: 100, order: 0 },
        { label: "B", score: 80, order: 1 },
      ],
    })
    expect(itemRes.success).toBe(true)
    expect(itemRes.item!.letterScales).toHaveLength(2)

    const updated = await updateCourseworkItem(itemRes.item!.id, {
      letterScales: [{ label: "○", score: 100, order: 0 }],
    })
    expect(updated.item!.letterScales).toHaveLength(1)
    expect(updated.item!.letterScales[0].label).toBe("○")

    const deleted = await deleteCourseworkItem(itemRes.item!.id)
    expect(deleted.success).toBe(true)
  })

  it("点数を一括 upsert・部分更新・取得できる", async () => {
    const { student1, student2 } = await createStudents()
    const courseworkResult = await createCoursework({ name: "資料" })
    const courseworkId = courseworkResult.coursework!.id
    const item = await createCourseworkItem({
      courseworkId,
      name: "知識",
      maxScore: 100,
    })
    const itemId = item.item!.id

    // 点数は資料の対象者にぶら下がるため、先に名簿へ載せる
    await addStudentsToCoursework(courseworkId, [student1.id, student2.id])
    const roster = await getCourseworkStudents(courseworkId)
    const courseworkStudent1 = roster.students!.find(
      (courseworkStudent) => courseworkStudent.studentId === student1.id
    )!
    const courseworkStudent2 = roster.students!.find(
      (courseworkStudent) => courseworkStudent.studentId === student2.id
    )!

    await batchUpsertCourseworkScores([
      {
        courseworkItemId: itemId,
        courseworkStudentId: courseworkStudent1.id,
        score: 85,
        comment: "良い",
      },
      {
        courseworkItemId: itemId,
        courseworkStudentId: courseworkStudent2.id,
        score: 70,
      },
    ])

    let scores = await getCourseworkScoresByItemId(itemId)
    expect(scores.scores).toHaveLength(2)

    // 部分更新（adjustment のみ。score/comment は保持）
    await batchUpsertCourseworkScores([
      {
        courseworkItemId: itemId,
        courseworkStudentId: courseworkStudent1.id,
        adjustment: -5,
      },
    ])
    scores = await getCourseworkScoresByItemId(itemId)
    const student1Score = scores.scores!.find(
      (score) => score.courseworkStudentId === courseworkStudent1.id
    )!
    expect(Number(student1Score.score)).toBe(85)
    expect(Number(student1Score.adjustment)).toBe(-5)
    expect(student1Score.comment).toBe("良い")
  })

  it("資料から生徒を外すと、その生徒の点数も消える（#962）", async () => {
    const { student1, student2 } = await createStudents()
    const courseworkResult = await createCoursework({ name: "資料" })
    const courseworkId = courseworkResult.coursework!.id
    const item = await createCourseworkItem({
      courseworkId,
      name: "知識",
      maxScore: 100,
    })
    const itemId = item.item!.id

    await addStudentsToCoursework(courseworkId, [student1.id, student2.id])
    const roster = await getCourseworkStudents(courseworkId)
    const courseworkStudent1 = roster.students!.find(
      (courseworkStudent) => courseworkStudent.studentId === student1.id
    )!
    const courseworkStudent2 = roster.students!.find(
      (courseworkStudent) => courseworkStudent.studentId === student2.id
    )!

    await batchUpsertCourseworkScores([
      {
        courseworkItemId: itemId,
        courseworkStudentId: courseworkStudent1.id,
        score: 85,
      },
      {
        courseworkItemId: itemId,
        courseworkStudentId: courseworkStudent2.id,
        score: 70,
      },
    ])

    await removeStudentsFromCoursework(courseworkId, [student1.id])

    // 外した生徒の点数だけが消え、残った生徒は巻き添えにならない
    const remaining = await getCourseworkScoresByItemId(itemId)
    expect(remaining.scores).toHaveLength(1)
    expect(remaining.scores![0].courseworkStudentId).toBe(courseworkStudent2.id)

    // 同じ生徒を追加し直しても、以前の点数は復活しない
    await addStudentsToCoursework(courseworkId, [student1.id])
    const afterReadd = await getCourseworkScoresByItemId(itemId)
    expect(afterReadd.scores).toHaveLength(1)
  })

  it("別の資料の対象者に点数を書こうとすると拒否される", async () => {
    const { student1 } = await createStudents()
    const courseworkA = await createCoursework({ name: "資料A" })
    const courseworkB = await createCoursework({ name: "資料B" })
    const itemA = await createCourseworkItem({
      courseworkId: courseworkA.coursework!.id,
      name: "知識",
      maxScore: 100,
    })

    // 生徒は資料Bの名簿にだけ載せる
    await addStudentsToCoursework(courseworkB.coursework!.id, [student1.id])
    const rosterB = await getCourseworkStudents(courseworkB.coursework!.id)

    // 資料Aの評価項目 × 資料Bの対象者。FK は両方の実在しか見ないので通ってしまう
    const result = await batchUpsertCourseworkScores([
      {
        courseworkItemId: itemA.item!.id,
        courseworkStudentId: rosterB.students![0].id,
        score: 85,
      },
    ])

    expect(result.success).toBe(false)
    const written = await getCourseworkScoresByItemId(itemA.item!.id)
    expect(written.scores).toHaveLength(0)
  })

  it("名簿に生徒を追加・並べ替え・削除できる", async () => {
    const { student1, student2 } = await createStudents()
    const courseworkResult = await createCoursework({ name: "資料" })
    const id = courseworkResult.coursework!.id

    const added = await addStudentsToCoursework(id, [student1.id, student2.id])
    expect(added.addedCount).toBe(2)

    let roster = await getCourseworkStudents(id)
    expect(roster.students).toHaveLength(2)

    await updateCourseworkStudentOrders(id, [
      { studentId: student1.id, customOrder: 1 },
      { studentId: student2.id, customOrder: 0 },
    ])
    roster = await getCourseworkStudents(id)
    expect(roster.students![0].studentId).toBe(student2.id)

    const removed = await removeStudentsFromCoursework(id, [student1.id])
    expect(removed.removedCount).toBe(1)
    roster = await getCourseworkStudents(id)
    expect(roster.students).toHaveLength(1)
  })

  it("成績算出から参照中の資料・評価項目は削除できない", async () => {
    const courseworkResult = await createCoursework({ name: "参照される資料" })
    const item = await createCourseworkItem({
      courseworkId: courseworkResult.coursework!.id,
      name: "知識",
      maxScore: 100,
    })

    // 成績を作り、その評価項目を参照する coursework 型 DataSource を作る
    const grade = await testPrisma.grade.create({ data: { name: "成績A" } })
    const gradeItem = await createGradeItem({
      gradeId: grade.id,
      name: "観点1",
    })
    await createDataSource({
      gradeItemId: gradeItem.gradeItem!.id,
      type: "coursework",
      courseworkItemId: item.item!.id,
      name: "資料(知識)",
      weight: 100,
    })

    // 評価項目の削除はブロックされ、使用中の成績名を返す
    const deleteItemResult = await deleteCourseworkItem(item.item!.id)
    expect(deleteItemResult.success).toBe(false)
    expect(deleteItemResult.usedBy).toContain("成績A")

    // 資料の削除もブロックされる
    const deleteCourseworkResult = await deleteCoursework(
      courseworkResult.coursework!.id
    )
    expect(deleteCourseworkResult.success).toBe(false)
    expect(deleteCourseworkResult.usedBy).toContain("成績A")
  })

  it("getCourseworkCandidates が資料と評価項目を返す", async () => {
    const courseworkResult = await createCoursework({ name: "候補資料" })
    await createCourseworkItem({
      courseworkId: courseworkResult.coursework!.id,
      name: "知識",
      maxScore: 50,
    })

    const res = await getCourseworkCandidates()
    expect(res.success).toBe(true)
    const target = res.courseworks!.find(
      (candidate) => candidate.id === courseworkResult.coursework!.id
    )!
    expect(target.items).toHaveLength(1)
    expect(target.items[0].name).toBe("知識")
    expect(Number(target.items[0].maxScore)).toBe(50)
  })

  describe("学級の並び替え・削除（Phase 5）", () => {
    /** 資料 + classroomA(s1,s2) + classroomB(s3) を作り、両学級を資料へ登録する */
    async function createClassData() {
      const courseworkResult = await createCoursework({ name: "学級操作資料" })
      const courseworkId = courseworkResult.coursework!.id
      const classroomA = await testPrisma.classroom.create({
        data: { name: "1年A組", grade: 1 },
      })
      const classroomB = await testPrisma.classroom.create({
        data: { name: "1年B組", grade: 1 },
      })
      const { student1, student2 } = await createStudents()
      const student3 = await testPrisma.student.create({
        data: {
          studentNumber: "S003",
          lastName: "鈴木",
          firstName: "一郎",
          lastNameKana: "スズキ",
          firstNameKana: "イチロウ",
        },
      })
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
      await testPrisma.studentClassroomMembership.create({
        data: {
          studentId: student3.id,
          classroomId: classroomB.id,
          attendanceNumber: 1,
        },
      })
      await addStudentsFromClassroomToCoursework(courseworkId, classroomA.id)
      await addStudentsFromClassroomToCoursework(courseworkId, classroomB.id)
      return {
        courseworkId,
        classroomA,
        classroomB,
        student1,
        student2,
        student3,
      }
    }

    it("setCourseworkClassroomOrders で学級の並び順を更新できる", async () => {
      const { courseworkId, classroomA, classroomB } = await createClassData()

      const result = await setCourseworkClassroomOrders(courseworkId, [
        classroomB.id,
        classroomA.id,
      ])
      expect(result.success).toBe(true)

      const classrooms = await getCourseworkClassrooms(courseworkId)
      const byName = new Map(
        classrooms.classrooms!.map((classroom) => [
          classroom.className,
          classroom.order,
        ])
      )
      expect(byName.get("1年B組")).toBe(0)
      expect(byName.get("1年A組")).toBe(1)
    })

    it("getCourseworkClassroomRemovalPreview が専属生徒数を返す", async () => {
      const { courseworkId, classroomA } = await createClassData()

      const preview = await getCourseworkClassroomRemovalPreview(
        courseworkId,
        classroomA.id
      )
      expect(preview.success).toBe(true)
      // classroomA の s1,s2 は他学級に属さない → 2名
      expect(preview.exclusiveCount).toBe(2)
    })

    it("deleteStudents=false なら登録解除のみで生徒は残る", async () => {
      const { courseworkId, classroomA } = await createClassData()

      const result = await removeClassroomFromCoursework(
        courseworkId,
        classroomA.id,
        false
      )
      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(0)

      const classrooms = await getCourseworkClassrooms(courseworkId)
      expect(classrooms.classrooms).toHaveLength(1) // classroomB のみ
      const students = await getCourseworkStudents(courseworkId)
      expect(students.students).toHaveLength(3) // 生徒は全員残る
    })

    it("deleteStudents=true（既定）なら専属生徒を削除する", async () => {
      const { courseworkId, classroomA } = await createClassData()

      const result = await removeClassroomFromCoursework(
        courseworkId,
        classroomA.id
      )
      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(2) // s1,s2

      const students = await getCourseworkStudents(courseworkId)
      expect(students.students).toHaveLength(1) // s3 のみ
    })
  })
})
