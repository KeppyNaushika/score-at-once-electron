/**
 * 生徒・学級アーカイブ バージョン変換器
 *
 * 初版（1.0.0）では変換器は空。将来バージョン追加時に V<FROM>_to_V<TO> を作成し
 * STUDENT_TRANSFORMERS へ登録する（exam/asb/coursework の transformers に倣う）。
 */

import type {
  StudentArchiveManifest,
  StudentArchiveVersion,
} from "../../../../src/types/studentArchive.types"
import {
  STUDENT_CURRENT_VERSION,
  STUDENT_SUPPORTED_VERSIONS,
} from "../../../../src/types/studentArchive.types"
import type { ExtractedStudentArchiveData } from "../student-archive/archiveExtractor"

export interface StudentTransformResult {
  data: ExtractedStudentArchiveData
  warnings: string[]
}

export interface StudentVersionTransformer {
  readonly fromVersion: StudentArchiveVersion
  readonly toVersion: StudentArchiveVersion
  transform(data: ExtractedStudentArchiveData): StudentTransformResult
}

const STUDENT_TRANSFORMERS: StudentVersionTransformer[] = []

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
export function detectStudentVersion(
  manifest: StudentArchiveManifest
): StudentArchiveVersion | "unknown" {
  const version = manifest.version
  for (let i = STUDENT_SUPPORTED_VERSIONS.length - 1; i >= 0; i--) {
    const supported = STUDENT_SUPPORTED_VERSIONS[i]
    const nextVersion = STUDENT_SUPPORTED_VERSIONS[i + 1]
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
    STUDENT_SUPPORTED_VERSIONS.length > 0 &&
    compareVersions(version, STUDENT_SUPPORTED_VERSIONS[0]) < 0
  ) {
    return STUDENT_SUPPORTED_VERSIONS[0]
  }
  return "unknown"
}

/** アーカイブデータを変換チェーンを通じて最新バージョンへ変換する（初版は素通し） */
export function transformStudentToLatest(
  data: ExtractedStudentArchiveData,
  targetVersion: StudentArchiveVersion = STUDENT_CURRENT_VERSION
): { data: ExtractedStudentArchiveData; warnings: string[] } {
  let current = data
  const warnings: string[] = []
  let version = detectStudentVersion(current.manifest)
  if (version === "unknown") return { data: current, warnings }

  let guard = 0
  while (version !== targetVersion) {
    const transformer = STUDENT_TRANSFORMERS.find(
      (t) => t.fromVersion === version
    )
    if (!transformer) break
    const result = transformer.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    version = transformer.toVersion
    if (++guard > 100) break
  }

  return { data: current, warnings }
}

export { STUDENT_CURRENT_VERSION, STUDENT_SUPPORTED_VERSIONS }
