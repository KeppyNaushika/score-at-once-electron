/**
 * 旧形式の資料アーカイブ（.coursework）取り込みの統合テスト
 *
 * (a) UUID一致での冪等再import (b) クリーンDBでの生徒/学級の新規作成
 * (c) studentNumber一致・別UUID の名前フォールバック統合 (d) score の LWW
 *
 * 取り込むのは旧書き出しで作った固定ファイル `coursework.coursework`。元データは
 * 学級「学級_資料」・生徒「CW_001 鈴木 一郎」（出席番号1）・タグ「タグ_資料」と、
 * それらを持つ資料「第1回レポート」（説明「レポート評価」）1件。評価項目は
 * 「提出物」（数値・満点100）1つで、点数は 85・調整 -5（提出遅延）・コメント付き。
 * 「書き出したパソコン」の状態が要るテストは、固定ファイルの行をそのまま
 * DB に作って用意する（seedCourseworkSections）。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

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

import {
  importCourseworkArchive,
  previewCourseworkImport,
} from "../../../electron-src/lib/import/coursework-archive"
import {
  readLegacyCourseworkArchive,
  seedCourseworkSections,
} from "../../helpers/legacyArchiveFixtures"

const prisma = getTestPrismaClient()

/** 旧書き出しで作った資料アーカイブを読む（テストごとに新しく読むので書き換えてよい） */
function readFixture() {
  return readLegacyCourseworkArchive("coursework.coursework")
}

describe("coursework-archive 取り込み", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("書き出したパソコンへ取り込み直しても、UUID一致で重複生成されない", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)

    await importCourseworkArchive(archive)

    expect(await prisma.coursework.count()).toBe(1)
    expect(await prisma.student.count()).toBe(1)
    expect(await prisma.courseworkScore.count()).toBe(1)
  })

  it("クリーンDBへインポートすると生徒・学級・タグ・点数が復元される", async () => {
    await importCourseworkArchive(await readFixture())

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
      "CW_001"
    )

    // 学級名は unique ではないので findFirst で引く（クリーンDBなので1件に決まる）
    const classroom = await prisma.classroom.findFirst({
      where: { name: "学級_資料" },
    })
    expect(classroom).not.toBeNull()
    const tag = await prisma.tag.findFirst({ where: { name: "タグ_資料" } })
    expect(tag).not.toBeNull()
  })

  it("studentNumber一致・別UUIDの生徒は名前フォールバックで統合される", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)

    // 資料と項目・名簿だけ消し、生徒は残す（別UUIDの状況を作るため生徒も作り直す）
    await prisma.courseworkScore.deleteMany()
    await prisma.courseworkItem.deleteMany()
    await prisma.courseworkStudent.deleteMany()
    await prisma.courseworkClassroom.deleteMany()
    await prisma.courseworkTag.deleteMany()
    await prisma.coursework.deleteMany()
    await prisma.studentClassroomMembership.deleteMany()
    await prisma.student.delete({ where: { id: archive.studentsData[0].id } })
    // 同じ学籍番号で別UUIDの生徒を作る
    const reborn = await prisma.student.create({
      data: {
        studentNumber: "CW_001",
        lastName: "鈴木",
        firstName: "一郎",
        lastNameKana: "スズキ",
        firstNameKana: "イチロウ",
      },
    })

    await importCourseworkArchive(archive, {
      studentMatching: "studentNumber",
    })

    // 生徒は新規作成されず、既存（別UUID）へ統合
    const students = await prisma.student.findMany({
      where: { studentNumber: "CW_001" },
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
    const archive = await readFixture()
    await seedCourseworkSections(archive)
    const scoreId = archive.courseworkScores[0].id

    // 既存スコアを新しい値に更新（updatedAt も今へ進む）
    await prisma.courseworkScore.update({
      where: { id: scoreId },
      data: { score: 50 },
    })

    // アーカイブ側 updatedAt を過去にして再インポート → 既存(50)を維持
    archive.courseworkScores[0].updatedAt = new Date(
      "2000-01-01T00:00:00.000Z"
    ).toISOString()
    await importCourseworkArchive(archive)
    const afterOld = await prisma.courseworkScore.findUnique({
      where: { id: scoreId },
    })
    expect(Number(afterOld!.score)).toBe(50)

    // アーカイブ側 updatedAt を未来にして再インポート → アーカイブ(85)で上書き
    archive.courseworkScores[0].updatedAt = new Date(
      "2099-01-01T00:00:00.000Z"
    ).toISOString()
    await importCourseworkArchive(archive)
    const afterNew = await prisma.courseworkScore.findUnique({
      where: { id: scoreId },
    })
    expect(Number(afterNew!.score)).toBe(85)
  })

  it("取り込み先に生徒が居ない場合は、孤児とは別の警告になる", async () => {
    // 別環境想定。生徒を作らせない設定（grade-archive 内包と同じ allowCreate:false）
    const result = await importCourseworkArchive(await readFixture(), {
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

  it("統合すると、資料・評価項目・名簿の列もアーカイブが新しければ書き換わる", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)
    const courseworkId = archive.courseworks[0].id
    const itemId = archive.courseworkItems[0].id

    // 取り込み先を別の値へ戻す（かつて取り込みが黙って古いままにしていた列）
    await prisma.coursework.update({
      where: { id: courseworkId },
      data: { description: null },
    })
    await prisma.courseworkItem.update({
      where: { id: itemId },
      data: { maxScore: 4, inputMode: "letter" },
    })

    const future = new Date("2099-01-01T00:00:00.000Z").toISOString()
    archive.courseworks[0].updatedAt = future
    archive.courseworkItems[0].updatedAt = future

    await importCourseworkArchive(archive)

    const coursework = await prisma.coursework.findUniqueOrThrow({
      where: { id: courseworkId },
    })
    expect(coursework.description).toBe("レポート評価")

    const item = await prisma.courseworkItem.findUniqueOrThrow({
      where: { id: itemId },
    })
    expect(Number(item.maxScore)).toBe(100)
    expect(item.inputMode).toBe("numeric")
  })

  it("統合でも、アーカイブが古ければ資料の列は書き換わらない", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)
    const courseworkId = archive.courseworks[0].id

    await prisma.coursework.update({
      where: { id: courseworkId },
      data: { description: "このPCで書き直した説明" },
    })

    archive.courseworks[0].updatedAt = new Date(
      "2000-01-01T00:00:00.000Z"
    ).toISOString()

    await importCourseworkArchive(archive)

    const coursework = await prisma.coursework.findUniqueOrThrow({
      where: { id: courseworkId },
    })
    expect(coursework.description).toBe("このPCで書き直した説明")
  })

  it("上書きを選ぶと、アーカイブが古くても資料の列が置き換わる", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)
    const courseworkId = archive.courseworks[0].id

    await prisma.coursework.update({
      where: { id: courseworkId },
      data: { description: "このPCで書き直した説明" },
    })

    archive.courseworks[0].updatedAt = new Date(
      "2000-01-01T00:00:00.000Z"
    ).toISOString()

    await importCourseworkArchive(archive, { action: "overwrite" })

    const coursework = await prisma.coursework.findUniqueOrThrow({
      where: { id: courseworkId },
    })
    expect(coursework.description).toBe("レポート評価")
  })

  it("名簿が増えたら、並び順は 1..n へ詰め直される（重複も穴も残さない）", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)
    const courseworkId = archive.courseworks[0].id

    // 取り込み先の名簿にもう1人（アーカイブには居ない生徒）を、同じ番号で入れておく。
    // 行ごとの規則だけだと、ここに 0 が2つ並んだままになる
    const otherStudent = await prisma.student.create({
      data: {
        studentNumber: "CW_OTHER",
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
      },
    })
    await prisma.courseworkStudent.create({
      data: {
        courseworkId,
        studentId: otherStudent.id,
        customOrder: 0,
      },
    })

    // アーカイブ側に新しい生徒を1人足して「行が増える」取り込みにする
    const addedStudent = await prisma.student.create({
      data: {
        studentNumber: "CW_ADDED",
        lastName: "田中",
        firstName: "次郎",
        lastNameKana: "タナカ",
        firstNameKana: "ジロウ",
      },
    })
    archive.studentsData.push({
      id: addedStudent.id,
      studentNumber: addedStudent.studentNumber,
      lastName: addedStudent.lastName,
      firstName: addedStudent.firstName,
      lastNameKana: addedStudent.lastNameKana,
      firstNameKana: addedStudent.firstNameKana,
      enrollmentYear: addedStudent.enrollmentYear,
      updatedAt: addedStudent.updatedAt.toISOString(),
    })
    archive.courseworkStudents.push({
      id: "cw-student-added",
      courseworkId,
      studentId: addedStudent.id,
      customOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    await importCourseworkArchive(archive)

    const roster = await prisma.courseworkStudent.findMany({
      where: { courseworkId },
    })
    expect(roster).toHaveLength(3)
    const orders = roster
      .map((courseworkStudent) => courseworkStudent.customOrder)
      .sort((left, right) => (left ?? 0) - (right ?? 0))
    expect(orders).toEqual([1, 2, 3])
  })

  it("行が1つも増えなくても、名簿の並びは 1..n へ詰め直される", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)
    const courseworkId = archive.courseworks[0].id

    // アーカイブには居ない生徒を、取り込み後にぶつかる番号で名簿へ入れておく
    const otherStudent = await prisma.student.create({
      data: {
        studentNumber: "CW_OTHER",
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
      },
    })
    await prisma.courseworkStudent.create({
      data: {
        courseworkId,
        studentId: otherStudent.id,
        customOrder: 1,
      },
    })

    // アーカイブ側は行を増やさず、既にある1人の並び順だけを 1 へ動かす。
    // 行ごとの規則だけだと 1 が2つ並んだまま残る
    archive.courseworkStudents[0].customOrder = 1
    archive.courseworkStudents[0].updatedAt = new Date(
      "2099-01-01T00:00:00.000Z"
    ).toISOString()

    await importCourseworkArchive(archive)

    const roster = await prisma.courseworkStudent.findMany({
      where: { courseworkId },
    })
    expect(roster).toHaveLength(2)
    expect(
      roster
        .map((courseworkStudent) => courseworkStudent.customOrder)
        .sort((left, right) => (left ?? 0) - (right ?? 0))
    ).toEqual([1, 2])
  })

  it("previewCourseworkImport が UUID一致と名前候補を返す", async () => {
    const archive = await readFixture()
    await seedCourseworkSections(archive)

    const preview = await previewCourseworkImport(archive)
    expect(preview.matches).toHaveLength(1)
    expect(preview.matches[0].uuidMatch?.id).toBe(archive.courseworks[0].id)
  })
})
