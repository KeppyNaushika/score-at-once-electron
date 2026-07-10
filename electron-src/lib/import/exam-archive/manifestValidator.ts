/**
 * マニフェスト検証モジュール
 *
 * アーカイブのバージョン互換性をチェック
 */

import type { ArchiveManifest } from "../../../../src/types/examArchive.types"
import { EXAM_CURRENT_VERSION } from "../../../../src/types/examArchive.types"
import { compareVersions } from "../../shared/utilities/semver"

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
  const versionCompare = compareVersions(manifest.version, EXAM_CURRENT_VERSION)
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

  const manifestRecord = manifest as Record<string, unknown>

  // v1.4.0以前の旧形式フォールバック: projectId → examId, projectName → examName
  if ("projectId" in manifestRecord && !("examId" in manifestRecord)) {
    manifestRecord.examId = manifestRecord.projectId
    delete manifestRecord.projectId
  }
  if ("projectName" in manifestRecord && !("examName" in manifestRecord)) {
    manifestRecord.examName = manifestRecord.projectName
    delete manifestRecord.projectName
  }

  // 必須フィールドチェック
  const requiredFields = [
    "version",
    "exportedAt",
    "examId",
    "examName",
    "counts",
  ]
  for (const field of requiredFields) {
    if (!(field in manifestRecord)) {
      return `マニフェストに必須フィールド '${field}' がありません`
    }
  }

  // バージョン形式チェック
  if (
    typeof manifestRecord.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(manifestRecord.version)
  ) {
    return "バージョン形式が不正です"
  }

  // counts オブジェクトチェック
  if (!manifestRecord.counts || typeof manifestRecord.counts !== "object") {
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
