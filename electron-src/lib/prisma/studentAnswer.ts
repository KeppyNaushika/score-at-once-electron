/**
 * 答案管理モジュール - 後方互換性レイヤー
 *
 * このファイルは後方互換性のために維持されています。
 * 実際の実装は `./studentAnswer/` ディレクトリにあります。
 *
 * @deprecated 新しいコードでは直接 `./studentAnswer/` からインポートしてください。
 */

// 全ての関数を再エクスポート
export {
  // 採点安全な配置適用（view 方式B）
  applyStudentAnswerPlacements,
  associateStudentAnswerWithStudent,
  deleteStudentAnswer,
  getStudentAnswerById,
  getStudentAnswersByExamId,
  getStudentAnswerScoreSummary,
  getStudentAnswersDataset,
  type PlacementScorePolicy,
  // ステータス管理
  setStudentAnswerAbsent,
  type StudentAnswerPlacementMove,
  type StudentAnswerScoreSummary,
  // CRUD操作
  uploadStudentAnswers,
} from "./studentAnswer/index"
