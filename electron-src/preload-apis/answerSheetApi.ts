import { invoke } from "./invoke"

/** 答案用紙のIPC API（アップロード・一覧取得・削除・配置管理） */
export function createAnswerSheetApi() {
  return {
    // Student answer related
    uploadStudentAnswers: (
      examId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        examStudentId?: string
        examPageId: string
        overwrite?: boolean
        correctWithMarkers?: boolean
      }[]
    ) => invoke("upload-answer-sheets", examId, filesData),
    getStudentAnswersByExamId: (examId: string) =>
      invoke("get-answer-sheets-by-exam-id", examId),
    getStudentAnswersDataset: (examId: string) =>
      invoke("get-student-answers-dataset", examId),
    getStudentAnswerScoreSummary: (answerSheetId: string) =>
      invoke("get-answer-sheet-score-summary", answerSheetId),
    deleteStudentAnswer: (answerSheetId: string) =>
      invoke("delete-answer-sheet", answerSheetId),
    applyStudentAnswerPlacements: (
      moves: Array<{
        fileId: string
        finalExamStudentId: string | null
        finalExamPageId: string
        scorePolicy: "carry" | "discard"
      }>
    ) => invoke("apply-answer-sheet-placements", moves),
  }
}
