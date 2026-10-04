/**
 * 統合アーカイブ（.sao）の行とファイルの取り込み
 *
 * テスト対象:
 *   electron-src/lib/import/unified-archive/archiveRowImporter.ts
 *   electron-src/lib/import/unified-archive/archiveFileImporter.ts
 *
 * 段階2の createUnifiedArchive で書き出した ZIP を、このテストの中で展開して
 * OpenedUnifiedArchive を組む（開く側 ─ 守りと現行化 ─ には頼らない）。
 * 規則は docs/unified-archive-design.md §7:
 * - 書き出し → 空にした DB へ統合で取り込むと、範囲の全表の行が書き出し前と一致する（§10 の段階3）
 * - 3択（上書き・統合・別で追加）が全行に同じように効く。別で追加は根の子孫の id を振り直す
 * - 利用者の passcode は書かない。監査ログは追記だけ
 * - 一意制約の衝突があれば何も書かずに止める
 */

import AdmZip from "adm-zip"
import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { ARCHIVE_TABLES } from "../../../electron-src/lib/export/unified-archive/archiveTableRegistry"
import { createUnifiedArchive } from "../../../electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import { remapEmbeddedIds } from "../../../electron-src/lib/import/unified-archive/archiveEmbeddedIds"
import {
  importUnifiedArchiveFiles,
  remapArchiveFilePath,
} from "../../../electron-src/lib/import/unified-archive/archiveFileImporter"
import { UnifiedArchiveUniqueConflictError } from "../../../electron-src/lib/import/unified-archive/archiveRowImporter"
import { orderArchiveTables } from "../../../electron-src/lib/import/unified-archive/archiveTableOrder"
import type { OpenedUnifiedArchive } from "../../../electron-src/lib/import/unified-archive/types"
import type { ImportAction } from "../../../src/types/importAction.types"
import {
  UNIFIED_ARCHIVE_DATABASE_NAME,
  UNIFIED_ARCHIVE_FILES_DIR,
} from "../../../src/types/unifiedArchive.types"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import {
  createUnifiedArchiveFileFixture,
  type UnifiedArchiveFileFixture,
  writeDataDirectoryFiles,
} from "../../helpers/unifiedArchiveFileFixture"
import {
  createUnifiedArchiveFixture,
  type UnifiedArchiveFixture,
} from "../../helpers/unifiedArchiveFixture"
import {
  countTableRows,
  findDanglingReferences,
  importArchiveRows,
  planArchiveImport,
  readRowsByIds as readRowsByIdsFrom,
  readTableIds,
  type TableRows,
} from "../../helpers/unifiedArchiveImportHelpers"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const WORK_DIR = path.join(os.tmpdir(), "unified-archive-import")
const DATA_DIR = path.join(WORK_DIR, "data")
const OUTPUT_PATH = path.join(WORK_DIR, "export.sao")
const IMPORTED_AT = new Date("2026-10-05T09:00:00.000Z")
const FILES_PREFIX = `${UNIFIED_ARCHIVE_FILES_DIR}/`

/** ZIP を展開して、取り込みに渡す形にする（開く側の守りと現行化は通さない） */
const openArchiveForTest = (
  zipPath: string,
  manifest: OpenedUnifiedArchive["manifest"]
): OpenedUnifiedArchive => {
  const openedDirectory = path.join(WORK_DIR, `opened-${crypto.randomUUID()}`)
  const filesDirectory = path.join(openedDirectory, UNIFIED_ARCHIVE_FILES_DIR)
  fs.mkdirSync(filesDirectory, { recursive: true })
  const databasePath = path.join(openedDirectory, UNIFIED_ARCHIVE_DATABASE_NAME)
  for (const entry of new AdmZip(zipPath).getEntries()) {
    if (entry.isDirectory) continue
    if (entry.entryName === UNIFIED_ARCHIVE_DATABASE_NAME) {
      fs.writeFileSync(databasePath, entry.getData())
    } else if (entry.entryName.startsWith(FILES_PREFIX)) {
      const relativePath = entry.entryName.slice(FILES_PREFIX.length)
      const filePath = path.join(filesDirectory, ...relativePath.split("/"))
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, entry.getData())
    }
  }
  return {
    manifest,
    databasePath,
    filesDirectory,
    appliedMigrations: [],
    migratedRowIds: {},
  }
}

const readArchiveIds = (databasePath: string) => readTableIds(databasePath)
const readRowsByIds = (idsByTable: ReadonlyMap<string, string[]>) =>
  readRowsByIdsFrom(TEST_DB_PATH, idsByTable)
const countTestDatabaseRows = () => countTableRows(TEST_DB_PATH)
const danglingReferences = () => findDanglingReferences(TEST_DB_PATH)
const importRows = (
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date = IMPORTED_AT
) => importArchiveRows(prisma, archive, action, importedAt)
const planImport = (archive: OpenedUnifiedArchive, action: ImportAction) =>
  planArchiveImport(prisma, archive, action)

const readFileIfExists = (filePath: string): Buffer | null =>
  fs.existsSync(filePath) ? fs.readFileSync(filePath) : null

const dataFilePath = (relativePath: string): string =>
  path.join(DATA_DIR, ...relativePath.split("/"))

/** 返却版の中身（returnSnapshot.ts の形）。採点枠の id と、id でない文字列を持つ */
const snapshotContentFor = (fixture: UnifiedArchiveFixture) => ({
  v: 1,
  scores: fixture.examA.cropRegions.map((cropRegion) => ({
    r: cropRegion.id,
    s: "correct",
    p: null,
  })),
  annotations: [{ r: fixture.examA.cropRegions[0].id, t: "text", tx: "正解" }],
})

describe("id を埋め込んだ列の書き換え", () => {
  it("文字列の値が旧 id と完全一致するものだけを新しい id にし、キーと部分一致は触らない", () => {
    const oldId = crypto.randomUUID()
    const newId = crypto.randomUUID()
    const remapped = remapEmbeddedIds(
      JSON.stringify({
        [oldId]: oldId,
        list: [oldId, `${oldId}_page1`, 3, null],
      }),
      new Map([[oldId, newId]])
    )
    expect(remapped).toEqual({
      kind: "ok",
      text: JSON.stringify({
        [oldId]: newId,
        list: [newId, `${oldId}_page1`, 3, null],
      }),
    })
  })

  it("何も変わらなければ元の文字列のまま、JSON として読めなければ unparsable", () => {
    const jsonText = '{ "v": 1.0 }'
    expect(remapEmbeddedIds(jsonText, new Map([["a", "b"]]))).toEqual({
      kind: "ok",
      text: jsonText,
    })
    expect(remapEmbeddedIds("{壊れた", new Map([["a", "b"]]))).toEqual({
      kind: "unparsable",
    })
  })
})

describe("表を書く順番", () => {
  it("登録表の全ての表を、参照する先が必ず先になる順に並べ、今の schema では検査を遅らせなくてよい", () => {
    const order = orderArchiveTables(Object.keys(ARCHIVE_TABLES))
    expect([...order.tables].sort()).toEqual(Object.keys(ARCHIVE_TABLES).sort())
    const positionByTable = new Map(
      order.tables.map((table, position) => [table, position])
    )
    for (const [table, spec] of Object.entries(ARCHIVE_TABLES)) {
      for (const reference of spec.references) {
        expect(
          positionByTable.get(reference.table) ?? Infinity,
          `${table}.${reference.column} → ${reference.table}`
        ).toBeLessThan(positionByTable.get(table) ?? -1)
      }
    }
    expect(order.needsDeferredForeignKeys).toBe(false)
  })
})

describe("統合アーカイブの取り込み", () => {
  let fixture: UnifiedArchiveFixture
  let fileFixture: UnifiedArchiveFileFixture
  let fileContentsByPath: Map<string, Buffer>
  let auditLogId: string
  let returnSnapshotId: string
  let archive: OpenedUnifiedArchive
  /** archive.db の表ごとの id */
  let archiveIds: Map<string, string[]>
  /** 書き出す前のテスト DB の、範囲の行 */
  let rowsBeforeExport: TableRows

  const allImagePaths = (): string[] => [
    ...new Set([
      ...fileFixture.examPageImagePaths,
      ...fileFixture.studentAnswerImagePaths,
      ...fileFixture.asbImagePaths,
    ]),
  ]

  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
    fileFixture = await createUnifiedArchiveFileFixture(prisma, fixture)
    fileContentsByPath = writeDataDirectoryFiles(DATA_DIR, allImagePaths())
    await prisma.user.update({
      where: { id: fixture.examA.user.id },
      data: { passcode: "1234", passcodeType: "pin" },
    })
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: fixture.examA.user.id,
        action: "exam.update",
        category: "exam",
        scopeId: fixture.examA.exam.id,
        entityType: "Exam",
        entityId: fixture.examA.exam.id,
        summary: "試験名を変えた",
      },
    })
    auditLogId = auditLog.id
    // 返却版の中身は、採点枠の id を JSON に埋め込んでいる（登録表の参照の外）
    const returnSnapshot = await prisma.returnSnapshot.create({
      data: {
        examStudentId: fixture.examA.examStudents[0].id,
        scoresJson: JSON.stringify(snapshotContentFor(fixture)),
        capturedByUserId: fixture.examA.user.id,
      },
    })
    returnSnapshotId = returnSnapshot.id

    const exported = await createUnifiedArchive({
      sourceDatabasePath: TEST_DB_PATH,
      dataDirectory: DATA_DIR,
      outputPath: OUTPUT_PATH,
      selection: {
        roots: {
          Exam: [fixture.examA.exam.id],
          Coursework: [fixture.courseworkId],
          Grade: [fixture.gradeId],
          AsbDefinition: [fileFixture.asbDefinitionId],
        },
        optionalItems: ["userSettings", "auditLog"],
      },
      exportedByUserId: fixture.examA.user.id,
      appVersion: "0.0.0-test",
    })
    archive = openArchiveForTest(OUTPUT_PATH, exported.manifest)
    archiveIds = readArchiveIds(archive.databasePath)
    rowsBeforeExport = readRowsByIds(archiveIds)
  })

  afterAll(async () => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("書き出し → 空の DB へ統合で取り込むと、範囲の全表の行が全列で書き出し前と一致し、画像も写る", async () => {
    // 範囲が試験・資料・成績算出・解答用紙定義・在籍・採点・監査ログまで及んでいること
    for (const table of [
      "Exam",
      "Coursework",
      "Grade",
      "AsbDefinition",
      "AsbImageElement",
      "StudentClassroomMembership",
      "QuestionScore",
      "GradeComparison",
      "UserPreference",
      "AuditLog",
    ]) {
      expect(archiveIds.get(table)?.length ?? 0, table).toBeGreaterThan(0)
    }

    await cleanupTestDatabase()
    fs.rmSync(DATA_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    for (const [table, rows] of readRowsByIds(archiveIds)) {
      expect(rows, `${table} が空になっていない`).toEqual([])
    }

    const plan = await importRows(archive, "merge")
    const files = importUnifiedArchiveFiles(archive, DATA_DIR, "merge", {})

    for (const [table, ids] of archiveIds) {
      expect(plan.counts[table], table).toEqual({
        created: ids.length,
        replaced: 0,
        kept: 0,
      })
    }
    expect(Object.keys(plan.counts).sort()).toEqual(
      [...archiveIds.keys()].sort()
    )
    expect(plan.uniqueConflicts).toEqual([])
    expect(plan.idMap).toEqual({})

    const rowsAfterImport = readRowsByIds(archiveIds)
    for (const [table, rows] of rowsBeforeExport) {
      expect(rowsAfterImport.get(table), table).toEqual(rows)
    }
    // 作り直した利用者は passcode を持たない
    const users = await prisma.user.findMany({
      where: { id: { in: archiveIds.get("User") ?? [] } },
    })
    for (const user of users) {
      expect(user.passcode, user.id).toBeNull()
      expect(user.passcodeType, user.id).toBe("none")
    }
    expect(danglingReferences()).toEqual([])

    expect(files.failed).toEqual([])
    expect(files.copied.sort()).toEqual(allImagePaths().sort())
    for (const imagePath of allImagePaths()) {
      expect(
        readFileIfExists(dataFilePath(imagePath))?.equals(
          fileContentsByPath.get(imagePath) ?? Buffer.alloc(0)
        ),
        imagePath
      ).toBe(true)
    }
  })

  it("同じ DB へ統合で取り込むと、全行が残り、何も変わらない", async () => {
    const countsBefore = countTestDatabaseRows()

    const plan = await importRows(archive, "merge")
    const files = importUnifiedArchiveFiles(archive, DATA_DIR, "merge", {})

    for (const [table, ids] of archiveIds) {
      expect(plan.counts[table], table).toEqual({
        created: 0,
        replaced: 0,
        kept: ids.length,
      })
    }
    expect(countTestDatabaseRows()).toEqual(countsBefore)
    const rowsAfterImport = readRowsByIds(archiveIds)
    for (const [table, rows] of rowsBeforeExport) {
      expect(rowsAfterImport.get(table), table).toEqual(rows)
    }
    expect(files.skipped.sort()).toEqual(allImagePaths().sort())
    expect(files.copied).toEqual([])
  })

  it("上書き: 全行を置き換え、updatedAt は取り込み時刻、createdAt は動かさず、既存の画像も置き換える", async () => {
    await prisma.exam.update({
      where: { id: fixture.examA.exam.id },
      data: { examName: "取り込み先で変えた名前" },
    })
    const changedImagePath = fileFixture.examPageImagePaths[0]
    fs.writeFileSync(dataFilePath(changedImagePath), "取り込み先で変えた画像")

    const plan = await importRows(archive, "overwrite")
    const files = importUnifiedArchiveFiles(archive, DATA_DIR, "overwrite", {})

    for (const [table, ids] of archiveIds) {
      // 監査ログは3択に関わらず書き換えない
      const expected =
        table === "AuditLog"
          ? { created: 0, replaced: 0, kept: ids.length }
          : { created: 0, replaced: ids.length, kept: 0 }
      expect(plan.counts[table], table).toEqual(expected)
    }

    const rowsAfterImport = readRowsByIds(archiveIds)
    for (const [table, rowsBefore] of rowsBeforeExport) {
      const rowsAfter = rowsAfterImport.get(table) ?? []
      expect(rowsAfter.length, table).toBe(rowsBefore.length)
      rowsBefore.forEach((rowBefore, position) => {
        const rowAfter = rowsAfter[position]
        expect(rowAfter.createdAt, `${table}.createdAt`).toEqual(
          rowBefore.createdAt
        )
        const expectedUpdatedAt =
          table === "AuditLog" ? rowBefore.updatedAt : IMPORTED_AT.toISOString()
        expect(rowAfter.updatedAt, `${table}.updatedAt`).toEqual(
          expectedUpdatedAt
        )
        const withoutTimestamps = (row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(
              ([column]) => column !== "updatedAt" && column !== "createdAt"
            )
          )
        expect(withoutTimestamps(rowAfter), table).toEqual(
          withoutTimestamps(rowBefore)
        )
      })
    }
    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: fixture.examA.exam.id },
    })
    expect(exam.examName).toBe("試験A")

    expect(files.failed).toEqual([])
    expect(files.replaced.sort()).toEqual(allImagePaths().sort())
    expect(
      readFileIfExists(dataFilePath(changedImagePath))?.equals(
        fileContentsByPath.get(changedImagePath) ?? Buffer.alloc(0)
      )
    ).toBe(true)
  })

  it("統合の LWW: 取り込み先で新しくした行は残し、古い行はアーカイブの値と時刻で置き換える", async () => {
    const newerAt = new Date("2099-01-01T00:00:00.000Z")
    const olderAt = new Date("2000-01-01T00:00:00.000Z")
    await prisma.exam.update({
      where: { id: fixture.examA.exam.id },
      data: { examName: "取り込み先で新しくした名前", updatedAt: newerAt },
    })
    const student = fixture.examA.students[0]
    await prisma.student.update({
      where: { id: student.id },
      data: { lastName: "取り込み先の古い姓", updatedAt: olderAt },
    })

    const plan = await importRows(archive, "merge")

    expect(plan.counts.Exam).toEqual({ created: 0, replaced: 0, kept: 1 })
    expect(plan.counts.Student.replaced).toBe(1)
    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: fixture.examA.exam.id },
    })
    expect(exam.examName).toBe("取り込み先で新しくした名前")
    expect(exam.updatedAt.toISOString()).toBe(newerAt.toISOString())

    const studentRowBefore = rowsBeforeExport
      .get("Student")
      ?.find((row) => row.id === student.id)
    const studentRowAfter = readRowsByIds(
      new Map([["Student", [student.id]]])
    ).get("Student")?.[0]
    expect(studentRowAfter).toEqual(studentRowBefore)
  })

  it("別で追加: 根と子孫の id を振り直して倍に増やし、元の行と共通の実体には触らず、画像とパスを新しい id へ写す", async () => {
    const countsBefore = countTestDatabaseRows()

    const plan = await importRows(archive, "separate")
    const files = importUnifiedArchiveFiles(
      archive,
      DATA_DIR,
      "separate",
      plan.idMap
    )

    const sharedTables = new Set([
      "User",
      "Student",
      "Classroom",
      "StudentClassroomMembership",
      "SubtotalGroup",
      "Subtotal",
      "Tag",
      "TagSubtotalGroup",
      "UserPreference",
      "AuditLog",
    ])
    const countsAfter = countTestDatabaseRows()
    for (const [table, ids] of archiveIds) {
      const renumbered = Object.keys(plan.idMap[table] ?? {})
      if (sharedTables.has(table)) {
        expect(renumbered, table).toEqual([])
        expect(plan.counts[table], table).toEqual({
          created: 0,
          replaced: 0,
          kept: ids.length,
        })
        expect(countsAfter.get(table), table).toBe(countsBefore.get(table))
      } else {
        // 根の子孫は全部振り直し、全部を新しく作る
        expect(renumbered.sort(), table).toEqual([...ids].sort())
        expect(plan.counts[table], table).toEqual({
          created: ids.length,
          replaced: 0,
          kept: 0,
        })
        expect(countsAfter.get(table), table).toBe(
          (countsBefore.get(table) ?? 0) + ids.length
        )
      }
    }
    // 元の行は無傷
    const rowsAfterImport = readRowsByIds(archiveIds)
    for (const [table, rows] of rowsBeforeExport) {
      expect(rowsAfterImport.get(table), table).toEqual(rows)
    }
    expect(danglingReferences()).toEqual([])

    // 新しい試験の配下は新しい試験を指し、共通の実体（生徒）は既存のまま
    const newExamId = plan.idMap.Exam?.[fixture.examA.exam.id]
    expect(newExamId).toBeDefined()
    const newExamStudents = await prisma.examStudent.findMany({
      where: { examId: newExamId },
    })
    expect(
      newExamStudents.map((examStudent) => examStudent.studentId).sort()
    ).toEqual(
      fixture.examA.examStudents
        .map((examStudent) => examStudent.studentId)
        .sort()
    )
    const newDataSources = await prisma.gradeDataSource.findMany({
      where: { gradeItem: { gradeId: plan.idMap.Grade?.[fixture.gradeId] } },
    })
    expect(newDataSources.map((dataSource) => dataSource.examId)).toContain(
      newExamId
    )

    // 画像は新しい id のパスに写り、DB のパスも新しい id を指す
    const newIdByOldId = new Map(
      Object.values(plan.idMap).flatMap((tableIdMap) =>
        Object.entries(tableIdMap)
      )
    )
    const remappedImagePaths = allImagePaths()
      .map((imagePath) => remapArchiveFilePath(imagePath, newIdByOldId))
      .sort()
    expect(
      remappedImagePaths.every(
        (imagePath) => !allImagePaths().includes(imagePath)
      )
    ).toBe(true)
    expect(files.failed).toEqual([])
    expect(files.copied.sort()).toEqual(remappedImagePaths)
    for (const imagePath of allImagePaths()) {
      const remappedPath = remapArchiveFilePath(imagePath, newIdByOldId)
      expect(
        readFileIfExists(dataFilePath(remappedPath))?.equals(
          fileContentsByPath.get(imagePath) ?? Buffer.alloc(0)
        ),
        remappedPath
      ).toBe(true)
    }
    const newPages = await prisma.examPage.findMany({
      where: { examId: newExamId },
    })
    const newAnswerImages = await prisma.studentAnswerImage.findMany({
      where: { examPage: { examId: newExamId } },
    })
    const newAsbImages = await prisma.asbImageElement.findMany({
      where: {
        subQuestion: {
          majorQuestion: {
            definitionId:
              plan.idMap.AsbDefinition?.[fileFixture.asbDefinitionId],
          },
        },
      },
    })
    const newDatabasePaths = [
      ...newPages.map((page) => page.imagePath),
      ...newAnswerImages.map((answerImage) => answerImage.imagePath),
      ...newAsbImages.map((asbImage) => asbImage.imagePath),
    ].sort()
    expect(newDatabasePaths).toEqual(remappedImagePaths)
  })

  it("利用者の passcode と passcodeType は、上書きでも取り込み先の値のまま", async () => {
    await prisma.user.update({
      where: { id: fixture.examA.user.id },
      data: { passcode: "9999", passcodeType: "password" },
    })

    await importRows(archive, "overwrite")

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.examA.user.id },
    })
    expect(user.passcode).toBe("9999")
    expect(user.passcodeType).toBe("password")
    expect(user.updatedAt.toISOString()).toBe(IMPORTED_AT.toISOString())
  })

  it("一意制約の衝突: 取り込み先に別 id・同じ一意キーの行があれば、何も書かずに止める", async () => {
    // 書き出した後で、利用者の設定を別 id・同じ (userId, key) の行に作り直す
    const preferenceId = fixture.preferenceIds.scorer
    await prisma.userPreference.delete({ where: { id: preferenceId } })
    const replacement = await prisma.userPreference.create({
      data: { userId: fixture.examA.user.id, key: "theme", value: "light" },
    })
    // 取り込めば作られるはずの行も消しておく（止まったら作られないことを見る）
    await prisma.exam.delete({ where: { id: fixture.examA.exam.id } })
    const countsBefore = countTestDatabaseRows()

    const plan = await planImport(archive, "merge")
    expect(plan.uniqueConflicts).toEqual([
      {
        table: "UserPreference",
        columns: ["userId", "key"],
        archiveId: preferenceId,
        existingId: replacement.id,
        migrated: false,
      },
    ])

    const failure = await importRows(archive, "merge").catch(
      (error: unknown) => error
    )
    expect(failure).toBeInstanceOf(UnifiedArchiveUniqueConflictError)
    if (failure instanceof UnifiedArchiveUniqueConflictError) {
      expect(failure.conflicts).toEqual(plan.uniqueConflicts)
    }
    expect(countTestDatabaseRows()).toEqual(countsBefore)
  })

  it("監査ログは追記だけ: 在れば3択に関わらず書き換えず、無ければアーカイブの時刻のまま作る", async () => {
    const changedAt = new Date("2000-01-01T00:00:00.000Z")
    await prisma.auditLog.update({
      where: { id: auditLogId },
      data: { summary: "取り込み先で変えた要約", updatedAt: changedAt },
    })

    const actions: ImportAction[] = ["overwrite", "merge"]
    for (const action of actions) {
      const plan = await importRows(archive, action)
      expect(plan.counts.AuditLog, action).toEqual({
        created: 0,
        replaced: 0,
        kept: 1,
      })
    }
    const kept = await prisma.auditLog.findUniqueOrThrow({
      where: { id: auditLogId },
    })
    expect(kept.summary).toBe("取り込み先で変えた要約")
    expect(kept.updatedAt.toISOString()).toBe(changedAt.toISOString())

    await prisma.auditLog.delete({ where: { id: auditLogId } })
    const plan = await importRows(archive, "overwrite")
    expect(plan.counts.AuditLog).toEqual({ created: 1, replaced: 0, kept: 0 })
    const recreated = readRowsByIds(new Map([["AuditLog", [auditLogId]]]))
    expect(recreated.get("AuditLog")).toEqual(rowsBeforeExport.get("AuditLog"))
  })

  it("別で追加: 新しい返却版の scoresJson は新しい採点枠の id を指し、元の返却版は旧 id のまま", async () => {
    const plan = await importRows(archive, "separate")

    expect(plan.warnings).toEqual([])
    const newSnapshotId = plan.idMap.ReturnSnapshot?.[returnSnapshotId]
    expect(newSnapshotId).toBeDefined()
    const newSnapshot = await prisma.returnSnapshot.findUniqueOrThrow({
      where: { id: newSnapshotId },
    })
    expect(newSnapshot.examStudentId).toBe(
      plan.idMap.ExamStudent?.[fixture.examA.examStudents[0].id]
    )
    const newCropRegionIdOf = (cropRegionId: string) =>
      plan.idMap.CropRegion?.[cropRegionId]
    const original = snapshotContentFor(fixture)
    expect(JSON.parse(newSnapshot.scoresJson)).toEqual({
      ...original,
      scores: original.scores.map((score) => ({
        ...score,
        r: newCropRegionIdOf(score.r),
      })),
      annotations: original.annotations.map((annotation) => ({
        ...annotation,
        r: newCropRegionIdOf(annotation.r),
      })),
    })

    const originalSnapshot = await prisma.returnSnapshot.findUniqueOrThrow({
      where: { id: returnSnapshotId },
    })
    expect(JSON.parse(originalSnapshot.scoresJson)).toEqual(original)
  })

  it("別で追加: 返却版の scoresJson が JSON として読めなければ、元の値のまま書いて警告に載せる", async () => {
    const brokenArchive = openArchiveForTest(OUTPUT_PATH, archive.manifest)
    const brokenDatabase = new Database(brokenArchive.databasePath)
    try {
      brokenDatabase
        .prepare<[string, string]>(
          `UPDATE "ReturnSnapshot" SET scoresJson = ? WHERE id = ?`
        )
        .run("{壊れた", returnSnapshotId)
    } finally {
      brokenDatabase.close()
    }

    const plan = await importRows(brokenArchive, "separate")

    expect(plan.warnings).toHaveLength(1)
    expect(plan.warnings[0]).toContain(returnSnapshotId)
    const newSnapshot = await prisma.returnSnapshot.findUniqueOrThrow({
      where: { id: plan.idMap.ReturnSnapshot?.[returnSnapshotId] },
    })
    expect(newSnapshot.scoresJson).toBe("{壊れた")
  })
})
