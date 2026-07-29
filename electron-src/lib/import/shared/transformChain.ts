/**
 * アーカイブ共通のバージョン変換チェーン基盤
 *
 * exam / coursework / asb / student の各 transformers/index.ts が共有する
 * 「バージョン範囲判定 → 変換器列の構築 → 連鎖適用」の汎用実装。
 * grade はバージョン表記が信頼できずデータ形状で変換を選ぶ特殊実装のため
 * 対象外（grade-transformers/index.ts 参照）。
 */

import { compareVersions } from "../../shared/utilities/semver"

/** 1段階のバージョン変換器（各アーカイブの *VersionTransformer と構造互換） */
export interface ChainTransformer<Version extends string, Data> {
  readonly fromVersion: Version
  readonly toVersion: Version
  transform(data: Data): { data: Data; warnings: string[] }
}

/** チェーン実行結果（各アーカイブの *ChainTransformResult と構造互換） */
interface ChainOutcome<Version extends string, Data> {
  data: Data
  originalVersion: Version
  finalVersion: Version
  appliedTransformations: { from: Version; to: Version }[]
  warnings: string[]
}

/**
 * バージョン文字列をサポート範囲へ丸めて判定する。
 *
 * - 範囲内: その範囲の下端バージョン（例: 1.4.5 → "1.4.0"）
 * - 最新版以上: 最新版
 * - 最古版未満: 最古版
 * - 非semver文字列: "unknown"
 *   （compareVersions は数値化できない部分を 0 扱いするため、先に弾かないと
 *   壊れた版数文字列が 0.0.0 とみなされ最古版へ誤クランプされる）
 */
export function detectVersionInRange<Version extends string>(
  version: string,
  supportedVersions: readonly Version[]
): Version | "unknown" {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return "unknown"
  }
  for (let i = supportedVersions.length - 1; i >= 0; i--) {
    const supported = supportedVersions[i]
    const nextVersion = supportedVersions[i + 1]
    if (nextVersion) {
      if (
        compareVersions(version, supported) >= 0 &&
        compareVersions(version, nextVersion) < 0
      ) {
        return supported
      }
    } else if (compareVersions(version, supported) >= 0) {
      return supported
    }
  }
  if (
    supportedVersions.length > 0 &&
    compareVersions(version, supportedVersions[0]) < 0
  ) {
    return supportedVersions[0]
  }
  return "unknown"
}

/** fromVersion から toVersion へ到達する変換器列を構築する */
function buildChain<Version extends string, Data>(
  transformers: readonly ChainTransformer<Version, Data>[],
  fromVersion: Version,
  toVersion: Version,
  archiveLabel: string
): ChainTransformer<Version, Data>[] {
  const chain: ChainTransformer<Version, Data>[] = []
  let current = fromVersion
  while (current !== toVersion) {
    const transformer = transformers.find(
      (candidate) => candidate.fromVersion === current
    )
    if (!transformer) {
      throw new Error(
        `No ${archiveLabel} transformer found for version ${current}. ` +
          `Cannot transform from ${fromVersion} to ${toVersion}.`
      )
    }
    chain.push(transformer)
    current = transformer.toVersion
  }
  return chain
}

/**
 * 判定済みバージョンから targetVersion まで変換チェーンを実行する。
 *
 * バージョン判定は呼び出し側の責務（manifest 範囲判定＋アーカイブ固有の
 * 形状ベース補正など）。判定時の警告は initialWarnings で引き継ぐ。
 */
export function runTransformChain<Version extends string, Data>(options: {
  data: Data
  originalVersion: Version
  targetVersion: Version
  transformers: readonly ChainTransformer<Version, Data>[]
  /** エラーメッセージ用のアーカイブ名（例: "exam", "coursework"） */
  archiveLabel: string
  /** バージョン検出時の補正警告など、結果 warnings の先頭へ引き継ぐもの */
  initialWarnings?: string[]
}): ChainOutcome<Version, Data> {
  const { data, originalVersion, targetVersion, transformers, archiveLabel } =
    options
  const warnings = [...(options.initialWarnings ?? [])]

  if (originalVersion === targetVersion) {
    return {
      data,
      originalVersion,
      finalVersion: targetVersion,
      appliedTransformations: [],
      warnings,
    }
  }

  const chain = buildChain(
    transformers,
    originalVersion,
    targetVersion,
    archiveLabel
  )
  let currentData = data
  const appliedTransformations: { from: Version; to: Version }[] = []
  for (const transformer of chain) {
    const result = transformer.transform(currentData)
    currentData = result.data
    warnings.push(...result.warnings)
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
    warnings,
  }
}
