import { ipcMain } from "electron"
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionsByProjectId,
  getQuestionById,
  updateQuestionOrders,
} from "../lib/prisma/question"
import {
  createQuestionPart,
  createManyQuestionParts,
  updateQuestionPart,
  deleteQuestionPart,
  getQuestionPartsByQuestionId,
  getQuestionPartById,
  updateQuestionPartOrders,
} from "../lib/prisma/questionPart"
import {
  createQuestionPartScore,
  createManyQuestionPartScores,
  updateQuestionPartScore,
  deleteQuestionPartScore,
  getQuestionPartScoresByQuestionPartId,
  getQuestionPartScoreById,
  getQuestionPartScoresByAnswerSheetId,
} from "../lib/prisma/questionPartScore"

export function setupQuestionHandlers(): void {
  // 既存のハンドラーをクリア（重複登録を防ぐ）
  ipcMain.removeHandler("create-question")
  ipcMain.removeHandler("update-question")
  ipcMain.removeHandler("delete-question")
  ipcMain.removeHandler("get-questions-by-project-id")
  ipcMain.removeHandler("get-question-by-id")
  ipcMain.removeHandler("update-question-orders")
  ipcMain.removeHandler("create-question-part")
  ipcMain.removeHandler("create-many-question-parts")
  ipcMain.removeHandler("update-question-part")
  ipcMain.removeHandler("delete-question-part")
  ipcMain.removeHandler("get-question-parts-by-question-id")
  ipcMain.removeHandler("get-question-part-by-id")
  ipcMain.removeHandler("update-question-part-orders")
  ipcMain.removeHandler("create-question-part-score")
  ipcMain.removeHandler("create-many-question-part-scores")
  ipcMain.removeHandler("update-question-part-score")
  ipcMain.removeHandler("delete-question-part-score")
  ipcMain.removeHandler("get-question-part-scores-by-question-part-id")
  ipcMain.removeHandler("get-question-part-score-by-id")
  ipcMain.removeHandler("get-question-part-scores-by-answer-sheet-id")

  // Question handlers
  ipcMain.handle("create-question", async (_event, data) => {
    try {
      return await createQuestion(data)
    } catch (err) {
      console.error("Error creating question:", err)
      throw err
    }
  })

  ipcMain.handle("update-question", async (_event, id, data) => {
    try {
      return await updateQuestion(id, data)
    } catch (err) {
      console.error("Error updating question:", err)
      throw err
    }
  })

  ipcMain.handle("delete-question", async (_event, id) => {
    try {
      return await deleteQuestion(id)
    } catch (err) {
      console.error("Error deleting question:", err)
      throw err
    }
  })

  ipcMain.handle("get-questions-by-project-id", async (_event, projectId) => {
    try {
      return await getQuestionsByProjectId(projectId)
    } catch (err) {
      console.error("Error getting questions by project id:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-by-id", async (_event, id) => {
    try {
      return await getQuestionById(id)
    } catch (err) {
      console.error("Error getting question by id:", err)
      throw err
    }
  })

  ipcMain.handle("update-question-orders", async (_event, orders) => {
    try {
      console.log("🔄 IPC: update-question-orders called with:", orders)
      const result = await updateQuestionOrders(orders)
      console.log("✅ IPC: update-question-orders result:", result)
      return result
    } catch (err) {
      console.error("❌ IPC: Error updating question orders:", err)
      throw err
    }
  })

  // QuestionPart handlers
  ipcMain.handle("create-question-part", async (_event, data) => {
    try {
      return await createQuestionPart(data)
    } catch (err) {
      console.error("Error creating question part:", err)
      throw err
    }
  })

  ipcMain.handle("create-many-question-parts", async (_event, parts) => {
    try {
      return await createManyQuestionParts(parts)
    } catch (err) {
      console.error("Error creating many question parts:", err)
      throw err
    }
  })

  ipcMain.handle("update-question-part", async (_event, id, data) => {
    try {
      return await updateQuestionPart(id, data)
    } catch (err) {
      console.error("Error updating question part:", err)
      throw err
    }
  })

  ipcMain.handle("delete-question-part", async (_event, id) => {
    try {
      return await deleteQuestionPart(id)
    } catch (err) {
      console.error("Error deleting question part:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-parts-by-question-id", async (_event, questionId) => {
    try {
      return await getQuestionPartsByQuestionId(questionId)
    } catch (err) {
      console.error("Error getting question parts by question id:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-part-by-id", async (_event, id) => {
    try {
      return await getQuestionPartById(id)
    } catch (err) {
      console.error("Error getting question part by id:", err)
      throw err
    }
  })

  ipcMain.handle("update-question-part-orders", async (_event, orders) => {
    try {
      console.log("🔄 IPC: update-question-part-orders called with:", orders)
      const result = await updateQuestionPartOrders(orders)
      console.log("✅ IPC: update-question-part-orders result:", result)
      return result
    } catch (err) {
      console.error("❌ IPC: Error updating question part orders:", err)
      throw err
    }
  })

  // QuestionPartScore handlers
  ipcMain.handle("create-question-part-score", async (_event, data) => {
    try {
      return await createQuestionPartScore(data)
    } catch (err) {
      console.error("Error creating question part score:", err)
      throw err
    }
  })

  ipcMain.handle("create-many-question-part-scores", async (_event, scores) => {
    try {
      return await createManyQuestionPartScores(scores)
    } catch (err) {
      console.error("Error creating many question part scores:", err)
      throw err
    }
  })

  ipcMain.handle("update-question-part-score", async (_event, id, data) => {
    try {
      return await updateQuestionPartScore(id, data)
    } catch (err) {
      console.error("Error updating question part score:", err)
      throw err
    }
  })

  ipcMain.handle("delete-question-part-score", async (_event, id) => {
    try {
      return await deleteQuestionPartScore(id)
    } catch (err) {
      console.error("Error deleting question part score:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-part-scores-by-question-part-id", async (_event, questionPartId) => {
    try {
      return await getQuestionPartScoresByQuestionPartId(questionPartId)
    } catch (err) {
      console.error("Error getting question part scores by question part id:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-part-score-by-id", async (_event, id) => {
    try {
      return await getQuestionPartScoreById(id)
    } catch (err) {
      console.error("Error getting question part score by id:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-part-scores-by-answer-sheet-id", async (_event, answerSheetId) => {
    try {
      return await getQuestionPartScoresByAnswerSheetId(answerSheetId)
    } catch (err) {
      console.error("Error getting question part scores by answer sheet id:", err)
      throw err
    }
  })
}