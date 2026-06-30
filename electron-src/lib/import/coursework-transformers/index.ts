/**
 * 試験外成績資料アーカイブ（.coursework）バージョン変換器
 *
 * 初版（1.0.0）では変換器は空。将来バージョン追加時に V<FROM>_to_V<TO> を作成し
 * COURSEWORK_TRANSFORMERS へ登録する（exam/asb の transformers に倣う）。
 */

import type {
  CourseworkArchiveData,
  CourseworkArchiveManifest,
  CourseworkArchiveVersion,
  CourseworkChainTransformResult,
  CourseworkVersionTransformer,
} from "../../../../src/types/courseworkArchive.types"
import {
  COURSEWORK_CURRENT_VERSION,
  COURSEWORK_SUPPORTED_VERSIONS,
} from "../../../../src/types/courseworkArchive.types"

const COURSEWORK_TRANSFORMERS: CourseworkVersionTransformer[] = []

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 !== p2) return p1 - p2
  }
  return 0
}

/** マニフェストのバージョン文字列からサポート対象バージョンを判定する */
export function detectCourseworkVersion(
  manifest: CourseworkArchiveManifest
): CourseworkArchiveVersion | "unknown" {
  const version = manifest.version
  for (let i = COURSEWORK_SUPPORTED_VERSIONS.length - 1; i >= 0; i--) {
    const supported = COURSEWORK_SUPPORTED_VERSIONS[i]
    const nextVersion = COURSEWORK_SUPPORTED_VERSIONS[i + 1]
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
    COURSEWORK_SUPPORTED_VERSIONS.length > 0 &&
    compareVersions(version, COURSEWORK_SUPPORTED_VERSIONS[0]) < 0
  ) {
    return COURSEWORK_SUPPORTED_VERSIONS[0]
  }
  return "unknown"
}

function buildChain(
  fromVersion: CourseworkArchiveVersion,
  toVersion: CourseworkArchiveVersion
): CourseworkVersionTransformer[] {
  const chain: CourseworkVersionTransformer[] = []
  let current = fromVersion
  while (current !== toVersion) {
    const transformer = COURSEWORK_TRANSFORMERS.find(
      (t) => t.fromVersion === current
    )
    if (!transformer) {
      throw new Error(
        `No coursework transformer found for version ${current}. ` +
          `Cannot transform from ${fromVersion} to ${toVersion}.`
      )
    }
    chain.push(transformer)
    current = transformer.toVersion
  }
  return chain
}

/** アーカイブデータを変換チェーンを通じて最新バージョンへ変換する */
export function transformCourseworkToLatest(
  data: CourseworkArchiveData,
  targetVersion: CourseworkArchiveVersion = COURSEWORK_CURRENT_VERSION
): CourseworkChainTransformResult {
  const originalVersion = detectCourseworkVersion(data.manifest)
  if (originalVersion === "unknown") {
    throw new Error(
      `Unknown coursework archive version: ${data.manifest.version}. ` +
        `Supported versions: ${COURSEWORK_SUPPORTED_VERSIONS.join(", ")}`
    )
  }
  if (originalVersion === targetVersion) {
    return {
      data,
      originalVersion,
      finalVersion: targetVersion,
      appliedTransformations: [],
      warnings: [],
    }
  }

  const chain = buildChain(originalVersion, targetVersion)
  let currentData = data
  const appliedTransformations: {
    from: CourseworkArchiveVersion
    to: CourseworkArchiveVersion
  }[] = []
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

export { COURSEWORK_CURRENT_VERSION, COURSEWORK_SUPPORTED_VERSIONS }
