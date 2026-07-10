/**
 * マニフェスト検証のユニットテスト
 */

import { describe, expect, test } from "vitest"

import {
  MIN_SUPPORTED_VERSION,
  validateCompatibility,
  validateManifest,
  validateManifestFields,
} from "../../../electron-src/lib/import/exam-archive/manifestValidator"
import type { ArchiveManifest } from "../../../src/types/examArchive.types"
import { EXAM_CURRENT_VERSION } from "../../../src/types/examArchive.types"

function createValidManifest(
  overrides: Partial<ArchiveManifest> = {}
): ArchiveManifest {
  return {
    version: EXAM_CURRENT_VERSION,
    schemaVersion: "test",
    appVersion: "0.5.0",
    exportedAt: new Date().toISOString(),
    examId: "test-exam-id",
    examName: "テスト試験",
    counts: {
      students: 3,
      classrooms: 1,
      users: 1,
      pages: 2,
      regions: 4,
      scores: 12,
      annotations: 0,
      subtotalGroups: 1,
      masterImages: 2,
      answerSheetImages: 6,
    },
    ...overrides,
  }
}

describe("manifestValidator", () => {
  // MV-1: 有効なマニフェストが検証を通過
  test("MV-1: 有効なマニフェストが検証を通過する", () => {
    const manifest = createValidManifest()
    const result = validateManifest(manifest)

    expect(result.success).toBe(true)
    expect(result.manifest).toBeDefined()
    expect(result.compatibility).toBeDefined()
    expect(result.compatibility!.isCompatible).toBe(true)
    expect(result.error).toBeUndefined()
  })

  // MV-2: 必須フィールド欠落で失敗
  test("MV-2: 必須フィールド欠落で失敗する", () => {
    const requiredFields = [
      "version",
      "exportedAt",
      "examId",
      "examName",
      "counts",
    ]

    for (const field of requiredFields) {
      const manifest = createValidManifest()
      const { [field]: _, ...incomplete } = { ...manifest } as Record<
        string,
        unknown
      >

      const result = validateManifestFields(incomplete)
      expect(result).not.toBeNull()
      expect(result).toContain(field)
    }
  })

  // MV-3: 不正バージョン形式で失敗
  test("MV-3: 不正バージョン形式で失敗する", () => {
    const invalidVersions = [
      "abc",
      "1.0",
      "1",
      "1.0.0.0",
      "v1.0.0",
      "",
      "1.a.0",
    ]

    for (const version of invalidVersions) {
      const manifest = createValidManifest({ version })
      const result = validateManifestFields(manifest)
      expect(result).toBe("バージョン形式が不正です")
    }
  })

  // MV-4: 未来バージョンは非互換
  test("MV-4: 未来バージョンは非互換として拒否される", () => {
    const manifest = createValidManifest({ version: "99.0.0" })
    const result = validateManifest(manifest)

    expect(result.success).toBe(false)
    expect(result.error).toContain("99.0.0")
    expect(result.error).toContain("更新")
  })

  // MV-5: MIN_SUPPORTED_VERSION未満で失敗
  test("MV-5: 最小サポートバージョン未満で失敗する", () => {
    const manifest = createValidManifest({ version: "0.9.0" })
    const result = validateManifest(manifest)

    expect(result.success).toBe(false)
    expect(result.error).toContain("0.9.0")
    expect(result.error).toContain(MIN_SUPPORTED_VERSION)
  })

  // MV-6: 古い互換バージョンはrequiresUpgrade=true
  test("MV-6: 古い互換バージョンはrequiresUpgrade=trueとなる", () => {
    const manifest = createValidManifest({ version: "1.0.0" })
    const compatibility = validateCompatibility(manifest)

    expect(compatibility.isCompatible).toBe(true)
    expect(compatibility.requiresUpgrade).toBe(true)
    expect(compatibility.warnings.length).toBeGreaterThan(0)
    expect(compatibility.warnings[0]).toContain("1.0.0")
  })

  // MV-7: 現在バージョンはrequiresUpgrade=false
  test("MV-7: 現在バージョンはrequiresUpgrade=falseとなる", () => {
    const manifest = createValidManifest({
      version: EXAM_CURRENT_VERSION,
    })
    const compatibility = validateCompatibility(manifest)

    expect(compatibility.isCompatible).toBe(true)
    expect(compatibility.requiresUpgrade).toBe(false)
    expect(compatibility.warnings).toHaveLength(0)
  })

  // MV-8: エッジケース
  test("MV-8: nullやオブジェクト以外のマニフェストで失敗する", () => {
    expect(validateManifestFields(null)).toBe("マニフェストが不正です")
    expect(validateManifestFields(undefined)).toBe("マニフェストが不正です")
    expect(validateManifestFields("string")).toBe("マニフェストが不正です")
    expect(validateManifestFields(123)).toBe("マニフェストが不正です")

    // countsが不正
    const manifestBadCounts = { ...createValidManifest(), counts: "invalid" }
    expect(validateManifestFields(manifestBadCounts)).toBe(
      "countsフィールドが不正です"
    )
  })
})
