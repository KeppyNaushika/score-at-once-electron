/**
 * 試験外成績資料アーカイブ（.coursework）バージョン変換器
 *
 * バージョンを追加したら types.ts に「その版のアーカイブ全体の形」を宣言し、
 * V<FROM>_to_V<TO> を作成して COURSEWORK_TRANSFORMERS へ登録する
 * （exam/asb の transformers に倣う）。
 * チェーン実行は shared/transformChain の共通実装を使う。
 */

import type {
  CourseworkArchiveManifest,
  CourseworkArchiveVersion,
} from "../../../../src/types/courseworkArchive.types"
import {
  COURSEWORK_CURRENT_VERSION,
  COURSEWORK_SUPPORTED_VERSIONS,
} from "../../../../src/types/courseworkArchive.types"
import {
  detectVersionInRange,
  runTransformChain,
} from "../shared/transformChain"
import {
  type AnyCourseworkArchiveData,
  type CourseworkChainTransformResult,
  type CourseworkVersionTransformer,
  isCourseworkArchiveV1_0_0,
} from "./types"
import { V1_0_0_to_V1_1_0_Transformer } from "./V1_0_0_to_V1_1_0"

const COURSEWORK_TRANSFORMERS: CourseworkVersionTransformer[] = [
  new V1_0_0_to_V1_1_0_Transformer(),
]

/**
 * マニフェストのバージョン文字列からサポート対象バージョンを判定する。
 *
 * 実データの形が manifest より古ければそちらへ下方補正する（version が実態と
 * ずれたアーカイブが実在したため。exam の形状ベース検出と同じ理由）。
 */
function detectCourseworkVersion(
  manifest: CourseworkArchiveManifest,
  data?: AnyCourseworkArchiveData
): CourseworkArchiveVersion | "unknown" {
  const declared = detectVersionInRange(
    manifest.version,
    COURSEWORK_SUPPORTED_VERSIONS
  )
  if (declared === "unknown") return declared
  // 旧版の形なら、名乗りに関わらず 1.0.0 として変換を通す
  if (data && isCourseworkArchiveV1_0_0(data)) return "1.0.0"
  return declared
}

/** アーカイブデータを変換チェーンを通じて最新バージョンへ変換する */
export function transformCourseworkToLatest(
  data: AnyCourseworkArchiveData,
  targetVersion: CourseworkArchiveVersion = COURSEWORK_CURRENT_VERSION
): CourseworkChainTransformResult {
  const originalVersion = detectCourseworkVersion(data.manifest, data)
  if (originalVersion === "unknown") {
    throw new Error(
      `Unknown coursework archive version: ${data.manifest.version}. ` +
        `Supported versions: ${COURSEWORK_SUPPORTED_VERSIONS.join(", ")}`
    )
  }
  const outcome = runTransformChain({
    data,
    originalVersion,
    targetVersion,
    transformers: COURSEWORK_TRANSFORMERS,
    archiveLabel: "coursework",
  })
  if (isCourseworkArchiveV1_0_0(outcome.data)) {
    // 変換器の実装バグ（旧版の形のまま抜けてきた）。取り込みへ進めてはいけない
    throw new Error(
      "coursework archive is still in the 1.0.0 shape after transformation"
    )
  }
  return { ...outcome, data: outcome.data }
}
