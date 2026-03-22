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
        pageNumber?: number
        overwrite?: boolean
        correctWithMarkers?: boolean
      }[]
    ) => ipcRenderer.invoke("upload-answer-sheets", examId, filesData),
    getStudentAnswersByExamId: (examId: string) =>
      ipcRenderer.invoke("get-answer-sheets-by-exam-id", examId),
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
    updateStudentAnswerPlacement: (
      answerSheetId: string,
      studentId: string | null,
      pageNumber: number
    ) =>
      ipcRenderer.invoke(
        "update-answer-sheet-placement",
        answerSheetId,
        studentId,
        pageNumber
      ),
    swapStudentAnswerPlacements: (
      answerSheetId1: string,
      answerSheetId2: string
    ) =>
      ipcRenderer.invoke(
        "swap-answer-sheet-placements",
        answerSheetId1,
        answerSheetId2
      ),
    swapStudentAnswerPlacementsWithScoring: (
      answerSheetId1: string,
      answerSheetId2: string
    ) =>
      ipcRenderer.invoke(
        "swap-answer-sheet-placements-with-scoring",
        answerSheetId1,
        answerSheetId2
      ),
    batchUpdateStudentAnswerPlacements: (
      moves: Array<{
        fileId: string
        finalStudentId: string | null
        finalPageNumber: number
      }>,
      withScoring: boolean
    ) =>
      ipcRenderer.invoke(
        "batch-update-answer-sheet-placements",
        moves,
        withScoring
      ),
  }
}
