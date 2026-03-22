import { ipcRenderer } from "electron"

import {
  QuestionScoreCreateData,
  QuestionScoreUpdateData,
} from "../../src/types/common.types"

export function createScoringApi() {
  return {
    // QuestionScore related functions
    getQuestionScore: (id: string) =>
      ipcRenderer.invoke("get-question-score", id),
    getQuestionScoresForExam: (examId: string, userId?: string) =>
      ipcRenderer.invoke("get-question-scores-for-exam", examId, userId),
    getQuestionScoresForAnswerSheet: (answerSheetId: string) =>
      ipcRenderer.invoke("get-question-scores-for-answer-sheet", answerSheetId),
    createQuestionScore: (data: QuestionScoreCreateData) =>
      ipcRenderer.invoke("create-question-score", data),
    updateQuestionScore: (
      id: string,
      data: QuestionScoreUpdateData,
      expectedVersion: number
    ) => ipcRenderer.invoke("update-question-score", id, data, expectedVersion),
    deleteQuestionScore: (id: string) =>
      ipcRenderer.invoke("delete-question-score", id),
    getQuestionScoreComparison: (answerSheetId: string, cropRegionId: string) =>
      ipcRenderer.invoke(
        "get-question-score-comparison",
        answerSheetId,
        cropRegionId
      ),
    finalizeQuestionScore: (
      answerSheetId: string,
      cropRegionId: string,
      userId: string,
      scoreData: QuestionScoreUpdateData
    ) =>
      ipcRenderer.invoke(
        "finalize-question-score",
        answerSheetId,
        cropRegionId,
        userId,
        scoreData
      ),
    getAnswerSheetProgress: (answerSheetId: string) =>
      ipcRenderer.invoke("get-answer-sheet-progress", answerSheetId),
    getExamProgress: (examId: string) =>
      ipcRenderer.invoke("get-exam-progress", examId),
    initializeScoringRecords: (examId: string) =>
      ipcRenderer.invoke("initialize-scoring-records", examId),
    batchUpdateQuestionScores: (
      entries: Array<{
        studentId: string
        cropRegionId: string
        status: string
        partialScore: number | null
        userId: string
      }>
    ) => ipcRenderer.invoke("batch-update-question-scores", entries),
  }
}
