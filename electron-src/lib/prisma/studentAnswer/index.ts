/**
 * 答案管理モジュール
 *
 * 答案（StudentAnswer/PageImage）に関するデータベース操作を提供します。
 *
 * @module studentAnswer
 */

// CRUD操作
export {
  associateStudentAnswerWithStudent,
  deleteStudentAnswer,
  getStudentAnswerById,
  getStudentAnswersByExamId,
  uploadStudentAnswers,
} from "./crud"

// ステータス管理
export { setStudentAnswerAbsent } from "./status"

// 配置管理
export {
  swapStudentAnswerPlacements,
  updateStudentAnswerPlacement,
} from "./placement"

// 一括操作
export {
  batchUpdateStudentAnswerPlacements,
  swapStudentAnswerPlacementsWithScoring,
} from "./batch"

// 採点安全な配置適用（view 方式B: 2軸移動 + carry/discard）
export {
  applyStudentAnswerPlacements,
  type PlacementScorePolicy,
  type StudentAnswerPlacementMove,
} from "./placementApply"
