/**
 * 生徒・学級アーカイブ バージョン変換器
 *
 * 初版（1.0.0）では変換器は空。将来バージョン追加時に V<FROM>_to_V<TO> を作成し
 * STUDENT_TRANSFORMERS へ登録する（exam/asb/coursework の transformers に倣う）。
 * チェーン実行は shared/transformChain の共通実装を使う。
 */

import type {
  StudentArchiveManifest,
  StudentArchiveVersion,
} from "../../../../src/types/studentArchive.types"
import {
  STUDENT_CURRENT_VERSION,
  STUDENT_SUPPORTED_VERSIONS,
} from "../../../../src/types/studentArchive.types"
import {
  detectVersionInRange,
  runTransformChain,
} from "../shared/transformChain"
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

/** マニフェストのバージョン文字列からサポート対象バージョンを判定する */
export function detectStudentVersion(
  manifest: StudentArchiveManifest
): StudentArchiveVersion | "unknown" {
  return detectVersionInRange(manifest.version, STUDENT_SUPPORTED_VERSIONS)
}

/** アーカイブデータを変換チェーンを通じて最新バージョンへ変換する（初版は素通し） */
export function transformStudentToLatest(
  data: ExtractedStudentArchiveData,
  targetVersion: StudentArchiveVersion = STUDENT_CURRENT_VERSION
): { data: ExtractedStudentArchiveData; warnings: string[] } {
  const originalVersion = detectStudentVersion(data.manifest)
  // 版数が読めないアーカイブは従来どおり素通し（インポート側のバリデーションに委ねる）
  if (originalVersion === "unknown") {
    return { data, warnings: [] }
  }
  const outcome = runTransformChain({
    data,
    originalVersion,
    targetVersion,
    transformers: STUDENT_TRANSFORMERS,
    archiveLabel: "student",
  })
  return { data: outcome.data, warnings: outcome.warnings }
}

export { STUDENT_CURRENT_VERSION, STUDENT_SUPPORTED_VERSIONS }
