/**
 * 統合アーカイブ（.sao）の取り込み: 一意制約の衝突の解決と id の選択、照合の決定、試し取り込み
 *
 * テスト対象:
 *   electron-src/lib/import/unified-archive/archiveRowImporter.ts
 *   electron-src/lib/import/unified-archive/archiveTableResolver.ts
 *   electron-src/lib/import/unified-archive/archiveIdRenamer.ts
 *
 * 規則は docs/unified-archive-design.md §7.3・§9（段階4）:
 * - 一意制約の衝突も3択に従う。上書き・統合は採用する id を選ぶ（既定は取り込み先の id、1件ずつ
 *   変えられる）。別で追加は既存に固定し、アーカイブ側の子を既存の行へ付け替える
 * - アーカイブの id を採るときは、取り込み先の行と子の外部キーを UPDATE で付け替える
 * - 衝突は親の付け替えから子へ連鎖する（ExamStudent を寄せると ScoreDecision がぶつかる）
 * - 現行化で生まれた行の統合の LWW は manifest.exportedAt で比べる
 * - 照合の決定（同じもの / 新規 / 取り込まない）を当てる
 *
 * 行の取り込みの基本（往復・3択・別で追加の振り直し）は unifiedArchiveImport.test.ts が見る。
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { ARCHIVE_FILE_COLUMNS } from "../../../electron-src/lib/export/unified-archive/archiveFileCollector"
import { createUnifiedArchive } from "../../../electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import { importUnifiedArchiveFiles } from "../../../electron-src/lib/import/unified-archive/archiveFileImporter"
import {
  type UnifiedArchiveImportResult,
  UnifiedArchiveUnresolvableConflictError,
} from "../../../electron-src/lib/import/unified-archive/archiveRowImporter"
import { listArchiveUniqueIndexes } from "../../../electron-src/lib/import/unified-archive/archiveUniqueIndexes"
import {
  archiveRowKey,
  type OpenedUnifiedArchive,
  type UnifiedArchiveImportDecisions,
} from "../../../electron-src/lib/import/unified-archive/types"
import type { ImportAction } from "../../../src/types/importAction.types"
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
  analyzeArchiveImport,
  countTableRows,
  findDanglingReferences,
  importArchiveRows,
  openArchiveForTest,
  readRowsByIds,
  readTableIds,
  type TableRows,
} from "../../helpers/unifiedArchiveImportHelpers"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const WORK_DIR = path.join(os.tmpdir(), "unified-archive-import-conflict")
const DATA_DIR = path.join(WORK_DIR, "data")
const OUTPUT_PATH = path.join(WORK_DIR, "export.sao")
const IMPORTED_AT = new Date("2026-10-05T09:00:00.000Z")

/** 照合で付け替えうる表（archiveMatchCandidates の対象） */
const MATCHED_TABLES = ["Student", "Classroom", "SubtotalGroup", "User"]

const importRows = (
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  decisions: UnifiedArchiveImportDecisions = {}
) => importArchiveRows(prisma, archive, action, IMPORTED_AT, decisions)

/** テスト DB の全ての行（表 → 行） */
const readAllTestRows = (): TableRows =>
  readRowsByIds(TEST_DB_PATH, readTableIds(TEST_DB_PATH))

/** 表と id の順に並べる（表を書く順は外部キーの位相順で、見た目の順ではない） */
const byTableAndId = <Entry extends { table: string }>(
  entries: readonly Entry[],
  idOf: (entry: Entry) => string
): Entry[] =>
  [...entries].sort(
    (left, right) =>
      left.table.localeCompare(right.table) ||
      idOf(left).localeCompare(idOf(right))
  )

const conflictSummary = (result: UnifiedArchiveImportResult) =>
  byTableAndId(
    result.uniqueConflicts.map((conflict) => ({
      table: conflict.table,
      archiveId: conflict.archiveId,
      existingId: conflict.existingId,
      resolution: conflict.resolution,
    })),
    (conflict) => conflict.archiveId
  )

const renamedSummary = (result: UnifiedArchiveImportResult) =>
  byTableAndId(result.renamedIds, (renamedId) => renamedId.toId)

const catchError = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => null,
    (error: unknown) => error
  )

const dataFilePath = (relativePath: string): string =>
  path.join(DATA_DIR, ...relativePath.split("/"))

/** データディレクトリを空にする（取り込み先にファイルが無い状態） */
const emptyDataDirectory = (): void => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

describe("統合アーカイブの取り込み: 衝突と照合", () => {
  let fixture: UnifiedArchiveFixture
  let fileFixture: UnifiedArchiveFileFixture
  let archive: OpenedUnifiedArchive
  /** archive.db の行（表 → 行） */
  let archiveRows: TableRows

  const archiveRowsOf = (table: string): Record<string, unknown>[] =>
    archiveRows.get(table) ?? []
  const firstExamStudent = () => fixture.examA.examStudents[0]

  /**
   * 同期しない2台で同じ試験に同じ生徒を足した状況を作る: 書き出した後の取り込み先で、受験生を
   * 消して（子もカスケードで消える）、同じ試験・同じ生徒の受験生を別の id で作り直し、採点・答案・
   * （withDecision なら）確定と返却版も足す
   */
  const recreateExamStudent = async (
    examStudent: { id: string; examId: string; studentId: string },
    withDecision: boolean
  ) => {
    await prisma.examStudent.delete({ where: { id: examStudent.id } })
    const recreated = await prisma.examStudent.create({
      data: {
        examId: examStudent.examId,
        studentId: examStudent.studentId,
        status: "PARTICIPATING",
      },
    })
    const cropRegion = fixture.examA.cropRegions[0]
    const page = fixture.examA.pages[0]
    const questionScore = await prisma.questionScore.create({
      data: {
        cropRegionId: cropRegion.id,
        examStudentId: recreated.id,
        userId: fixture.examA.user.id,
        status: "incorrect",
      },
    })
    const answerImage = await prisma.studentAnswerImage.create({
      data: {
        examPageId: page.id,
        examStudentId: recreated.id,
        imagePath: `exams/${examStudent.examId}/answer-sheets/${recreated.id}_page${page.pageNumber}.png`,
      },
    })
    const scoreDecision = withDecision
      ? await prisma.scoreDecision.create({
          data: {
            cropRegionId: cropRegion.id,
            examStudentId: recreated.id,
            verdict: "incorrect",
            decidedByUserId: fixture.otherScorer.id,
          },
        })
      : null
    const returnSnapshot = withDecision
      ? await prisma.returnSnapshot.create({
          data: {
            examStudentId: recreated.id,
            scoresJson: JSON.stringify({ v: 1, scores: [], annotations: [] }),
          },
        })
      : null
    return {
      examStudentId: recreated.id,
      questionScoreId: questionScore.id,
      answerImageId: answerImage.id,
      scoreDecisionId: scoreDecision?.id ?? null,
      returnSnapshotId: returnSnapshot?.id ?? null,
    }
  }

  /** アーカイブの、受験生 examStudentId の表 table の行の id */
  const archiveChildIdsOf = (
    table: string,
    examStudentId: string,
    filter: (row: Record<string, unknown>) => boolean = () => true
  ): string[] =>
    archiveRowsOf(table)
      .filter((row) => row.examStudentId === examStudentId && filter(row))
      .flatMap((row) => (typeof row.id === "string" ? [row.id] : []))

  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
    fileFixture = await createUnifiedArchiveFileFixture(prisma, fixture)
    writeDataDirectoryFiles(DATA_DIR, [
      ...new Set([
        ...fileFixture.examPageImagePaths,
        ...fileFixture.studentAnswerImagePaths,
        ...fileFixture.asbImagePaths,
      ]),
    ])
    await prisma.returnSnapshot.create({
      data: {
        examStudentId: firstExamStudent().id,
        scoresJson: JSON.stringify({ v: 1, scores: [], annotations: [] }),
        capturedByUserId: fixture.examA.user.id,
      },
    })
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
        optionalItems: ["userSettings"],
      },
      exportedByUserId: fixture.examA.user.id,
      appVersion: "0.0.0-test",
    })
    archive = openArchiveForTest(OUTPUT_PATH, exported.manifest, WORK_DIR)
    archiveRows = readRowsByIds(
      archive.databasePath,
      readTableIds(archive.databasePath)
    )
  })

  afterAll(async () => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  describe("受験生の衝突（同じ試験・同じ生徒が別 id）", () => {
    it("既定（取り込み先の id）+ 統合: 受験生は既存の id のまま、アーカイブの子は既存の受験生を指し、連鎖した確定・答案・返却版の衝突も解ける", async () => {
      const archiveExamStudentId = firstExamStudent().id
      const recreated = await recreateExamStudent(firstExamStudent(), true)
      const archiveScoreIds = archiveChildIdsOf(
        "QuestionScore",
        archiveExamStudentId
      )
      expect(archiveScoreIds.length).toBeGreaterThan(1)
      const [archiveDecisionId] = archiveChildIdsOf(
        "ScoreDecision",
        archiveExamStudentId
      )
      const [archiveSnapshotId] = archiveChildIdsOf(
        "ReturnSnapshot",
        archiveExamStudentId
      )
      const [archiveAnswerImageId] = archiveChildIdsOf(
        "StudentAnswerImage",
        archiveExamStudentId,
        (row) => row.examPageId === fixture.examA.pages[0].id
      )

      const result = await importRows(archive, "merge")

      expect(conflictSummary(result)).toEqual(
        byTableAndId(
          [
            {
              table: "ExamStudent",
              archiveId: archiveExamStudentId,
              existingId: recreated.examStudentId,
              resolution: "existing",
            },
            {
              table: "StudentAnswerImage",
              archiveId: archiveAnswerImageId,
              existingId: recreated.answerImageId,
              resolution: "existing",
            },
            {
              table: "ScoreDecision",
              archiveId: archiveDecisionId,
              existingId: recreated.scoreDecisionId,
              resolution: "existing",
            },
            {
              table: "ReturnSnapshot",
              archiveId: archiveSnapshotId,
              existingId: recreated.returnSnapshotId,
              resolution: "existing",
            },
          ],
          (conflict) => conflict.archiveId
        )
      )
      const examStudentConflict = result.uniqueConflicts.find(
        (conflict) => conflict.table === "ExamStudent"
      )
      if (!examStudentConflict) throw new Error("受験生の衝突が無い")
      expect(examStudentConflict.columns).toEqual(["examId", "studentId"])
      expect(examStudentConflict.migrated).toBe(false)
      expect(examStudentConflict.archiveRow.id).toBe(archiveExamStudentId)
      expect(examStudentConflict.existingRow.id).toBe(recreated.examStudentId)
      expect(result.renamedIds).toEqual([])
      expect(result.idMap.ExamStudent).toEqual({
        [archiveExamStudentId]: recreated.examStudentId,
      })

      expect(
        await prisma.examStudent.findUnique({
          where: { id: archiveExamStudentId },
        })
      ).toBeNull()
      const scores = await prisma.questionScore.findMany({
        where: { id: { in: archiveScoreIds } },
      })
      expect(scores.map((score) => score.examStudentId)).toEqual(
        archiveScoreIds.map(() => recreated.examStudentId)
      )
      const decisions = await prisma.scoreDecision.findMany({
        where: { examStudentId: recreated.examStudentId },
      })
      expect(decisions.map((decision) => decision.id)).toEqual([
        recreated.scoreDecisionId,
      ])
      const snapshots = await prisma.returnSnapshot.findMany({
        where: { examStudentId: recreated.examStudentId },
      })
      expect(snapshots.map((snapshot) => snapshot.id)).toEqual([
        recreated.returnSnapshotId,
      ])
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])

      // 既存へ寄せて書かなかった答案（取り込み先の行は別のパスを指す）の画像は写さない
      const archiveAnswerImagePath = archiveRowsOf("StudentAnswerImage").find(
        (row) => row.id === archiveAnswerImageId
      )?.imagePath
      const files = importUnifiedArchiveFiles(archive, DATA_DIR, result)
      expect(files.unreferenced).toEqual([archiveAnswerImagePath])
      expect(files.copied).toEqual([])
      expect(files.failed).toEqual([])
    })

    it("アーカイブの id + 統合: 取り込み先の受験生と子の id がアーカイブの id へ付け替わり、外部キーが閉じている", async () => {
      const archiveExamStudentId = firstExamStudent().id
      const recreated = await recreateExamStudent(firstExamStudent(), true)
      const [archiveDecisionId] = archiveChildIdsOf(
        "ScoreDecision",
        archiveExamStudentId
      )
      const [archiveSnapshotId] = archiveChildIdsOf(
        "ReturnSnapshot",
        archiveExamStudentId
      )
      const [archiveAnswerImageId] = archiveChildIdsOf(
        "StudentAnswerImage",
        archiveExamStudentId,
        (row) => row.examPageId === fixture.examA.pages[0].id
      )

      const result = await importRows(archive, "merge", {
        conflictIdChoice: "archive",
      })

      expect(renamedSummary(result)).toEqual(
        byTableAndId(
          [
            {
              table: "ExamStudent",
              fromId: recreated.examStudentId,
              toId: archiveExamStudentId,
            },
            {
              table: "StudentAnswerImage",
              fromId: recreated.answerImageId,
              toId: archiveAnswerImageId,
            },
            {
              table: "ScoreDecision",
              fromId: recreated.scoreDecisionId,
              toId: archiveDecisionId,
            },
            {
              table: "ReturnSnapshot",
              fromId: recreated.returnSnapshotId,
              toId: archiveSnapshotId,
            },
          ],
          (renamedId) => renamedId.toId
        )
      )
      expect(
        result.uniqueConflicts.every(
          (conflict) => conflict.resolution === "archive"
        )
      ).toBe(true)
      expect(result.idMap).toEqual({})

      expect(
        await prisma.examStudent.findUnique({
          where: { id: recreated.examStudentId },
        })
      ).toBeNull()
      const examStudent = await prisma.examStudent.findUniqueOrThrow({
        where: { id: archiveExamStudentId },
      })
      expect(examStudent.studentId).toBe(firstExamStudent().studentId)
      // 取り込み先にだけあった採点も、付け替えた受験生を指す（削除して作り直していない）
      const targetScore = await prisma.questionScore.findUniqueOrThrow({
        where: { id: recreated.questionScoreId },
      })
      expect(targetScore.examStudentId).toBe(archiveExamStudentId)
      expect(
        (
          await prisma.scoreDecision.findMany({
            where: { examStudentId: archiveExamStudentId },
          })
        ).map((decision) => decision.id)
      ).toEqual([archiveDecisionId])
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])
    })

    it("1件だけ上書きでアーカイブの id、他は取り込み先の id", async () => {
      const [first, second] = fixture.examA.examStudents
      const recreatedFirst = await recreateExamStudent(first, true)
      const recreatedSecond = await recreateExamStudent(second, false)

      const result = await importRows(archive, "merge", {
        conflictIdOverrides: {
          [archiveRowKey("ExamStudent", first.id)]: "archive",
        },
      })

      const examStudentConflicts = conflictSummary(result).filter(
        (conflict) => conflict.table === "ExamStudent"
      )
      expect(examStudentConflicts).toEqual(
        byTableAndId(
          [
            {
              table: "ExamStudent",
              archiveId: first.id,
              existingId: recreatedFirst.examStudentId,
              resolution: "archive",
            },
            {
              table: "ExamStudent",
              archiveId: second.id,
              existingId: recreatedSecond.examStudentId,
              resolution: "existing",
            },
          ],
          (conflict) => conflict.archiveId
        )
      )
      expect(
        result.renamedIds.filter(
          (renamedId) => renamedId.table === "ExamStudent"
        )
      ).toEqual([
        {
          table: "ExamStudent",
          fromId: recreatedFirst.examStudentId,
          toId: first.id,
        },
      ])
      expect(result.idMap.ExamStudent).toEqual({
        [second.id]: recreatedSecond.examStudentId,
      })
      const examStudentIds = (
        await prisma.examStudent.findMany({
          where: { id: { in: [first.id, second.id] } },
        })
      ).map((examStudent) => examStudent.id)
      expect(examStudentIds).toEqual([first.id])
      expect(
        await prisma.examStudent.findUnique({
          where: { id: recreatedSecond.examStudentId },
        })
      ).not.toBeNull()
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])
    })
  })

  it("別で追加: 一意制約の衝突は既存に固定し、アーカイブの行は書かず（kept）、写しは既存の行を指す", async () => {
    const preferenceId = fixture.preferenceIds.scorer
    await prisma.userPreference.delete({ where: { id: preferenceId } })
    const replacement = await prisma.userPreference.create({
      data: { userId: fixture.examA.user.id, key: "theme", value: "light" },
    })

    const result = await importRows(archive, "separate", {
      conflictIdChoice: "archive",
    })

    expect(conflictSummary(result)).toEqual([
      {
        table: "UserPreference",
        archiveId: preferenceId,
        existingId: replacement.id,
        resolution: "keptExisting",
      },
    ])
    expect(result.counts.UserPreference).toEqual({
      created: 0,
      replaced: 0,
      kept: 1,
      skipped: 0,
    })
    expect(result.renamedIds).toEqual([])
    expect(result.idMap.UserPreference).toEqual({
      [preferenceId]: replacement.id,
    })
    expect(
      await prisma.userPreference.findUnique({ where: { id: preferenceId } })
    ).toBeNull()
    const kept = await prisma.userPreference.findUniqueOrThrow({
      where: { id: replacement.id },
    })
    expect(kept.value).toBe("light")
  })

  it("統合の LWW: 衝突した行が現行化で生まれた行なら、manifest.exportedAt で比べ、書く updatedAt はアーカイブの値のまま", async () => {
    const preferenceId = fixture.preferenceIds.scorer
    await prisma.userPreference.delete({ where: { id: preferenceId } })
    const replacement = await prisma.userPreference.create({
      data: {
        userId: fixture.examA.user.id,
        key: "theme",
        value: "light",
        updatedAt: new Date("2050-01-01T00:00:00.000Z"),
      },
    })
    const archivePreference = archiveRowsOf("UserPreference").find(
      (row) => row.id === preferenceId
    )
    const archiveWith = (exportedAt: string | null): OpenedUnifiedArchive =>
      exportedAt === null
        ? archive
        : {
            ...archive,
            manifest: { ...archive.manifest, exportedAt },
            migratedRowIds: { UserPreference: [preferenceId] },
          }
    const valueAfter = async () =>
      (
        await prisma.userPreference.findUniqueOrThrow({
          where: { id: replacement.id },
        })
      ).value

    // 現行化で生まれた行でなければ、アーカイブの updatedAt（書き出した時刻より前）で比べて負ける
    const plain = await importRows(archiveWith(null), "merge")
    expect(plain.counts.UserPreference.kept).toBe(1)
    expect(plain.uniqueConflicts[0].migrated).toBe(false)
    expect(await valueAfter()).toBe("light")

    const older = await importRows(
      archiveWith("2000-01-01T00:00:00.000Z"),
      "merge"
    )
    expect(older.counts.UserPreference.kept).toBe(1)
    expect(older.uniqueConflicts[0].migrated).toBe(true)
    expect(await valueAfter()).toBe("light")

    const newer = await importRows(
      archiveWith("2099-01-01T00:00:00.000Z"),
      "merge"
    )
    expect(newer.counts.UserPreference.replaced).toBe(1)
    const replaced = readRowsByIds(
      TEST_DB_PATH,
      new Map([["UserPreference", [replacement.id]]])
    ).get("UserPreference")?.[0]
    expect(replaced?.value).toBe("dark")
    expect(replaced?.updatedAt).toBe(archivePreference?.updatedAt)
  })

  describe("解けない衝突", () => {
    it("2つのアーカイブ行が同じ既存行に寄るなら、理由をつけて止め、何も書かない", async () => {
      await cleanupTestDatabase()
      const existing = await prisma.student.create({
        data: {
          studentNumber: "S001",
          lastName: "姓",
          firstName: "名",
          lastNameKana: "セイ",
          firstNameKana: "メイ",
        },
      })
      const [first, second] = fixture.examA.students
      const countsBefore = countTableRows(TEST_DB_PATH)

      const failure = await catchError(
        importRows(archive, "merge", {
          matches: {
            [archiveRowKey("Student", first.id)]: {
              kind: "same",
              existingId: existing.id,
              adoptId: "existing",
            },
            [archiveRowKey("Student", second.id)]: {
              kind: "same",
              existingId: existing.id,
              adoptId: "existing",
            },
          },
        })
      )

      expect(failure).toBeInstanceOf(UnifiedArchiveUnresolvableConflictError)
      if (failure instanceof UnifiedArchiveUnresolvableConflictError) {
        expect(failure.reasons).toEqual([
          {
            kind: "sharedExisting",
            table: "Student",
            columns: [],
            archiveIds: [first.id, second.id].sort(),
            existingIds: [existing.id],
          },
        ])
      }
      expect(countTableRows(TEST_DB_PATH)).toEqual(countsBefore)
    })

    it("付け替え先のアーカイブの id が取り込み先に既にあるなら止める", async () => {
      const other = await prisma.student.create({
        data: {
          studentNumber: "S999",
          lastName: "別",
          firstName: "人",
          lastNameKana: "ベツ",
          firstNameKana: "ヒト",
        },
      })
      const student = fixture.examA.students[0]

      const failure = await catchError(
        importRows(archive, "merge", {
          matches: {
            [archiveRowKey("Student", student.id)]: {
              kind: "same",
              existingId: other.id,
              adoptId: "archive",
            },
          },
        })
      )

      expect(failure).toBeInstanceOf(UnifiedArchiveUnresolvableConflictError)
      if (failure instanceof UnifiedArchiveUnresolvableConflictError) {
        expect(failure.reasons.map((reason) => reason.kind)).toEqual([
          "idTaken",
        ])
      }
      expect(
        await prisma.student.findUnique({ where: { id: other.id } })
      ).not.toBeNull()
    })
  })

  it("試し取り込み: 結果は本番の取り込みと一致し、DB は何も変わっていない", async () => {
    await recreateExamStudent(firstExamStudent(), true)
    const decisions: UnifiedArchiveImportDecisions = {
      conflictIdChoice: "archive",
    }
    const rowsBefore = readAllTestRows()

    const analysis = await analyzeArchiveImport(
      prisma,
      archive,
      "merge",
      IMPORTED_AT,
      decisions
    )

    expect(analysis.renamedIds.length).toBeGreaterThan(0)
    expect(readAllTestRows()).toEqual(rowsBefore)

    const result = await importRows(archive, "merge", decisions)
    expect(result).toEqual(analysis)
  })

  describe("照合の決定", () => {
    const createExistingStudent = (studentNumber: string) =>
      prisma.student.create({
        data: {
          studentNumber,
          lastName: "既存",
          firstName: "生徒",
          lastNameKana: "キゾン",
          firstNameKana: "セイト",
        },
      })

    it("同じもの・取り込み先の id: アーカイブの在籍・受験生が既存の生徒を指す", async () => {
      await cleanupTestDatabase()
      const student = fixture.examA.students[0]
      const existing = await createExistingStudent(student.studentNumber)

      const result = await importRows(archive, "merge", {
        matches: {
          [archiveRowKey("Student", student.id)]: {
            kind: "same",
            existingId: existing.id,
            adoptId: "existing",
          },
        },
      })

      expect(result.idMap.Student).toEqual({ [student.id]: existing.id })
      expect(
        await prisma.student.findUnique({ where: { id: student.id } })
      ).toBeNull()
      const examStudent = await prisma.examStudent.findUniqueOrThrow({
        where: { id: firstExamStudent().id },
      })
      expect(examStudent.studentId).toBe(existing.id)
      const membershipIds = archiveRowsOf("StudentClassroomMembership")
        .filter((row) => row.studentId === student.id)
        .flatMap((row) => (typeof row.id === "string" ? [row.id] : []))
      expect(membershipIds.length).toBeGreaterThan(0)
      const memberships = await prisma.studentClassroomMembership.findMany({
        where: { id: { in: membershipIds } },
      })
      expect(memberships.map((membership) => membership.studentId)).toEqual(
        membershipIds.map(() => existing.id)
      )
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])
    })

    it("同じもの・アーカイブの id: 既存の生徒の id と、その子の外部キーがアーカイブの id へ付け替わる", async () => {
      await cleanupTestDatabase()
      const student = fixture.examA.students[0]
      const existing = await createExistingStudent(student.studentNumber)
      const classroom = await prisma.classroom.create({
        data: { name: "取り込み先の学級" },
      })
      const targetMembership = await prisma.studentClassroomMembership.create({
        data: { studentId: existing.id, classroomId: classroom.id },
      })

      const result = await importRows(archive, "merge", {
        matches: {
          [archiveRowKey("Student", student.id)]: {
            kind: "same",
            existingId: existing.id,
            adoptId: "archive",
          },
        },
      })

      expect(result.renamedIds).toEqual([
        { table: "Student", fromId: existing.id, toId: student.id },
      ])
      expect(result.idMap.Student).toBeUndefined()
      expect(
        await prisma.student.findUnique({ where: { id: existing.id } })
      ).toBeNull()
      expect(
        await prisma.student.findUnique({ where: { id: student.id } })
      ).not.toBeNull()
      const membership =
        await prisma.studentClassroomMembership.findUniqueOrThrow({
          where: { id: targetMembership.id },
        })
      expect(membership.studentId).toBe(student.id)
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])
    })

    it("取り込まない: その生徒の受験生・採点・在籍などが落ち、counts.skipped に載る", async () => {
      await cleanupTestDatabase()
      const student = fixture.examA.students[0]
      const examStudentId = firstExamStudent().id
      const archiveScoreIds = archiveChildIdsOf("QuestionScore", examStudentId)
      const countOf = (table: string, column: string, id: string) =>
        archiveRowsOf(table).filter((row) => row[column] === id).length

      const result = await importRows(archive, "merge", {
        matches: { [archiveRowKey("Student", student.id)]: { kind: "skip" } },
      })

      expect(result.counts.Student.skipped).toBe(1)
      expect(result.counts.ExamStudent.skipped).toBe(1)
      expect(result.counts.QuestionScore.skipped).toBe(archiveScoreIds.length)
      expect(result.counts.StudentClassroomMembership.skipped).toBe(
        countOf("StudentClassroomMembership", "studentId", student.id)
      )
      expect(result.counts.GradeStudent.skipped).toBe(
        countOf("GradeStudent", "studentId", student.id)
      )
      expect(result.counts.ReturnSnapshot.skipped).toBe(1)
      expect(
        await prisma.student.findUnique({ where: { id: student.id } })
      ).toBeNull()
      expect(
        await prisma.examStudent.findMany({ where: { studentId: student.id } })
      ).toEqual([])
      expect(
        await prisma.questionScore.count({
          where: { id: { in: archiveScoreIds } },
        })
      ).toBe(0)
      // 他の生徒は取り込まれる
      expect(
        await prisma.student.count({
          where: {
            id: {
              in: fixture.examA.students.slice(1).map((other) => other.id),
            },
          },
        })
      ).toBe(fixture.examA.students.length - 1)
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])

      // 取り込まなかった受験生の答案画像は写さない（写すとどの行からも参照されない）
      emptyDataDirectory()
      const files = importUnifiedArchiveFiles(archive, DATA_DIR, result)
      const skippedImagePaths = fileFixture.studentAnswerImagePaths.filter(
        (imagePath) => imagePath.includes(`/${examStudentId}_`)
      )
      expect(skippedImagePaths.length).toBeGreaterThan(0)
      expect(files.unreferenced.sort()).toEqual(skippedImagePaths.sort())
      for (const imagePath of skippedImagePaths) {
        expect(fs.existsSync(dataFilePath(imagePath)), imagePath).toBe(false)
      }
      expect(files.copied.sort()).toEqual(
        [
          ...fileFixture.examPageImagePaths,
          ...fileFixture.studentAnswerImagePaths.filter(
            (imagePath) => !skippedImagePaths.includes(imagePath)
          ),
          ...fileFixture.asbImagePaths,
        ].sort()
      )
    })

    it("取り込まない利用者を任意で参照する列は NULL にして書く", async () => {
      await cleanupTestDatabase()
      const userId = fixture.examA.user.id

      const result = await importRows(archive, "merge", {
        matches: { [archiveRowKey("User", userId)]: { kind: "skip" } },
      })

      expect(result.counts.User.skipped).toBe(1)
      // 返却版の操作者は任意の参照なので、行は取り込み、操作者だけ NULL にする
      const snapshot = await prisma.returnSnapshot.findFirstOrThrow({
        where: { examStudentId: firstExamStudent().id },
      })
      expect(snapshot.capturedByUserId).toBeNull()
      // 採点は利用者を必須で参照するので落ちる
      expect(await prisma.questionScore.count({ where: { userId } })).toBe(0)
      expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])
    })
  })

  it("画像: 書かずに残した行の画像は、取り込み先に欠けているときだけ写し、あるものは置き換えない", async () => {
    const [missingPath, ...presentPaths] = fileFixture.examPageImagePaths
    fs.rmSync(dataFilePath(missingPath))
    const changedPath = presentPaths[0]
    fs.writeFileSync(dataFilePath(changedPath), "取り込み先の画像")
    // 取り込み先の行を新しくして、統合では全ての行が残る（kept）ようにする
    await prisma.examPage.updateMany({
      where: { examId: fixture.examA.exam.id },
      data: { updatedAt: new Date("2099-01-01T00:00:00.000Z") },
    })

    const result = await importRows(archive, "merge")
    expect(result.counts.ExamPage.kept).toBe(
      fileFixture.examPageImagePaths.length
    )
    expect(result.filePaths.kept).toEqual(
      expect.arrayContaining(fileFixture.examPageImagePaths)
    )
    expect(result.filePaths.written).toEqual([])
    const files = importUnifiedArchiveFiles(archive, DATA_DIR, result)

    expect(files.copied).toEqual([missingPath])
    expect(files.replaced).toEqual([])
    expect(fs.readFileSync(dataFilePath(changedPath), "utf8")).toBe(
      "取り込み先の画像"
    )
  })

  it("規約: ファイルのパスに区切りとして現れる id の表は、一意制約を持たず照合の対象でもない（付け替えの対象にならない）", async () => {
    const tableById = new Map<string, string>()
    for (const [table, ids] of readTableIds(archive.databasePath)) {
      for (const id of ids) tableById.set(id, table)
    }
    const tablesInPaths = new Set<string>()
    for (const fileColumn of ARCHIVE_FILE_COLUMNS) {
      for (const row of archiveRowsOf(fileColumn.table)) {
        const filePath = row[fileColumn.column]
        if (typeof filePath !== "string") continue
        for (const segment of filePath.split("/")) {
          const table = tableById.get(segment)
          if (table) tablesInPaths.add(table)
        }
      }
    }
    // 試験の模範解答・答案は試験の id、解答用紙定義の画像は定義の id を区切りに持つ
    expect([...tablesInPaths].sort()).toEqual(["AsbDefinition", "Exam"])
    for (const table of tablesInPaths) {
      expect(MATCHED_TABLES, table).not.toContain(table)
      const uniqueIndexes = await listArchiveUniqueIndexes(
        (sql, params) => prisma.$queryRawUnsafe<unknown[]>(sql, ...params),
        table
      )
      expect(uniqueIndexes, table).toEqual([])
    }
  })
})
