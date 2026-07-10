/**
 * 試験外成績資料アーカイブ（.coursework）バージョン変換器
 *
 * 初版（1.0.0）では変換器は空。将来バージョン追加時に V<FROM>_to_V<TO> を作成し
 * COURSEWORK_TRANSFORMERS へ登録する（exam/asb の transformers に倣う）。
 * チェーン実行は shared/transformChain の共通実装を使う。
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
import {
  detectVersionInRange,
  runTransformChain,
} from "../shared/transformChain"

const COURSEWORK_TRANSFORMERS: CourseworkVersionTransformer[] = []

/** マニフェストのバージョン文字列からサポート対象バージョンを判定する */
export function detectCourseworkVersion(
  manifest: CourseworkArchiveManifest
): CourseworkArchiveVersion | "unknown" {
  return detectVersionInRange(manifest.version, COURSEWORK_SUPPORTED_VERSIONS)
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
  return runTransformChain({
    data,
    originalVersion,
    targetVersion,
    transformers: COURSEWORK_TRANSFORMERS,
    archiveLabel: "coursework",
  })
}

export { COURSEWORK_CURRENT_VERSION, COURSEWORK_SUPPORTED_VERSIONS }
