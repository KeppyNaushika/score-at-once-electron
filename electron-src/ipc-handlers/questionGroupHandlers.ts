import { ipcMain } from "electron"

import {
  createQuestionGroup,
  deleteQuestionGroup,
  getQuestionGroupById,
  getQuestionGroupsByExamId,
  updateQuestionGroup,
} from "../lib/prisma/questionGroup"
import {
  createManyQuestionGroupItems,
  createQuestionGroupItem,
  deleteQuestionGroupItem,
  getQuestionGroupItemById,
  getQuestionGroupItemsByGroupId,
  updateQuestionGroupItem,
  updateQuestionGroupItemOrders,
} from "../lib/prisma/questionGroupItem"
import {
  createManyQuestionSubtotalAssignments,
  createQuestionSubtotalAssignment,
  deleteAssignmentsByQuestionGroupItemId,
  deleteQuestionSubtotalAssignment,
  getAssignmentsByQuestionGroupItemId,
} from "../lib/prisma/questionSubtotalAssignment"
import {
  createManySubtotalDefinitions,
  createSubtotalDefinition,
  deleteSubtotalDefinition,
  deleteSubtotalDefinitionsByCropRegionId,
  getSubtotalDefinitionsByQuestionGroupItemId,
} from "../lib/prisma/subtotalDefinition"

export function setupQuestionGroupHandlers(): void {
  // 既存のハンドラーをクリア（重複登録を防ぐ）
  ipcMain.removeHandler("create-question-group")
  ipcMain.removeHandler("update-question-group")
  ipcMain.removeHandler("delete-question-group")
  ipcMain.removeHandler("get-question-groups-by-exam-id")
  ipcMain.removeHandler("get-question-group-by-id")
  ipcMain.removeHandler("create-question-group-item")
  ipcMain.removeHandler("create-many-question-group-items")
  ipcMain.removeHandler("update-question-group-item")
  ipcMain.removeHandler("delete-question-group-item")
  ipcMain.removeHandler("get-question-group-items-by-group-id")
  ipcMain.removeHandler("get-question-group-item-by-id")
  ipcMain.removeHandler("update-question-group-item-orders")
  ipcMain.removeHandler("create-question-subtotal-assignment")
  ipcMain.removeHandler("create-many-question-subtotal-assignments")
  ipcMain.removeHandler("delete-question-subtotal-assignment")
  ipcMain.removeHandler("delete-assignments-by-question-layout-region-id")
  ipcMain.removeHandler("delete-assignments-by-question-group-item-id")
  ipcMain.removeHandler("get-assignments-by-question-layout-region-id")
  ipcMain.removeHandler("get-assignments-by-question-group-item-id")
  ipcMain.removeHandler("create-subtotal-definition")
  ipcMain.removeHandler("create-many-subtotal-definitions")
  ipcMain.removeHandler("delete-subtotal-definition")
  ipcMain.removeHandler("delete-subtotal-definitions-by-crop-region-id")
  ipcMain.removeHandler("get-subtotal-definitions-by-crop-region-id")
  ipcMain.removeHandler("get-subtotal-definitions-by-question-group-item-id")

  // QuestionGroup handlers
  ipcMain.handle("create-question-group", async (_event, data) => {
    try {
      return await createQuestionGroup(data)
    } catch (err) {
      console.error("Error creating question group:", err)
      throw err
    }
  })

  ipcMain.handle("update-question-group", async (_event, id, data) => {
    try {
      return await updateQuestionGroup(id, data)
    } catch (err) {
      console.error("Error updating question group:", err)
      throw err
    }
  })

  ipcMain.handle("delete-question-group", async (_event, id) => {
    try {
      return await deleteQuestionGroup(id)
    } catch (err) {
      console.error("Error deleting question group:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-groups-by-exam-id", async (_event, examId) => {
    try {
      return await getQuestionGroupsByExamId(examId)
    } catch (err) {
      console.error("Error getting question groups by exam id:", err)
      throw err
    }
  })

  ipcMain.handle("get-question-group-by-id", async (_event, id) => {
    try {
      return await getQuestionGroupById(id)
    } catch (err) {
      console.error("Error getting question group by id:", err)
      throw err
    }
  })

  // QuestionGroupItem handlers
  ipcMain.handle("create-question-group-item", async (_event, data) => {
    try {
      return await createQuestionGroupItem(data)
    } catch (err) {
      console.error("Error creating question group item:", err)
      throw err
    }
  })

  ipcMain.handle("create-many-question-group-items", async (_event, items) => {
    try {
      return await createManyQuestionGroupItems(items)
    } catch (err) {
      console.error("Error creating many question group items:", err)
      throw err
    }
  })

  ipcMain.handle("update-question-group-item", async (_event, id, data) => {
    try {
      return await updateQuestionGroupItem(id, data)
    } catch (err) {
      console.error("Error updating question group item:", err)
      throw err
    }
  })

  ipcMain.handle("delete-question-group-item", async (_event, id) => {
    try {
      return await deleteQuestionGroupItem(id)
    } catch (err) {
      console.error("Error deleting question group item:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-question-group-items-by-group-id",
    async (_event, questionGroupId) => {
      try {
        return await getQuestionGroupItemsByGroupId(questionGroupId)
      } catch (err) {
        console.error("Error getting question group items by group id:", err)
        throw err
      }
    }
  )

  ipcMain.handle("get-question-group-item-by-id", async (_event, id) => {
    try {
      return await getQuestionGroupItemById(id)
    } catch (err) {
      console.error("Error getting question group item by id:", err)
      throw err
    }
  })

  ipcMain.handle(
    "update-question-group-item-orders",
    async (_event, orders) => {
      try {
        const result = await updateQuestionGroupItemOrders(orders)
        return result
      } catch (err) {
        console.error("Error updating question group item orders:", err)
        throw err
      }
    }
  )

  // QuestionSubtotalAssignment handlers
  ipcMain.handle(
    "create-question-subtotal-assignment",
    async (_event, data) => {
      try {
        return await createQuestionSubtotalAssignment(data)
      } catch (err) {
        console.error("Error creating question subtotal assignment:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "create-many-question-subtotal-assignments",
    async (_event, assignments) => {
      try {
        return await createManyQuestionSubtotalAssignments(assignments)
      } catch (err) {
        console.error("Error creating many question subtotal assignments:", err)
        throw err
      }
    }
  )

  ipcMain.handle("delete-question-subtotal-assignment", async (_event, id) => {
    try {
      return await deleteQuestionSubtotalAssignment(id)
    } catch (err) {
      console.error("Error deleting question subtotal assignment:", err)
      throw err
    }
  })

  // Note: delete-assignments-by-question-crop-region-id handler moved to crop-region-handlers.ts

  ipcMain.handle(
    "delete-assignments-by-question-group-item-id",
    async (_event, questionGroupItemId) => {
      try {
        return await deleteAssignmentsByQuestionGroupItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error deleting assignments by question group item id:",
          err
        )
        throw err
      }
    }
  )

  // Note: get-assignments-by-question-crop-region-id handler moved to crop-region-handlers.ts

  ipcMain.handle(
    "get-assignments-by-question-group-item-id",
    async (_event, questionGroupItemId) => {
      try {
        const assignments =
          await getAssignmentsByQuestionGroupItemId(questionGroupItemId)
        return {
          success: true,
          assignments,
        }
      } catch (err) {
        console.error(
          "Error getting assignments by question group item id:",
          err
        )
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // SubtotalDefinition handlers
  ipcMain.handle("create-subtotal-definition", async (_event, data) => {
    try {
      return await createSubtotalDefinition(data)
    } catch (err) {
      console.error("Error creating subtotal definition:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-many-subtotal-definitions",
    async (_event, definitions) => {
      try {
        return await createManySubtotalDefinitions(definitions)
      } catch (err) {
        console.error("Error creating many subtotal definitions:", err)
        throw err
      }
    }
  )

  ipcMain.handle("delete-subtotal-definition", async (_event, id) => {
    try {
      return await deleteSubtotalDefinition(id)
    } catch (err) {
      console.error("Error deleting subtotal definition:", err)
      throw err
    }
  })

  ipcMain.handle(
    "delete-subtotal-definitions-by-crop-region-id",
    async (_event, cropRegionId) => {
      try {
        return await deleteSubtotalDefinitionsByCropRegionId(cropRegionId)
      } catch (err) {
        console.error(
          "Error deleting subtotal definitions by layout region id:",
          err
        )
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-subtotal-definitions-by-question-group-item-id",
    async (_event, questionGroupItemId) => {
      try {
        return await getSubtotalDefinitionsByQuestionGroupItemId(
          questionGroupItemId
        )
      } catch (err) {
        console.error(
          "Error getting subtotal definitions by question group item id:",
          err
        )
        throw err
      }
    }
  )
}
