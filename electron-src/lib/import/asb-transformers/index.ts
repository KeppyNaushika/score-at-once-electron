/**
 * ASB アーカイブ変換器
 *
 * 旧バージョンのアーカイブを最新形式へ順に変換する。新バージョン追加時にここへ登録する。
 * チェーン実行は shared/transformChain の共通実装を使う。
 */

import type {
  AsbArchiveData,
  AsbArchiveManifest,
  AsbArchiveVersion,
  AsbChainTransformResult,
  AsbVersionTransformer,
} from "../../../../src/types/asbArchive.types"
import {
  ASB_CURRENT_VERSION,
  ASB_SUPPORTED_VERSIONS,
} from "../../../../src/types/asbArchive.types"
import {
  detectVersionInRange,
  runTransformChain,
} from "../shared/transformChain"
import { V1_0_0_to_V1_1_0_Transformer } from "./V1_0_0_to_V1_1_0"
import { V1_1_0_to_V1_2_0_Transformer } from "./V1_1_0_to_V1_2_0"
import { V1_2_0_to_V1_3_0_Transformer } from "./V1_2_0_to_V1_3_0"
import { V1_3_0_to_V1_4_0_Transformer } from "./V1_3_0_to_V1_4_0"
import { V1_4_0_to_V1_5_0_Transformer } from "./V1_4_0_to_V1_5_0"

const ASB_TRANSFORMERS: AsbVersionTransformer[] = [
  new V1_0_0_to_V1_1_0_Transformer(),
  new V1_1_0_to_V1_2_0_Transformer(),
  new V1_2_0_to_V1_3_0_Transformer(),
  new V1_3_0_to_V1_4_0_Transformer(),
  new V1_4_0_to_V1_5_0_Transformer(),
]

/** マニフェストのバージョン文字列からサポート対象のASBバージョンを判定する */
export function detectAsbVersion(
  manifest: AsbArchiveManifest
): AsbArchiveVersion | "unknown" {
  return detectVersionInRange(manifest.version, ASB_SUPPORTED_VERSIONS)
}

/** ASBアーカイブデータを変換チェーンを通じて最新バージョンに変換する */
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
  return runTransformChain({
    data,
    originalVersion,
    targetVersion,
    transformers: ASB_TRANSFORMERS,
    archiveLabel: "ASB",
  })
}
