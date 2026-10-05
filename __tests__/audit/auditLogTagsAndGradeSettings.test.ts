/**
 * #1397 で記録を足した操作の検査。
 *
 * - タグの付け外し（試験・解答用紙・成績算出・資料・小計グループ）: changes に付け替え前後の
 *   タグ名が残り、付いているタグが変わらなければ記録しない。小計グループ以外は付けた先ごとに
 *   1行へまとまる
 * - 評価項目の除外（`grade.exclusion.update`）: 成績算出ごとに1行へまとまり、対象に生徒が入る
 * - 個人成績通知書の設定（`grade.report_settings.update`）: 成績算出ごとに1行へまとまる
 *
 * Electron依存を回避するため prisma/client をテスト用クライアントでモックする。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

/**
 * ログインしている利用者。解答用紙のタグ付けは担当の確認を通るので、担当者に揃える。
 * それ以外の経路では null（操作者なし）のままにする。
 */
const actor = vi.hoisted(() => {
  const state: { userId: string | null } = { userId: null }
  return state
})
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => actor.userId,
}))

import { parseAuditMetadata } from "@/app/(app)/audit-logs/auditLogRow"
import {
  createAsbDefinitionTag,
  setAsbDefinitionTags,
} from "@/electron-src/lib/prisma/asbDefinitionTag"
import {
  addCourseworkTag,
  setCourseworkTags,
} from "@/electron-src/lib/prisma/coursework"
import { createExamTag, setExamTags } from "@/electron-src/lib/prisma/examTag"
import { addGradeTag, setGradeTags } from "@/electron-src/lib/prisma/grade"
import { updateGradeIndividualReportSettings } from "@/electron-src/lib/prisma/gradeIndividualReportSettings"
import { setGradeItemExclusion } from "@/electron-src/lib/prisma/gradeItemExclusion"
import { setSubtotalGroupTags } from "@/electron-src/lib/prisma/tagSubtotalGroup"

import { createFullTestExam } from "../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createTestUser,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

afterAll(async () => {
  await cleanupTestDatabase()
  await disconnectTestPrisma()
})

beforeEach(async () => {
  await cleanupTestDatabase()
  await prisma.tag.deleteMany()
  actor.userId = null
})

const logsOf = (action: string) =>
  prisma.auditLog.findMany({
    where: { action },
    include: { targets: true },
    orderBy: { createdAt: "asc" },
  })

/** 並び順つきでタグを作る（記録のタグ名はタグ一覧の並び順で並ぶ） */
const createTags = (names: string[]) =>
  Promise.all(
    names.map((name, order) => prisma.tag.create({ data: { name, order } }))
  )

describe("試験のタグ", () => {
  it("付け替えを試験の作業領域で記録し、続けた操作は1行へまとまる", async () => {
    const { exam } = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
    })
    const [mathTag, finalTag] = await createTags(["数学", "期末"])

    await setExamTags(exam.id, [mathTag.id])
    await setExamTags(exam.id, [mathTag.id, finalTag.id])

    const logs = await logsOf("exam.tag.update")
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeId).toBe(exam.id)
    expect(logs[0].scopeLabel).toBe(exam.examName)
    expect(logs[0].summary).toBe(`試験「${exam.examName}」のタグを変更しました`)
    const metadata = parseAuditMetadata(logs[0].metadata)
    expect(metadata.occurrences).toBe(2)
    // 最初の状態（なし）→ 最後の状態（数学、期末）
    expect(metadata.changes).toEqual([
      expect.objectContaining({
        field: "tags",
        before: "",
        after: "数学、期末",
      }),
    ])
  })

  it("付いているタグが変わらない付け替えは記録しない", async () => {
    const { exam } = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
    })
    const [mathTag, finalTag] = await createTags(["数学", "期末"])
    await prisma.examTag.createMany({
      data: [
        { examId: exam.id, tagId: mathTag.id },
        { examId: exam.id, tagId: finalTag.id },
      ],
    })

    // 並びだけ違う
    await setExamTags(exam.id, [finalTag.id, mathTag.id])

    expect(await logsOf("exam.tag.update")).toHaveLength(0)
  })

  it("一覧の一括タグ付け（1件追加）も前後のタグ名で記録する", async () => {
    const { exam } = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
    })
    const [mathTag, finalTag] = await createTags(["数学", "期末"])
    await prisma.examTag.create({
      data: { examId: exam.id, tagId: mathTag.id },
    })

    await createExamTag({ examId: exam.id, tagId: finalTag.id })

    const logs = await logsOf("exam.tag.update")
    expect(logs).toHaveLength(1)
    expect(parseAuditMetadata(logs[0].metadata).changes).toEqual([
      expect.objectContaining({ before: "数学", after: "数学、期末" }),
    ])
  })
})

describe("解答用紙のタグ", () => {
  const createDefinition = async () => {
    const owner = await createTestUser()
    actor.userId = owner.id
    return prisma.asbDefinition.create({
      data: { name: "期末の解答用紙", userId: owner.id },
    })
  }

  it("付け替えを解答用紙の作業領域で記録し、続けた操作は1行へまとまる", async () => {
    const definition = await createDefinition()
    const [mathTag, finalTag] = await createTags(["数学", "期末"])

    await createAsbDefinitionTag({
      asbDefinitionId: definition.id,
      tagId: mathTag.id,
    })
    await setAsbDefinitionTags(definition.id, [mathTag.id, finalTag.id])
    await setAsbDefinitionTags(definition.id, [finalTag.id])

    const logs = await logsOf("answer_sheet.tag.update")
    expect(logs).toHaveLength(1)
    expect(logs[0].category).toBe("answer_sheet")
    expect(logs[0].scopeId).toBe(definition.id)
    expect(logs[0].scopeLabel).toBe("期末の解答用紙")
    const metadata = parseAuditMetadata(logs[0].metadata)
    expect(metadata.occurrences).toBe(3)
    expect(metadata.changes).toEqual([
      expect.objectContaining({ before: "", after: "期末" }),
    ])
  })

  it("付いているタグが変わらない付け替えは記録しない", async () => {
    const definition = await createDefinition()
    const [mathTag] = await createTags(["数学"])
    await prisma.asbDefinitionTag.create({
      data: { asbDefinitionId: definition.id, tagId: mathTag.id },
    })

    await setAsbDefinitionTags(definition.id, [mathTag.id])

    expect(await logsOf("answer_sheet.tag.update")).toHaveLength(0)
  })
})

describe("成績算出・資料のタグ", () => {
  it("成績算出の付け替えを成績算出の作業領域で記録する", async () => {
    const grade = await prisma.grade.create({ data: { name: "1学期 評定" } })
    const [mathTag, finalTag] = await createTags(["数学", "期末"])

    await setGradeTags(grade.id, [mathTag.id])
    await addGradeTag(grade.id, finalTag.id)
    // 既に付いているタグの追加は何も変えない
    await addGradeTag(grade.id, finalTag.id)

    const logs = await logsOf("grade.tag.update")
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeId).toBe(grade.id)
    expect(logs[0].scopeLabel).toBe("1学期 評定")
    const metadata = parseAuditMetadata(logs[0].metadata)
    expect(metadata.occurrences).toBe(2)
    expect(metadata.changes).toEqual([
      expect.objectContaining({ before: "", after: "数学、期末" }),
    ])
  })

  it("資料の付け替えを資料の作業領域で記録する", async () => {
    const coursework = await prisma.coursework.create({
      data: { name: "提出物" },
    })
    const [mathTag] = await createTags(["数学"])

    await addCourseworkTag(coursework.id, mathTag.id)
    await addCourseworkTag(coursework.id, mathTag.id)
    await setCourseworkTags(coursework.id, [mathTag.id])

    const logs = await logsOf("coursework.tag.update")
    expect(logs).toHaveLength(1)
    expect(logs[0].category).toBe("grade")
    expect(logs[0].scopeId).toBe(coursework.id)
    expect(logs[0].scopeLabel).toBe("提出物")
    expect(parseAuditMetadata(logs[0].metadata).occurrences).toBe(1)
  })
})

describe("小計グループのタグ", () => {
  it("作業領域を持たずに記録し、保存ごとに1行になる", async () => {
    const subtotalGroup = await prisma.subtotalGroup.create({
      data: { name: "観点別" },
    })
    const [mathTag, finalTag] = await createTags(["数学", "期末"])

    // 作成直後の保存（タグなし）は何も変えない
    await setSubtotalGroupTags(subtotalGroup.id, [])
    await setSubtotalGroupTags(subtotalGroup.id, [mathTag.id])
    await setSubtotalGroupTags(subtotalGroup.id, [mathTag.id, finalTag.id])

    const logs = await logsOf("subtotal_group.tag.update")
    expect(logs).toHaveLength(2)
    expect(logs.every((log) => log.scopeId === null)).toBe(true)
    expect(logs[0].summary).toBe("小計グループ「観点別」のタグを変更しました")
    expect(logs.map((log) => parseAuditMetadata(log.metadata).changes)).toEqual(
      [
        [expect.objectContaining({ before: "", after: "数学" })],
        [expect.objectContaining({ before: "数学", after: "数学、期末" })],
      ]
    )
  })
})

describe("評価項目の除外", () => {
  const createGradeCells = async () => {
    const grade = await prisma.grade.create({ data: { name: "1学期 評定" } })
    const gradeItem = await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能" },
    })
    const students = await Promise.all(
      [
        { studentNumber: "1", lastName: "山田", firstName: "太郎" },
        { studentNumber: "2", lastName: "鈴木", firstName: "花子" },
      ].map((student) =>
        prisma.student.create({
          data: { ...student, lastNameKana: "", firstNameKana: "" },
        })
      )
    )
    const gradeStudents = await Promise.all(
      students.map((student) =>
        prisma.gradeStudent.create({
          data: { gradeId: grade.id, studentId: student.id },
        })
      )
    )
    return { grade, gradeItem, students, gradeStudents }
  }

  it("切り替えを成績算出ごとに1行へまとめ、マスごとに最初と最後の状態を残す", async () => {
    const { grade, gradeItem, students, gradeStudents } =
      await createGradeCells()
    const [yamadaCell, suzukiCell] = gradeStudents.map((gradeStudent) => ({
      gradeStudentId: gradeStudent.id,
      gradeItemId: gradeItem.id,
    }))

    await setGradeItemExclusion({ ...yamadaCell, excluded: true })
    await setGradeItemExclusion({ ...suzukiCell, excluded: true })
    await setGradeItemExclusion({ ...yamadaCell, excluded: false })

    const logs = await logsOf("grade.exclusion.update")
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeId).toBe(grade.id)
    expect(logs[0].scopeLabel).toBe("1学期 評定")
    expect(logs[0].targets.map((target) => target.targetId).sort()).toEqual(
      students.map((student) => student.id).sort()
    )
    const metadata = parseAuditMetadata(logs[0].metadata)
    expect(metadata.occurrences).toBe(3)
    expect(metadata.changes).toEqual([
      expect.objectContaining({
        label: "山田 太郎 → 知識・技能",
        before: "対象",
        after: "対象",
      }),
      expect.objectContaining({
        label: "鈴木 花子 → 知識・技能",
        before: "対象",
        after: "除外",
      }),
    ])
  })

  it("既に除外しているマスの除外・除外していないマスの解除は記録しない", async () => {
    const { gradeItem, gradeStudents } = await createGradeCells()
    const cell = {
      gradeStudentId: gradeStudents[0].id,
      gradeItemId: gradeItem.id,
    }
    await prisma.gradeItemExclusion.create({ data: cell })

    await setGradeItemExclusion({ ...cell, excluded: true })
    await setGradeItemExclusion({
      gradeStudentId: gradeStudents[1].id,
      gradeItemId: gradeItem.id,
      excluded: false,
    })

    expect(await logsOf("grade.exclusion.update")).toHaveLength(0)
  })
})

describe("個人成績通知書の設定", () => {
  it("触った項目を成績算出ごとに1行へまとめ、最初と最後の値を残す", async () => {
    const grade = await prisma.grade.create({ data: { name: "1学期 評定" } })

    // 行がまだ無いときの「前」は既定値
    await updateGradeIndividualReportSettings(grade.id, { title: "通" })
    await updateGradeIndividualReportSettings(grade.id, { title: "通知表" })
    await updateGradeIndividualReportSettings(grade.id, {
      showCommentSection: true,
    })

    const logs = await logsOf("grade.report_settings.update")
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeId).toBe(grade.id)
    expect(logs[0].scopeLabel).toBe("1学期 評定")
    const metadata = parseAuditMetadata(logs[0].metadata)
    expect(metadata.occurrences).toBe(3)
    expect(metadata.changes).toEqual([
      expect.objectContaining({
        field: "title",
        label: "タイトル",
        before: "個人成績通知書",
        after: "通知表",
      }),
      expect.objectContaining({
        field: "showCommentSection",
        label: "コメント欄",
        before: false,
        after: true,
      }),
    ])
  })

  it("値が変わらない書き込みは記録しない", async () => {
    const grade = await prisma.grade.create({ data: { name: "1学期 評定" } })

    await updateGradeIndividualReportSettings(grade.id, {
      title: "個人成績通知書",
    })

    expect(await logsOf("grade.report_settings.update")).toHaveLength(0)
  })
})
