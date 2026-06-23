/**
 * grade-archive のラウンドトリップ統合テスト
 *
 * テスト対象:
 *   electron-src/lib/export/grade-archive/gradeArchiveDataCollector.ts
 *   electron-src/lib/import/grade-archive/gradeArchiveImporter.ts
 *
 * 実SQLiteで「収集(export) → インポート(import)」を一周し、特に v1.2.0 で追加した
 * Grade.referenceDate と GradeExportSettings が往復で保持されることを検証する。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { GradeArchiveData } from "../../../src/types/gradeArchive.types"
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

import { collectGradeArchiveData } from "../../../electron-src/lib/export/grade-archive/gradeArchiveDataCollector"
import { importGradeArchive } from "../../../electron-src/lib/import/grade-archive/gradeArchiveImporter"

const prisma = getTestPrismaClient()

/** 収集結果をアーカイブ全体データに包む（manifestはテスト用に手組み） */
function toArchive(
  gradeId: string,
  collected: Awaited<ReturnType<typeof collectGradeArchiveData>>
): GradeArchiveData {
  return {
    manifest: {
      version: "1.2.0",
      appVersion: "test",
      exportedAt: new Date("2026-06-14T00:00:00.000Z").toISOString(),
      gradeId,
      gradeName: collected.gradeData.grade.name,
      counts: collected.counts,
    },
    gradeData: collected.gradeData,
    manualScoresData: collected.manualScoresData,
    boundariesData: collected.boundariesData,
  }
}

describe("grade-archive ラウンドトリップ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("Grade.referenceDate と GradeExportSettings が往復で保持される (v1.2.0)", async () => {
    const referenceDate = new Date("2026-04-01T00:00:00.000Z")
    const settingsJson = JSON.stringify({ includeKana: true, format: "pdf" })

    const grade = await prisma.grade.create({
      data: {
        name: `成績_${Date.now()}`,
        description: "説明",
        referenceDate,
      },
    })
    await prisma.gradeExportSettings.create({
      data: { gradeId: grade.id, settingsJson },
    })
    // 最低限の中身も持たせる（空でないことの確認）
    await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "知識・技能", order: 0 },
    })

    // 収集（export）
    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.gradeData.grade.referenceDate).toBe(
      referenceDate.toISOString()
    )
    expect(collected.gradeData.exportSettings?.settingsJson).toBe(settingsJson)

    // インポート（新規Gradeとして作成される）
    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)
    expect(result.gradeId).toBeDefined()

    const imported = await prisma.grade.findUnique({
      where: { id: result.gradeId! },
    })
    expect(imported).not.toBeNull()
    expect(imported!.referenceDate?.toISOString()).toBe(
      referenceDate.toISOString()
    )

    const importedSettings = await prisma.gradeExportSettings.findUnique({
      where: { gradeId: result.gradeId! },
    })
    expect(importedSettings).not.toBeNull()
    expect(importedSettings!.settingsJson).toBe(settingsJson)
  })

  it("文字評価変換表・inputMode・加減点・コメントが往復で保持される (v1.3.0)", async () => {
    const grade = await prisma.grade.create({
      data: { name: `成績_letter_${Date.now()}` },
    })
    const gradeItem = await prisma.gradeItem.create({
      data: { gradeId: grade.id, name: "授業態度", order: 0 },
    })
    const ds = await prisma.gradeDataSource.create({
      data: {
        gradeItemId: gradeItem.id,
        type: "manual",
        name: "観点別評価",
        maxScore: 100,
        weight: 100,
        order: 0,
        inputMode: "letter",
        letterScales: {
          create: [
            { label: "A", score: 100, order: 0 },
            { label: "B", score: 80, order: 1 },
            { label: "C", score: 60, order: 2 },
          ],
        },
      },
    })
    const student = await prisma.student.create({
      data: {
        studentNumber: `SL_${Date.now()}`,
        lastName: "鈴木",
        firstName: "一郎",
        lastNameKana: "スズキ",
        firstNameKana: "イチロウ",
      },
    })
    await prisma.manualScore.create({
      data: {
        gradeDataSourceId: ds.id,
        studentId: student.id,
        letterValue: "B",
        adjustment: -5,
        adjustmentReason: "提出遅延",
        comment: "発表が活発でした",
      },
    })

    // 収集（export）
    const collected = await collectGradeArchiveData(grade.id)
    const collectedDs = collected.gradeData.gradeItems[0].dataSources[0]
    expect(collectedDs.inputMode).toBe("letter")
    expect(collectedDs.letterScales).toHaveLength(3)
    const collectedMs = collected.manualScoresData.manualScores[0]
    expect(collectedMs.letterValue).toBe("B")
    expect(collectedMs.adjustment).toBe(-5)
    expect(collectedMs.comment).toBe("発表が活発でした")

    // インポート
    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)

    const importedDs = await prisma.gradeDataSource.findFirst({
      where: {
        gradeItem: { gradeId: result.gradeId! },
        name: "観点別評価",
      },
      include: { letterScales: { orderBy: { order: "asc" } } },
    })
    expect(importedDs!.inputMode).toBe("letter")
    expect(importedDs!.letterScales).toHaveLength(3)
    expect(importedDs!.letterScales[0].label).toBe("A")
    expect(Number(importedDs!.letterScales[0].score)).toBe(100)

    const importedMs = await prisma.manualScore.findFirst({
      where: { gradeDataSourceId: importedDs!.id },
    })
    expect(importedMs!.letterValue).toBe("B")
    expect(Number(importedMs!.adjustment)).toBe(-5)
    expect(importedMs!.adjustmentReason).toBe("提出遅延")
    expect(importedMs!.comment).toBe("発表が活発でした")
  })

  it("referenceDate/exportSettings が無いGradeも問題なく往復する（後方互換）", async () => {
    const grade = await prisma.grade.create({
      data: { name: `成績_min_${Date.now()}` },
    })

    const collected = await collectGradeArchiveData(grade.id)
    expect(collected.gradeData.grade.referenceDate).toBeNull()
    expect(collected.gradeData.exportSettings).toBeNull()

    const result = await importGradeArchive(toArchive(grade.id, collected))
    expect(result.success).toBe(true)

    const imported = await prisma.grade.findUnique({
      where: { id: result.gradeId! },
    })
    expect(imported!.referenceDate).toBeNull()

    const importedSettings = await prisma.gradeExportSettings.findUnique({
      where: { gradeId: result.gradeId! },
    })
    expect(importedSettings).toBeNull()
  })
})
