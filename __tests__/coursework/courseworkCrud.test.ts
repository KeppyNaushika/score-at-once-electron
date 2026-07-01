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
  addStudentsFromClassToCoursework,
  addStudentsToCoursework,
  batchUpsertCourseworkScores,
  createCoursework,
  createCourseworkItem,
  deleteCoursework,
  deleteCourseworkItem,
  getCourseworkById,
  getCourseworkCandidates,
  getCourseworkClasses,
  getCourseworkClassRemovalPreview,
  getCourseworkScoresByItemId,
  getCourseworkStudents,
  removeClassFromCoursework,
  removeStudentsFromCoursework,
  setCourseworkClassOrders,
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
  const s1 = await testPrisma.student.create({
    data: {
      studentNumber: "S001",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })
  const s2 = await testPrisma.student.create({
    data: {
      studentNumber: "S002",
      lastName: "佐藤",
      firstName: "花子",
      lastNameKana: "サトウ",
      firstNameKana: "ハナコ",
    },
  })
  return { s1, s2 }
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

  it("評価項目を作成（変換表付き）・更新・削除できる", async () => {
    const cw = await createCoursework({ name: "資料" })
    const itemRes = await createCourseworkItem({
      courseworkId: cw.coursework!.id,
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
    const { s1, s2 } = await createStudents()
    const cw = await createCoursework({ name: "資料" })
    const item = await createCourseworkItem({
      courseworkId: cw.coursework!.id,
      name: "知識",
      maxScore: 100,
    })
    const itemId = item.item!.id

    await batchUpsertCourseworkScores([
      {
        courseworkItemId: itemId,
        studentId: s1.id,
        score: 85,
        comment: "良い",
      },
      { courseworkItemId: itemId, studentId: s2.id, score: 70 },
    ])

    let scores = await getCourseworkScoresByItemId(itemId)
    expect(scores.scores).toHaveLength(2)

    // 部分更新（adjustment のみ。score/comment は保持）
    await batchUpsertCourseworkScores([
      { courseworkItemId: itemId, studentId: s1.id, adjustment: -5 },
    ])
    scores = await getCourseworkScoresByItemId(itemId)
    const s1Score = scores.scores!.find((s) => s.studentId === s1.id)!
    expect(Number(s1Score.score)).toBe(85)
    expect(Number(s1Score.adjustment)).toBe(-5)
    expect(s1Score.comment).toBe("良い")
  })

  it("名簿に生徒を追加・並べ替え・削除できる", async () => {
    const { s1, s2 } = await createStudents()
    const cw = await createCoursework({ name: "資料" })
    const id = cw.coursework!.id

    const added = await addStudentsToCoursework(id, [s1.id, s2.id])
    expect(added.addedCount).toBe(2)

    let roster = await getCourseworkStudents(id)
    expect(roster.students).toHaveLength(2)

    await updateCourseworkStudentOrders(id, [
      { studentId: s1.id, customOrder: 1 },
      { studentId: s2.id, customOrder: 0 },
    ])
    roster = await getCourseworkStudents(id)
    expect(roster.students![0].studentId).toBe(s2.id)

    const removed = await removeStudentsFromCoursework(id, [s1.id])
    expect(removed.removedCount).toBe(1)
    roster = await getCourseworkStudents(id)
    expect(roster.students).toHaveLength(1)
  })

  it("成績算出から参照中の資料・評価項目は削除できない", async () => {
    const cw = await createCoursework({ name: "参照される資料" })
    const item = await createCourseworkItem({
      courseworkId: cw.coursework!.id,
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
    const delItem = await deleteCourseworkItem(item.item!.id)
    expect(delItem.success).toBe(false)
    expect(delItem.usedBy).toContain("成績A")

    // 資料の削除もブロックされる
    const delCw = await deleteCoursework(cw.coursework!.id)
    expect(delCw.success).toBe(false)
    expect(delCw.usedBy).toContain("成績A")
  })

  it("getCourseworkCandidates が資料と評価項目を返す", async () => {
    const cw = await createCoursework({ name: "候補資料" })
    await createCourseworkItem({
      courseworkId: cw.coursework!.id,
      name: "知識",
      maxScore: 50,
    })

    const res = await getCourseworkCandidates()
    expect(res.success).toBe(true)
    const target = res.courseworks!.find((c) => c.id === cw.coursework!.id)!
    expect(target.items).toHaveLength(1)
    expect(target.items[0].name).toBe("知識")
    expect(Number(target.items[0].maxScore)).toBe(50)
  })

  describe("学級の並び替え・削除（Phase 5）", () => {
    /** 資料 + classA(s1,s2) + classB(s3) を作り、両学級を資料へ登録する */
    async function createClassData() {
      const cw = await createCoursework({ name: "学級操作資料" })
      const courseworkId = cw.coursework!.id
      const classA = await testPrisma.classroom.create({
        data: { name: "1年A組", grade: 1 },
      })
      const classB = await testPrisma.classroom.create({
        data: { name: "1年B組", grade: 1 },
      })
      const { s1, s2 } = await createStudents()
      const s3 = await testPrisma.student.create({
        data: {
          studentNumber: "S003",
          lastName: "鈴木",
          firstName: "一郎",
          lastNameKana: "スズキ",
          firstNameKana: "イチロウ",
        },
      })
      await testPrisma.studentClassMembership.create({
        data: { studentId: s1.id, classroomId: classA.id, attendanceNumber: 1 },
      })
      await testPrisma.studentClassMembership.create({
        data: { studentId: s2.id, classroomId: classA.id, attendanceNumber: 2 },
      })
      await testPrisma.studentClassMembership.create({
        data: { studentId: s3.id, classroomId: classB.id, attendanceNumber: 1 },
      })
      await addStudentsFromClassToCoursework(courseworkId, classA.id)
      await addStudentsFromClassToCoursework(courseworkId, classB.id)
      return { courseworkId, classA, classB, s1, s2, s3 }
    }

    it("setCourseworkClassOrders で学級の並び順を更新できる", async () => {
      const { courseworkId, classA, classB } = await createClassData()

      const result = await setCourseworkClassOrders(courseworkId, [
        classB.id,
        classA.id,
      ])
      expect(result.success).toBe(true)

      const classes = await getCourseworkClasses(courseworkId)
      const byName = new Map(
        classes.classes!.map((c) => [c.className, c.order])
      )
      expect(byName.get("1年B組")).toBe(0)
      expect(byName.get("1年A組")).toBe(1)
    })

    it("getCourseworkClassRemovalPreview が専属生徒数を返す", async () => {
      const { courseworkId, classA } = await createClassData()

      const preview = await getCourseworkClassRemovalPreview(
        courseworkId,
        classA.id
      )
      expect(preview.success).toBe(true)
      // classA の s1,s2 は他学級に属さない → 2名
      expect(preview.exclusiveCount).toBe(2)
    })

    it("deleteStudents=false なら登録解除のみで生徒は残る", async () => {
      const { courseworkId, classA } = await createClassData()

      const result = await removeClassFromCoursework(
        courseworkId,
        classA.id,
        false
      )
      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(0)

      const classes = await getCourseworkClasses(courseworkId)
      expect(classes.classes).toHaveLength(1) // classB のみ
      const students = await getCourseworkStudents(courseworkId)
      expect(students.students).toHaveLength(3) // 生徒は全員残る
    })

    it("deleteStudents=true（既定）なら専属生徒を削除する", async () => {
      const { courseworkId, classA } = await createClassData()

      const result = await removeClassFromCoursework(courseworkId, classA.id)
      expect(result.success).toBe(true)
      expect(result.removedStudents).toBe(2) // s1,s2

      const students = await getCourseworkStudents(courseworkId)
      expect(students.students).toHaveLength(1) // s3 のみ
    })
  })
})
