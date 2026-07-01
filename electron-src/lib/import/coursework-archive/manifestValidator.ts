/**
 * 試験外成績資料アーカイブ マニフェスト検証・互換性判定
 */

import {
  COURSEWORK_CURRENT_VERSION,
  COURSEWORK_MIN_SUPPORTED_VERSION,
  type CourseworkArchiveManifest,
} from "../../../../src/types/courseworkArchive.types"
import { compareVersions } from "../../shared/utilities/semver"

/** マニフェスト（version を持つオブジェクト）かどうかの型ガード */
function isCourseworkArchiveManifest(
  value: unknown
): value is CourseworkArchiveManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "string"
  )
}

export interface CourseworkCompatibilityInfo {
  compatible: boolean
  requiresTransform: boolean
  warnings: string[]
  error?: string
}

/**
 * マニフェストのバージョン互換性を判定する。
 * - 現行より新しい: 非互換（アプリ更新が必要）
 * - 最小サポート未満: 非互換
 * - それ以外で現行未満: 互換（将来トランスフォーマーで吸収）
 */
export function validateCourseworkManifest(
  manifest: unknown
): CourseworkCompatibilityInfo & { manifest?: CourseworkArchiveManifest } {
  if (!isCourseworkArchiveManifest(manifest)) {
    return {
      compatible: false,
      requiresTransform: false,
      warnings: [],
      error: "マニフェストが不正です",
    }
  }

  const m = manifest
  const warnings: string[] = []

  if (compareVersions(m.version, COURSEWORK_CURRENT_VERSION) > 0) {
    return {
      compatible: false,
      requiresTransform: false,
      warnings,
      error: `このアーカイブ（v${m.version}）は現在のアプリ（v${COURSEWORK_CURRENT_VERSION}）より新しいため読み込めません。アプリを更新してください。`,
    }
  }

  if (compareVersions(m.version, COURSEWORK_MIN_SUPPORTED_VERSION) < 0) {
    return {
      compatible: false,
      requiresTransform: false,
      warnings,
      error: `このアーカイブ（v${m.version}）は古すぎるため読み込めません。`,
    }
  }

  const requiresTransform =
    compareVersions(m.version, COURSEWORK_CURRENT_VERSION) < 0
  if (requiresTransform) {
    warnings.push(
      `アーカイブ（v${m.version}）を現行（v${COURSEWORK_CURRENT_VERSION}）へ変換して読み込みます。`
    )
  }

  return { compatible: true, requiresTransform, warnings, manifest: m }
}
