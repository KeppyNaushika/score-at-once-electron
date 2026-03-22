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
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** 設問グループ・設問項目・小計点割当・小計点定義のCRUD用IPCチャンネルを登録する */
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
  registerHandler("create-question-group", async (data) => {
    return await createQuestionGroup(data)
  })

  registerHandler("update-question-group", async (id, data) => {
    return await updateQuestionGroup(id, data)
  })

  registerHandler("delete-question-group", async (id) => {
    return await deleteQuestionGroup(id)
  })

  registerHandler("get-question-groups-by-exam-id", async (examId) => {
    return await getQuestionGroupsByExamId(examId)
  })

  registerHandler("get-question-group-by-id", async (id) => {
    return await getQuestionGroupById(id)
  })

  // QuestionGroupItem handlers
  registerHandler("create-question-group-item", async (data) => {
    return await createQuestionGroupItem(data)
  })

  registerHandler("create-many-question-group-items", async (items) => {
    return await createManyQuestionGroupItems(items)
  })

  registerHandler("update-question-group-item", async (id, data) => {
    return await updateQuestionGroupItem(id, data)
  })

  registerHandler("delete-question-group-item", async (id) => {
    return await deleteQuestionGroupItem(id)
  })

  registerHandler(
    "get-question-group-items-by-group-id",
    async (questionGroupId) => {
      return await getQuestionGroupItemsByGroupId(questionGroupId)
    }
  )

  registerHandler("get-question-group-item-by-id", async (id) => {
    return await getQuestionGroupItemById(id)
  })

  registerHandler("update-question-group-item-orders", async (orders) => {
    const result = await updateQuestionGroupItemOrders(orders)
    return result
  })

  // QuestionSubtotalAssignment handlers
  registerHandler("create-question-subtotal-assignment", async (data) => {
    return await createQuestionSubtotalAssignment(data)
  })

  registerHandler(
    "create-many-question-subtotal-assignments",
    async (assignments) => {
      return await createManyQuestionSubtotalAssignments(assignments)
    }
  )

  registerHandler("delete-question-subtotal-assignment", async (id) => {
    return await deleteQuestionSubtotalAssignment(id)
  })

  // Note: delete-assignments-by-question-crop-region-id handler moved to crop-region-handlers.ts

  registerHandler(
    "delete-assignments-by-question-group-item-id",
    async (questionGroupItemId) => {
      return await deleteAssignmentsByQuestionGroupItemId(questionGroupItemId)
    }
  )

  // Note: get-assignments-by-question-crop-region-id handler moved to crop-region-handlers.ts

  registerSafeHandler(
    "get-assignments-by-question-group-item-id",
    async (questionGroupItemId) => {
      const assignments =
        await getAssignmentsByQuestionGroupItemId(questionGroupItemId)
      return {
        success: true,
        assignments,
      }
    }
  )

  // SubtotalDefinition handlers
  registerHandler("create-subtotal-definition", async (data) => {
    return await createSubtotalDefinition(data)
  })

  registerHandler("create-many-subtotal-definitions", async (definitions) => {
    return await createManySubtotalDefinitions(definitions)
  })

  registerHandler("delete-subtotal-definition", async (id) => {
    return await deleteSubtotalDefinition(id)
  })

  registerHandler(
    "delete-subtotal-definitions-by-crop-region-id",
    async (cropRegionId) => {
      return await deleteSubtotalDefinitionsByCropRegionId(cropRegionId)
    }
  )

  registerHandler(
    "get-subtotal-definitions-by-question-group-item-id",
    async (questionGroupItemId) => {
      return await getSubtotalDefinitionsByQuestionGroupItemId(
        questionGroupItemId
      )
    }
  )
}
