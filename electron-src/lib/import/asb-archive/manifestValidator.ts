/**
 * ASBアーカイブマニフェストのバリデーション
 */

import type { AsbArchiveManifest } from "../../../../types/asbArchive.types"
import { detectAsbVersion } from "../asb-transformers"

/**
 * マニフェストの必須フィールドとバージョン互換性を検証
 */
export function validateAsbManifest(manifest: AsbArchiveManifest): {
  valid: boolean
  error?: string
} {
  // 必須フィールドチェック
  if (!manifest.version) {
    return { valid: false, error: "バージョン情報がありません" }
  }
  if (!manifest.definitionName) {
    return { valid: false, error: "定義名がありません" }
  }
  if (!manifest.exportedAt) {
    return { valid: false, error: "エクスポート日時がありません" }
  }

  // バージョン互換性チェック
  const detectedVersion = detectAsbVersion(manifest)
  if (detectedVersion === "unknown") {
    return {
      valid: false,
      error: `未対応のバージョン: ${manifest.version}`,
    }
  }

  return { valid: true }
}
