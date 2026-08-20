import { bind } from "./invoke"

/** 答案用紙のIPC API（アップロード・一覧取得・削除・配置管理） */
export function createAnswerSheetApi() {
  return {
    // Student answer related
    uploadStudentAnswers: bind("upload-answer-sheets"),
    getStudentAnswersDataset: bind("get-student-answers-dataset"),
    getStudentAnswerDeletionCounts: bind("get-answer-sheet-deletion-counts"),
    deleteStudentAnswer: bind("delete-answer-sheet"),
    applyStudentAnswerPlacements: bind("apply-answer-sheet-placements"),
  }
}
