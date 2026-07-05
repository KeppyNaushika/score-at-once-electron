/**
 * アーカイブ変換器の再エクスポート
 */

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
export { V1_6_0_to_V1_7_0_Transformer } from "./V1_6_0_to_V1_7_0"
export { V1_7_0_to_V1_8_0_Transformer } from "./V1_7_0_to_V1_8_0"
export { V1_8_0_to_V1_9_0_Transformer } from "./V1_8_0_to_V1_9_0"
export { V1_9_0_to_V1_10_0_Transformer } from "./V1_9_0_to_V1_10_0"
export { V1_10_0_to_V1_11_0_Transformer } from "./V1_10_0_to_V1_11_0"
export { V1_11_0_to_V1_12_0_Transformer } from "./V1_11_0_to_V1_12_0"
export {
  convertScoresDataToV1_13,
  V1_12_0_to_V1_13_0_Transformer,
} from "./V1_12_0_to_V1_13_0"
export {
  normalizeExamStudentStatuses,
  V1_16_0_to_V1_17_0_Transformer,
} from "./V1_16_0_to_V1_17_0"
