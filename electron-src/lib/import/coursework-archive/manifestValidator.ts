/**
 * 試験外成績資料アーカイブ マニフェスト検証・互換性判定
 */

import {
  COURSEWORK_CURRENT_VERSION,
  COURSEWORK_MIN_SUPPORTED_VERSION,
  type CourseworkArchiveManifest,
} from "../../../../src/types/courseworkArchive.types"

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split(".").map(Number)
  const p2 = v2.split(".").map(Number)
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] ?? 0
    const b = p2[i] ?? 0
    if (a !== b) return a > b ? 1 : -1
  }
  return 0
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
  if (
    !manifest ||
    typeof manifest !== "object" ||
    typeof (manifest as CourseworkArchiveManifest).version !== "string"
  ) {
    return {
      compatible: false,
      requiresTransform: false,
      warnings: [],
      error: "マニフェストが不正です",
    }
  }

  const m = manifest as CourseworkArchiveManifest
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
