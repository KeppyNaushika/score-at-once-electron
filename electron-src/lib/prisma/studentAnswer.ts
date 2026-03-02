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
  associateStudentAnswerWithStudent,
  // 一括操作
  batchUpdateStudentAnswerPlacements,
  deleteStudentAnswer,
  getStudentAnswerById,
  getStudentAnswersByExamId,
  // ステータス管理
  setStudentAnswerAbsent,
  swapStudentAnswerPlacements,
  swapStudentAnswerPlacementsWithScoring,
  // 配置管理
  updateStudentAnswerPlacement,
  // CRUD操作
  uploadStudentAnswers,
} from "./studentAnswer/index"
