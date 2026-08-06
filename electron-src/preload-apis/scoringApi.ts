import { ipcRenderer } from "electron"

import type {
  WhitenessTargetAnswerImage,
  WhitenessTargetRegion,
} from "../../src/types/answerWhiteness.types"
import type {
  CreateQuestionScoreArgs,
  UpdateQuestionScoreArgs,
} from "../../src/types/electron/scoringApi"

/** 採点スコアのIPC API（設問スコアCRUD・一括更新・確定・採点担当割当） */
export function createScoringApi() {
  return {
    // QuestionScore related functions
    getQuestionScore: (id: string) =>
      ipcRenderer.invoke("get-question-score", id),
    getQuestionScoresForExam: (examId: string, userId?: string) =>
      ipcRenderer.invoke("get-question-scores-for-exam", examId, userId),
    createQuestionScore: (data: CreateQuestionScoreArgs) =>
      ipcRenderer.invoke("create-question-score", data),
    updateQuestionScore: (
      id: string,
      data: UpdateQuestionScoreArgs,
      expectedVersion: number
    ) => ipcRenderer.invoke("update-question-score", id, data, expectedVersion),
    finalizeQuestionScore: (
      answerSheetId: string,
      cropRegionId: string,
      userId: string,
      scoreData: UpdateQuestionScoreArgs
    ) =>
      ipcRenderer.invoke(
        "finalize-question-score",
        answerSheetId,
        cropRegionId,
        userId,
        scoreData
      ),
    getExamDecisionSummary: (examId: string, userId: string) =>
      ipcRenderer.invoke("get-exam-decision-summary", examId, userId),
    getCropRegionAssignments: (examId: string, userId: string) =>
      ipcRenderer.invoke("get-crop-region-assignments", examId, userId),
    assignCropRegion: (
      cropRegionId: string,
      userId: string,
      assignedByUserId: string
    ) =>
      ipcRenderer.invoke(
        "assign-crop-region",
        cropRegionId,
        userId,
        assignedByUserId
      ),
    unassignCropRegion: (
      cropRegionId: string,
      userId: string,
      requestedByUserId: string
    ) =>
      ipcRenderer.invoke(
        "unassign-crop-region",
        cropRegionId,
        userId,
        requestedByUserId
      ),
    batchUpdateQuestionScores: (
      entries: Array<{
        examStudentId: string
        cropRegionId: string
        status: string
        partialScore: number | null
        userId: string
      }>
    ) => ipcRenderer.invoke("batch-update-question-scores", entries),
    measureAnswerWhiteness: (args: {
      answerImages: WhitenessTargetAnswerImage[]
      regions: WhitenessTargetRegion[]
    }) => ipcRenderer.invoke("measure-answer-whiteness", args),
  }
}
