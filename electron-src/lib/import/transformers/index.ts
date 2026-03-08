/**
 * アーカイブ変換器のファクトリとチェーン実行
 *
 * 連鎖変換パターン: 1.0.0 → 1.1.0 → 1.2.0 → ...
 */

import type { ArchiveManifest } from "../../../../types/examArchive.types"
import type {
  ArchiveData,
  ArchiveVersion,
  ChainTransformResult,
  VersionPair,
  VersionTransformer,
} from "./types"
import { CURRENT_VERSION, SUPPORTED_VERSIONS } from "./types"
import { V1_0_0_to_V1_1_0_Transformer } from "./V1_0_0_to_V1_1_0"
import { V1_1_0_to_V1_2_0_Transformer } from "./V1_1_0_to_V1_2_0"
import { V1_2_0_to_V1_3_0_Transformer } from "./V1_2_0_to_V1_3_0"
import { V1_3_0_to_V1_4_0_Transformer } from "./V1_3_0_to_V1_4_0"
import { V1_4_0_to_V1_5_0_Transformer } from "./V1_4_0_to_V1_5_0"
import { V1_5_0_to_V1_6_0_Transformer } from "./V1_5_0_to_V1_6_0"

// =============================================================================
// Transformer Registry
// =============================================================================

/**
 * 全ての変換器を登録
 *
 * 新バージョン追加時はここに変換器を追加
 */
const TRANSFORMERS: VersionTransformer[] = [
  new V1_0_0_to_V1_1_0_Transformer(),
  new V1_1_0_to_V1_2_0_Transformer(),
  new V1_2_0_to_V1_3_0_Transformer(),
  new V1_3_0_to_V1_4_0_Transformer(),
  new V1_4_0_to_V1_5_0_Transformer(),
  new V1_5_0_to_V1_6_0_Transformer(),
]

/**
 * 変換元バージョンから変換器を取得
 */
function getTransformerByFromVersion(
  fromVersion: ArchiveVersion
): VersionTransformer | undefined {
  return TRANSFORMERS.find((t) => t.fromVersion === fromVersion)
}

// =============================================================================
// Version Detection
// =============================================================================

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
 * マニフェストからバージョンを検出
 */
export function detectArchiveVersion(
  manifest: ArchiveManifest
): ArchiveVersion | "unknown" {
  const version = manifest.version

  // サポートされているバージョンを逆順で確認（新しい順）
  for (let i = SUPPORTED_VERSIONS.length - 1; i >= 0; i--) {
    const supported = SUPPORTED_VERSIONS[i]
    const nextVersion = SUPPORTED_VERSIONS[i + 1]

    if (nextVersion) {
      // 次のバージョン未満かつ現在のバージョン以上
      if (
        compareVersions(version, supported) >= 0 &&
        compareVersions(version, nextVersion) < 0
      ) {
        return supported
      }
    } else {
      // 最新バージョン以上（将来のバージョンも含む）
      if (compareVersions(version, supported) >= 0) {
        return supported
      }
    }
  }

  // 最も古いバージョンより古い場合
  if (
    SUPPORTED_VERSIONS.length > 0 &&
    compareVersions(version, SUPPORTED_VERSIONS[0]) < 0
  ) {
    return SUPPORTED_VERSIONS[0]
  }

  return "unknown"
}

/**
 * バージョンがサポートされているか確認
 */
export function isSupportedVersion(manifest: ArchiveManifest): boolean {
  return detectArchiveVersion(manifest) !== "unknown"
}

/**
 * 変換が必要か確認
 */
export function requiresTransformation(manifest: ArchiveManifest): boolean {
  const version = detectArchiveVersion(manifest)
  return version !== "unknown" && version !== CURRENT_VERSION
}

// =============================================================================
// Transformation Chain
// =============================================================================

/**
 * 変換チェーンを構築
 *
 * @param fromVersion - 開始バージョン
 * @param toVersion - 終了バージョン（デフォルト: 現在の最新バージョン）
 * @returns 適用する変換器のリスト（順序付き）
 */
export function buildTransformChain(
  fromVersion: ArchiveVersion,
  toVersion: ArchiveVersion = CURRENT_VERSION
): VersionTransformer[] {
  const chain: VersionTransformer[] = []
  let currentVersion = fromVersion

  while (currentVersion !== toVersion) {
    const transformer = getTransformerByFromVersion(currentVersion)
    if (!transformer) {
      throw new Error(
        `No transformer found for version ${currentVersion}. ` +
          `Cannot transform from ${fromVersion} to ${toVersion}.`
      )
    }

    chain.push(transformer)
    currentVersion = transformer.toVersion
  }

  return chain
}

/**
 * 変換チェーンを実行
 *
 * @param data - 変換元のアーカイブデータ
 * @param targetVersion - 目標バージョン（デフォルト: 現在の最新バージョン）
 * @returns 変換結果
 */
export function transformToLatest(
  data: ArchiveData,
  targetVersion: ArchiveVersion = CURRENT_VERSION
): ChainTransformResult {
  const originalVersion = detectArchiveVersion(data.manifest)

  if (originalVersion === "unknown") {
    throw new Error(
      `Unknown archive version: ${data.manifest.version}. ` +
        `Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`
    )
  }

  if (originalVersion === targetVersion) {
    // 変換不要
    return {
      data,
      originalVersion,
      finalVersion: targetVersion,
      appliedTransformations: [],
      warnings: [],
    }
  }

  // 変換チェーンを構築
  const chain = buildTransformChain(originalVersion, targetVersion)

  // チェーンを実行
  let currentData = data
  const appliedTransformations: VersionPair[] = []
  const allWarnings: string[] = []

  for (const transformer of chain) {
    const result = transformer.transform(currentData)
    currentData = result.data
    allWarnings.push(...result.warnings)
    appliedTransformations.push({
      from: transformer.fromVersion,
      to: transformer.toVersion,
    })
  }

  return {
    data: currentData,
    originalVersion,
    finalVersion: targetVersion,
    appliedTransformations,
    warnings: allWarnings,
  }
}

// =============================================================================
// Exports
// =============================================================================

// 型のエクスポート
export type {
  ArchiveData,
  ArchiveVersion,
  ChainTransformResult,
  TransformResult,
  VersionPair,
  VersionTransformer,
} from "./types"
export { CURRENT_VERSION, SUPPORTED_VERSIONS } from "./types"

// 変換器のエクスポート（テスト用）
export { V1_0_0_to_V1_1_0_Transformer } from "./V1_0_0_to_V1_1_0"
export { V1_1_0_to_V1_2_0_Transformer } from "./V1_1_0_to_V1_2_0"
export { V1_2_0_to_V1_3_0_Transformer } from "./V1_2_0_to_V1_3_0"
export { V1_3_0_to_V1_4_0_Transformer } from "./V1_3_0_to_V1_4_0"
export { V1_4_0_to_V1_5_0_Transformer } from "./V1_4_0_to_V1_5_0"
export { V1_5_0_to_V1_6_0_Transformer } from "./V1_5_0_to_V1_6_0"
