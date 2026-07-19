import { ipcRenderer } from "electron"

/** 答案用紙のIPC API（アップロード・生徒紐付け・配置管理・一括更新） */
export function createAnswerSheetApi() {
  return {
    // Student answer related
    uploadStudentAnswers: (
      examId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        studentId?: string
        examPageId: string
        overwrite?: boolean
        correctWithMarkers?: boolean
      }[]
    ) => ipcRenderer.invoke("upload-answer-sheets", examId, filesData),
    getStudentAnswersByExamId: (examId: string) =>
      ipcRenderer.invoke("get-answer-sheets-by-exam-id", examId),
    getStudentAnswersDataset: (examId: string) =>
      ipcRenderer.invoke("get-student-answers-dataset", examId),
    getStudentAnswerScoreSummary: (answerSheetId: string) =>
      ipcRenderer.invoke("get-answer-sheet-score-summary", answerSheetId),
    deleteStudentAnswer: (answerSheetId: string) =>
      ipcRenderer.invoke("delete-answer-sheet", answerSheetId),
    associateStudentAnswerWithStudent: (
      answerSheetId: string,
      studentId: string
    ) =>
      ipcRenderer.invoke(
        "associate-answer-sheet-with-student",
        answerSheetId,
        studentId
      ),
    setStudentAnswerAbsent: (answerSheetId: string, isAbsent: boolean) =>
      ipcRenderer.invoke("set-answer-sheet-absent", answerSheetId, isAbsent),
    getStudentAnswerById: (answerSheetId: string) =>
      ipcRenderer.invoke("get-answer-sheet-by-id", answerSheetId),
    applyStudentAnswerPlacements: (
      moves: Array<{
        fileId: string
        finalStudentId: string | null
        finalExamPageId: string
        scorePolicy: "carry" | "discard"
      }>
    ) => ipcRenderer.invoke("apply-answer-sheet-placements", moves),
  }
}
