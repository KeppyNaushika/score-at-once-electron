/**
 * coursework-archive ラウンドトリップ統合テスト
 *
 * (a) UUID一致での冪等再import (b) クリーンDBでの生徒/学級の新規作成
 * (c) studentNumber一致・別UUID の名前フォールバック統合 (d) score の LWW
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type CollectedCourseworkData,
  COURSEWORK_CURRENT_VERSION,
  type CourseworkArchiveData,
} from "../../../src/types/courseworkArchive.types"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"

vi.mock("../../../electron-src/lib/prisma/client", () => {
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

// 監査ログは認証ストア依存なので no-op 化
vi.mock("../../../electron-src/lib/prisma/auditLog", () => ({
  recordAuditLog: vi.fn(),
}))

import { collectCourseworkArchiveData } from "../../../electron-src/lib/export/coursework-archive/dataCollector"
import {
  importCourseworkArchive,
  previewCourseworkImport,
} from "../../../electron-src/lib/import/coursework-archive"

const prisma = getTestPrismaClient()

function toArchive(collected: CollectedCourseworkData): CourseworkArchiveData {
  return {
    manifest: {
      version: COURSEWORK_CURRENT_VERSION,
      appVersion: "test",
      exportedAt: new Date("2026-06-29T00:00:00.000Z").toISOString(),
      counts: collected.counts,
    },
    courseworks: collected.courseworks,
    courseworkClassrooms: collected.courseworkClassrooms,
    courseworkTags: collected.courseworkTags,
    courseworkStudents: collected.courseworkStudents,
    courseworkItems: collected.courseworkItems,
    courseworkLetterScales: collected.courseworkLetterScales,
    courseworkScores: collected.courseworkScores,
    studentsData: collected.studentsData,
    classesData: collected.classesData,
    membershipsData: collected.membershipsData,
    tagsData: collected.tagsData,
  }
}

async function seedCoursework(suffix: number) {
  const classroom = await prisma.classroom.create({
    data: { name: `学級_${suffix}` },
  })
  const student = await prisma.student.create({
    data: {
      studentNumber: `CW_${suffix}`,
      lastName: "鈴木",
      firstName: "一郎",
      lastNameKana: "スズキ",
      firstNameKana: "イチロウ",
    },
  })
  await prisma.studentClassroomMembership.create({
    data: {
      classroomId: classroom.id,
      studentId: student.id,
      attendanceNumber: 1,
    },
  })
  const tag = await prisma.tag.create({ data: { name: `タグ_${suffix}` } })
  const coursework = await prisma.coursework.create({
    data: {
      name: `第1回レポート_${suffix}`,
      description: "レポート評価",
      classrooms: { create: [{ classroomId: classroom.id, order: 0 }] },
      tags: { create: [{ tagId: tag.id }] },
      students: { create: [{ studentId: student.id, customOrder: 0 }] },
    },
  })
  const item = await prisma.courseworkItem.create({
    data: {
      courseworkId: coursework.id,
      name: "提出物",
      order: 0,
      maxScore: 100,
      inputMode: "numeric",
    },
  })
  const courseworkStudent = await prisma.courseworkStudent.findUniqueOrThrow({
    where: {
      courseworkId_studentId: {
        courseworkId: coursework.id,
        studentId: student.id,
      },
    },
  })
  const score = await prisma.courseworkScore.create({
    data: {
      courseworkItemId: item.id,
      courseworkStudentId: courseworkStudent.id,
      score: 85,
      adjustment: -5,
      adjustmentReason: "提出遅延",
      comment: "丁寧にまとめられています",
    },
  })
  return { classroom, student, tag, coursework, item, score }
}

describe("coursework-archive ラウンドトリップ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("項目・点数・名簿・タグが収集され、UUID一致で冪等に再インポートできる", async () => {
    const suffix = Date.now()
    const seeded = await seedCoursework(suffix)

    const collected = await collectCourseworkArchiveData([seeded.coursework.id])
    expect(collected.courseworks).toHaveLength(1)
    expect(collected.courseworkItems).toHaveLength(1)
    expect(collected.courseworkScores[0].updatedAt).toBeDefined()
    expect(collected.courseworkScores[0].courseworkStudentId).toBe(
      collected.courseworkStudents[0].id
    )
    expect(collected.studentsData[0].studentNumber).toBe(`CW_${suffix}`)
    expect(collected.tagsData[0].name).toBe(`タグ_${suffix}`)

    // UUID一致での再インポート → 重複生成されない
    await importCourseworkArchive(toArchive(collected))

    const courseworkCount = await prisma.coursework.count()
    const studentCount = await prisma.student.count()
    const scoreCount = await prisma.courseworkScore.count()
    expect(courseworkCount).toBe(1)
    expect(studentCount).toBe(1)
    expect(scoreCount).toBe(1)
  })

  it("クリーンDBへインポートすると生徒・学級・タグ・点数が復元される", async () => {
    const suffix = Date.now()
    const seeded = await seedCoursework(suffix)
    const collected = await collectCourseworkArchiveData([seeded.coursework.id])

    // 別環境想定: 関連レコードを全削除
    await cleanupTestDatabase()

    await importCourseworkArchive(toArchive(collected))

    const item = await prisma.courseworkItem.findFirst({
      where: { name: "提出物" },
      include: {
        scores: {
          include: { courseworkStudent: { include: { student: true } } },
        },
      },
    })
    expect(item).not.toBeNull()
    expect(item!.scores).toHaveLength(1)
    expect(Number(item!.scores[0].score)).toBe(85)
    expect(Number(item!.scores[0].adjustment)).toBe(-5)
    expect(item!.scores[0].courseworkStudent.student.studentNumber).toBe(
      `CW_${suffix}`
    )

    // 学級名は unique ではないので findFirst で引く（suffix 付きなので1件に決まる）
    const classroom = await prisma.classroom.findFirst({
      where: { name: `学級_${suffix}` },
    })
    expect(classroom).not.toBeNull()
  })

  it("studentNumber一致・別UUIDの生徒は名前フォールバックで統合される", async () => {
    const suffix = Date.now()
    const seeded = await seedCoursework(suffix)
    const collected = await collectCourseworkArchiveData([seeded.coursework.id])

    // 資料と項目・名簿だけ消し、生徒は残す（別UUIDの状況を作るため生徒も作り直す）
    await prisma.courseworkScore.deleteMany()
    await prisma.courseworkItem.deleteMany()
    await prisma.courseworkStudent.deleteMany()
    await prisma.courseworkClassroom.deleteMany()
    await prisma.courseworkTag.deleteMany()
    await prisma.coursework.deleteMany()
    await prisma.courseworkScore.deleteMany()
    await prisma.studentClassroomMembership.deleteMany()
    await prisma.student.delete({ where: { id: seeded.student.id } })
    // 同じ学籍番号で別UUIDの生徒を作る
    const reborn = await prisma.student.create({
      data: {
        studentNumber: `CW_${suffix}`,
        lastName: "鈴木",
        firstName: "一郎",
        lastNameKana: "スズキ",
        firstNameKana: "イチロウ",
      },
    })

    await importCourseworkArchive(toArchive(collected), {
      studentMatching: "studentNumber",
    })

    // 生徒は新規作成されず、既存（別UUID）へ統合
    const students = await prisma.student.findMany({
      where: { studentNumber: `CW_${suffix}` },
    })
    expect(students).toHaveLength(1)
    expect(students[0].id).toBe(reborn.id)

    const score = await prisma.courseworkScore.findFirst({
      where: { courseworkStudent: { studentId: reborn.id } },
    })
    expect(score).not.toBeNull()
    expect(Number(score!.score)).toBe(85)
  })

  it("点数は updatedAt の LWW で解決される（既存が新しければ上書きしない）", async () => {
    const suffix = Date.now()
    const seeded = await seedCoursework(suffix)
    const collected = await collectCourseworkArchiveData([seeded.coursework.id])

    // 既存スコアを新しい値に更新（updatedAt も将来に進む）
    await prisma.courseworkScore.update({
      where: { id: seeded.score.id },
      data: { score: 50 },
    })

    // アーカイブ側 updatedAt を過去にして再インポート → 既存(50)を維持
    const archive = toArchive(collected)
    archive.courseworkScores[0].updatedAt = new Date(
      "2000-01-01T00:00:00.000Z"
    ).toISOString()
    await importCourseworkArchive(archive)
    const afterOld = await prisma.courseworkScore.findUnique({
      where: { id: seeded.score.id },
    })
    expect(Number(afterOld!.score)).toBe(50)

    // アーカイブ側 updatedAt を未来にして再インポート → アーカイブ(85)で上書き
    archive.courseworkScores[0].updatedAt = new Date(
      "2099-01-01T00:00:00.000Z"
    ).toISOString()
    await importCourseworkArchive(archive)
    const afterNew = await prisma.courseworkScore.findUnique({
      where: { id: seeded.score.id },
    })
    expect(Number(afterNew!.score)).toBe(85)
  })

  it("取り込み先に生徒が居ない場合は、孤児とは別の警告になる", async () => {
    const suffix = Date.now()
    const seeded = await seedCoursework(suffix)
    const collected = await collectCourseworkArchiveData([seeded.coursework.id])

    // 別環境想定。生徒を作らせない設定（grade-archive 内包と同じ allowCreate:false）
    await cleanupTestDatabase()

    const result = await importCourseworkArchive(toArchive(collected), {
      allowCreate: false,
    })

    const warnings = result.warnings
    // 名簿には載っているが取り込み先に居ない ＝ アーカイブの不整合ではない
    expect(
      warnings.some((warning) => warning.includes("この環境に存在しない生徒"))
    ).toBe(true)
    expect(
      warnings.some((warning) =>
        warning.includes("対象生徒として登録されていない生徒")
      )
    ).toBe(false)
  })

  it("previewCourseworkImport が UUID一致と名前候補を返す", async () => {
    const suffix = Date.now()
    const seeded = await seedCoursework(suffix)
    const collected = await collectCourseworkArchiveData([seeded.coursework.id])

    const preview = await previewCourseworkImport(toArchive(collected))
    expect(preview.matches).toHaveLength(1)
    expect(preview.matches[0].uuidMatch?.id).toBe(seeded.coursework.id)
  })
})
