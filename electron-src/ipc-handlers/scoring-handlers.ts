import { ipcMain } from "electron"
import {
  getQuestionScoresForProject,
  getQuestionScoresForAnswerSheet,
  createQuestionScore,
  updateQuestionScore,
  deleteQuestionScore,
  getQuestionScoreComparison,
  finalizeQuestionScore,
  getAnswerSheetProgress,
  getProjectProgress,
  CreateQuestionScoreData,
  UpdateQuestionScoreData,
} from "../lib/prisma/questionScore"
import { initializeScoringRecords } from "../lib/prisma/scoringInitializer"

export function setupScoringHandlers(): void {
  // QuestionScore 関連のハンドラー
  ipcMain.handle(
    "get-question-scores-for-project",
    async (_event, projectId: string) => {
      try {
        return await getQuestionScoresForProject(projectId)
      } catch (err) {
        console.error("Error getting question scores for project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-scores-for-answer-sheet",
    async (_event, answerSheetId: string) => {
      try {
        return await getQuestionScoresForAnswerSheet(answerSheetId)
      } catch (err) {
        console.error("Error getting question scores for answer sheet:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-question-score",
    async (_event, data: CreateQuestionScoreData) => {
      try {
        return await createQuestionScore(data)
      } catch (err) {
        console.error("Error creating question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-score",
    async (_event, id: string, data: UpdateQuestionScoreData, expectedVersion?: number) => {
      try {
        return await updateQuestionScore(id, data, expectedVersion)
      } catch (err) {
        console.error("Error updating question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-question-score",
    async (_event, id: string) => {
      try {
        return await deleteQuestionScore(id)
      } catch (err) {
        console.error("Error deleting question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-score-comparison",
    async (_event, answerSheetId: string, layoutRegionId: string) => {
      try {
        return await getQuestionScoreComparison(answerSheetId, layoutRegionId)
      } catch (err) {
        console.error("Error getting question score comparison:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "finalize-question-score",
    async (_event, answerSheetId: string, layoutRegionId: string, scoredByUserId: string, scoreData: {
      partialScore?: number
      status: string
      comment?: string
    }) => {
      try {
        return await finalizeQuestionScore(answerSheetId, layoutRegionId, scoredByUserId, scoreData)
      } catch (err) {
        console.error("Error finalizing question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-answer-sheet-progress",
    async (_event, answerSheetId: string) => {
      try {
        return await getAnswerSheetProgress(answerSheetId)
      } catch (err) {
        console.error("Error getting answer sheet progress:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-project-progress",
    async (_event, projectId: string) => {
      try {
        return await getProjectProgress(projectId)
      } catch (err) {
        console.error("Error getting project progress:", err)
        throw err
      }
    },
  )

  // Scoring initialization handler
  ipcMain.handle(
    "initialize-scoring-records",
    async (_event, projectId: string) => {
      try {
        return await initializeScoringRecords(projectId)
      } catch (err) {
        console.error("Error initializing scoring records:", err)
        throw err
      }
    },
  )
}