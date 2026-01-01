/**
 * マニフェスト検証モジュール
 *
 * アーカイブのバージョン互換性をチェック
 */

import type { ArchiveManifest } from "../../../../types/projectArchive.types"

/** 現在のアーカイブ形式バージョン */
export const CURRENT_ARCHIVE_VERSION = "1.1.0"

/** 対応可能な最小バージョン (v0.2.z 互換) */
export const MIN_SUPPORTED_VERSION = "1.0.0"

/**
 * バージョン互換性情報
 */
export interface CompatibilityInfo {
  /** 互換性があるか */
  isCompatible: boolean
  /** アップグレードが必要か（古いバージョンからの読み込み） */
  requiresUpgrade: boolean
  /** 警告メッセージ */
  warnings: string[]
}

/**
 * バージョン文字列を比較
 *
 * @returns 負: v1 < v2, 0: v1 == v2, 正: v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 !== p2) {
      return p1 - p2
    }
  }
  return 0
}

/**
 * マニフェストのバージョン互換性を検証
 *
 * @param manifest - 検証するマニフェスト
 * @returns 互換性情報
 */
export function validateCompatibility(
  manifest: ArchiveManifest
): CompatibilityInfo {
  const warnings: string[] = []

  // アーカイブバージョンが現在より新しい場合はエラー
  const versionCompare = compareVersions(
    manifest.version,
    CURRENT_ARCHIVE_VERSION
  )
  if (versionCompare > 0) {
    return {
      isCompatible: false,
      requiresUpgrade: false,
      warnings: [
        `このアーカイブはより新しいバージョン(${manifest.version})で作成されています。` +
          `アプリケーションを更新してください。`,
      ],
    }
  }

  // 最小サポートバージョン未満はエラー
  if (compareVersions(manifest.version, MIN_SUPPORTED_VERSION) < 0) {
    return {
      isCompatible: false,
      requiresUpgrade: false,
      warnings: [
        `このアーカイブのバージョン(${manifest.version})はサポートされていません。` +
          `最小サポートバージョン: ${MIN_SUPPORTED_VERSION}`,
      ],
    }
  }

  // 古いバージョンからの読み込みは警告付きで許可
  if (versionCompare < 0) {
    warnings.push(
      `このアーカイブは古いバージョン(${manifest.version})で作成されています。` +
        `一部のデータが欠損している可能性があります。`
    )
  }

  // スキーマバージョンチェック（将来の拡張用）
  // 現時点では警告のみ
  if (manifest.schemaVersion && manifest.schemaVersion !== "unknown") {
    // TODO: Prismaマイグレーション履歴と照合
    // 現時点では互換性ありとして扱う
  }

  return {
    isCompatible: true,
    requiresUpgrade: versionCompare < 0,
    warnings,
  }
}

/**
 * マニフェストの必須フィールドを検証
 *
 * @param manifest - 検証するマニフェスト
 * @returns エラーメッセージ（問題なければnull）
 */
export function validateManifestFields(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== "object") {
    return "マニフェストが不正です"
  }

  const m = manifest as Record<string, unknown>

  // 必須フィールドチェック
  const requiredFields = [
    "version",
    "exportedAt",
    "projectId",
    "projectName",
    "counts",
  ]
  for (const field of requiredFields) {
    if (!(field in m)) {
      return `マニフェストに必須フィールド '${field}' がありません`
    }
  }

  // バージョン形式チェック
  if (typeof m.version !== "string" || !/^\d+\.\d+\.\d+$/.test(m.version)) {
    return "バージョン形式が不正です"
  }

  // counts オブジェクトチェック
  if (!m.counts || typeof m.counts !== "object") {
    return "countsフィールドが不正です"
  }

  return null
}

/**
 * マニフェストを検証
 *
 * @param manifest - 検証するマニフェスト
 * @returns 検証結果
 */
export function validateManifest(manifest: unknown): {
  success: boolean
  manifest?: ArchiveManifest
  compatibility?: CompatibilityInfo
  error?: string
} {
  // フィールド検証
  const fieldError = validateManifestFields(manifest)
  if (fieldError) {
    return { success: false, error: fieldError }
  }

  const validManifest = manifest as ArchiveManifest

  // 互換性検証
  const compatibility = validateCompatibility(validManifest)
  if (!compatibility.isCompatible) {
    return {
      success: false,
      error: compatibility.warnings.join(" "),
    }
  }

  return {
    success: true,
    manifest: validManifest,
    compatibility,
  }
}
