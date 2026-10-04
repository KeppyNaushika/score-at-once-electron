/**
 * 統合アーカイブ（.sao）の試し取り込みが返す、成績算出への影響の材料（docs §7.5）
 *
 * テスト対象:
 *   electron-src/lib/import/unified-archive/archiveGradeInputChanges.ts
 *   electron-src/lib/import/unified-archive/archiveGradeImpactSource.ts
 *   electron-src/lib/import/unified-archive/archiveRowImporter.ts（analyzeUnifiedArchiveImport）
 *   src/components/unified-archive/import/archiveGradeImpact.ts（main の材料から評価項目まで辿れること）
 *
 * 取り込み先にある成績算出「後学期」は試験Aの合計点（評価項目「知識」）と、試験Aの設問2
 * （評価項目「設問2」）を使う。名簿には試験Aの1人目だけが載る。書き出した後にアーカイブの
 * 採点を1件だけ変え、同じ DB へ統合で試し取り込みする。
 */

import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { mapArchiveGradeImpacts } from "@/components/unified-archive/import/archiveGradeImpact"

import { createUnifiedArchive } from "../../../electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import type { OpenedUnifiedArchive } from "../../../electron-src/lib/import/unified-archive/types"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import {
  createUnifiedArchiveFixture,
  type UnifiedArchiveFixture,
} from "../../helpers/unifiedArchiveFixture"
import {
  analyzeArchiveImportWithGradeImpact,
  openArchiveForTest,
} from "../../helpers/unifiedArchiveImportHelpers"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const WORK_DIR = path.join(os.tmpdir(), "unified-archive-grade-impact")
const DATA_DIR = path.join(WORK_DIR, "data")
const OUTPUT_PATH = path.join(WORK_DIR, "export.sao")
const IMPORTED_AT = new Date("2026-10-05T09:00:00.000Z")

describe("試し取り込みの成績算出への影響", () => {
  let fixture: UnifiedArchiveFixture
  let archive: OpenedUnifiedArchive

  /** 試験Aの、採点者本人の採点（設問・生徒の順で何番目か） */
  const scoreOf = (cropRegionIndex: number, studentIndex: number) => {
    const examStudent = fixture.examA.examStudents.find(
      (candidate) =>
        candidate.studentId === fixture.examA.students[studentIndex].id
    )
    const score = fixture.examA.questionScores.find(
      (candidate) =>
        candidate.cropRegionId ===
          fixture.examA.cropRegions[cropRegionIndex].id &&
        candidate.examStudentId === examStudent?.id &&
        candidate.userId === fixture.examA.user.id
    )
    if (!score) throw new Error("採点が見つかりません")
    return score
  }

  /** アーカイブの中の採点を、取り込み先より新しい不正解に書き換える */
  const markIncorrectInArchive = (scoreId: string): void => {
    const db = new Database(archive.databasePath)
    try {
      db.prepare(
        `UPDATE "QuestionScore" SET status = 'incorrect', partialScore = 0, updatedAt = ? WHERE id = ?`
      ).run("2099-01-01T00:00:00.000Z", scoreId)
    } finally {
      db.close()
    }
  }

  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
    const questionItem = await prisma.gradeItem.create({
      data: { gradeId: fixture.gradeId, name: "設問2", order: 1 },
    })
    await prisma.gradeDataSource.create({
      data: {
        gradeItemId: questionItem.id,
        type: "crop_region",
        name: "設問2",
        weight: 1,
        examId: fixture.examA.exam.id,
        cropRegionId: fixture.examA.cropRegions[1].id,
      },
    })
    const exported = await createUnifiedArchive({
      sourceDatabasePath: TEST_DB_PATH,
      dataDirectory: DATA_DIR,
      outputPath: OUTPUT_PATH,
      selection: {
        roots: { Exam: [fixture.examA.exam.id], Grade: [fixture.gradeId] },
      },
      exportedByUserId: fixture.examA.user.id,
      appVersion: "0.0.0-test",
    })
    archive = openArchiveForTest(OUTPUT_PATH, exported.manifest, WORK_DIR)
  })

  afterAll(async () => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("変えた採点だけが前と後つきで載り、手がかりから成績算出の評価項目まで辿れる。残した行は載らない", async () => {
    const changedScore = scoreOf(0, 0)
    markIncorrectInArchive(changedScore.id)

    const analysis = await analyzeArchiveImportWithGradeImpact(
      prisma,
      archive,
      "merge",
      IMPORTED_AT
    )

    expect(analysis.result.counts.QuestionScore.replaced).toBe(1)
    expect(analysis.result.counts.QuestionScore.kept).toBeGreaterThan(0)
    expect(
      analysis.gradeInputChanges.map((change) => [change.table, change.id])
    ).toEqual([["QuestionScore", changedScore.id]])
    const [scoreChange] = analysis.gradeInputChanges
    expect(scoreChange.before?.status).toBe("correct")
    expect(scoreChange.after.status).toBe("incorrect")

    const impacts = mapArchiveGradeImpacts(
      analysis.gradeInputChanges,
      analysis.inspection
    )
    expect(
      impacts.map((impact) => [
        impact.grade.id,
        impact.items.map((item) => item.gradeItem.name),
      ])
    ).toEqual([[fixture.gradeId, ["知識"]]])

    // 試し取り込みはロールバックする
    const stored = await prisma.questionScore.findUniqueOrThrow({
      where: { id: changedScore.id },
    })
    expect(stored.status).toBe("correct")
  })

  it("設問を指すデータソースは、その設問の採点が変わったときだけ辿り着く", async () => {
    markIncorrectInArchive(scoreOf(1, 0).id)

    const analysis = await analyzeArchiveImportWithGradeImpact(
      prisma,
      archive,
      "merge",
      IMPORTED_AT
    )

    expect(
      mapArchiveGradeImpacts(
        analysis.gradeInputChanges,
        analysis.inspection
      ).flatMap((impact) => impact.items.map((item) => item.gradeItem.name))
    ).toEqual(["知識", "設問2"])
  })

  it("名簿に載っていない生徒の採点は載るが、評価項目へは写らない", async () => {
    const changedScore = scoreOf(0, 1)
    markIncorrectInArchive(changedScore.id)

    const analysis = await analyzeArchiveImportWithGradeImpact(
      prisma,
      archive,
      "merge",
      IMPORTED_AT
    )

    expect(analysis.gradeInputChanges.map((change) => change.id)).toEqual([
      changedScore.id,
    ])
    expect(
      mapArchiveGradeImpacts(analysis.gradeInputChanges, analysis.inspection)
    ).toEqual([])
  })
})
