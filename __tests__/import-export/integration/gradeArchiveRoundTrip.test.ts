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
