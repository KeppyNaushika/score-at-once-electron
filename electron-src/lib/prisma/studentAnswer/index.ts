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
  getStudentAnswerScoreSummary,
  getStudentAnswersDataset,
  type StudentAnswerScoreSummary,
  uploadStudentAnswers,
} from "./crud"

// ステータス管理
export { setStudentAnswerAbsent } from "./status"

// 採点安全な配置適用（view 方式B: 2軸移動 + carry/discard）
export {
  applyStudentAnswerPlacements,
  type PlacementScorePolicy,
  type StudentAnswerPlacementMove,
} from "./placementApply"
