/**
 * ASB アーカイブ変換器
 *
 * 初期バージョンではtransformerは空。将来バージョン追加時に登録する。
 */

import type {
  AsbArchiveData,
  AsbArchiveManifest,
  AsbArchiveVersion,
  AsbChainTransformResult,
  AsbVersionTransformer,
} from "../../../../types/asbArchive.types"
import {
  ASB_CURRENT_VERSION,
  ASB_SUPPORTED_VERSIONS,
} from "../../../../types/asbArchive.types"

// =============================================================================
// Transformer Registry
// =============================================================================

const ASB_TRANSFORMERS: AsbVersionTransformer[] = []

// =============================================================================
// Version Detection
// =============================================================================

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

export function detectAsbVersion(
  manifest: AsbArchiveManifest
): AsbArchiveVersion | "unknown" {
  const version = manifest.version
  for (let i = ASB_SUPPORTED_VERSIONS.length - 1; i >= 0; i--) {
    const supported = ASB_SUPPORTED_VERSIONS[i]
    const nextVersion = ASB_SUPPORTED_VERSIONS[i + 1]
    if (nextVersion) {
      if (
        compareVersions(version, supported) >= 0 &&
        compareVersions(version, nextVersion) < 0
      ) {
        return supported
      }
    } else {
      if (compareVersions(version, supported) >= 0) {
        return supported
      }
    }
  }
  if (
    ASB_SUPPORTED_VERSIONS.length > 0 &&
    compareVersions(version, ASB_SUPPORTED_VERSIONS[0]) < 0
  ) {
    return ASB_SUPPORTED_VERSIONS[0]
  }
  return "unknown"
}

// =============================================================================
// Transformation Chain
// =============================================================================

function buildAsbTransformChain(
  fromVersion: AsbArchiveVersion,
  toVersion: AsbArchiveVersion = ASB_CURRENT_VERSION
): AsbVersionTransformer[] {
  const chain: AsbVersionTransformer[] = []
  let currentVersion = fromVersion

  while (currentVersion !== toVersion) {
    const transformer = ASB_TRANSFORMERS.find(
      (t) => t.fromVersion === currentVersion
    )
    if (!transformer) {
      throw new Error(
        `No ASB transformer found for version ${currentVersion}. ` +
          `Cannot transform from ${fromVersion} to ${toVersion}.`
      )
    }
    chain.push(transformer)
    currentVersion = transformer.toVersion
  }

  return chain
}

export function transformAsbToLatest(
  data: AsbArchiveData,
  targetVersion: AsbArchiveVersion = ASB_CURRENT_VERSION
): AsbChainTransformResult {
  const originalVersion = detectAsbVersion(data.manifest)

  if (originalVersion === "unknown") {
    throw new Error(
      `Unknown ASB archive version: ${data.manifest.version}. ` +
        `Supported versions: ${ASB_SUPPORTED_VERSIONS.join(", ")}`
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

  const chain = buildAsbTransformChain(originalVersion, targetVersion)
  let currentData = data
  const appliedTransformations: {
    from: AsbArchiveVersion
    to: AsbArchiveVersion
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

export { ASB_CURRENT_VERSION, ASB_SUPPORTED_VERSIONS }
