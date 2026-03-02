import { ipcMain } from "electron"

import {
  addSubtotalGroupToExam,
  createSubtotalGroup,
  deleteSubtotalGroup,
  getActiveSubtotalGroupsForExam,
  getAvailableSubtotalGroupsForExam,
  getSubtotalGroups,
  removeSubtotalGroupFromExam,
  updateSubtotalGroup,
} from "../lib/prisma/subtotalGroup"

export function setupSubtotalGroupHandlers(): void {
  // 小計点グループ一覧取得
  ipcMain.handle("get-subtotal-groups", async () => {
    try {
      return await getSubtotalGroups()
    } catch (err) {
      console.error("Error getting subtotal groups:", err)
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  // 小計点グループ作成
  ipcMain.handle(
    "create-subtotal-group",
    async (
      _event,
      data: {
        name: string
        subtotals: {
          name: string
          order: number
        }[]
      }
    ) => {
      try {
        return await createSubtotalGroup(data)
      } catch (err) {
        console.error("Error creating subtotal group:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // 小計点グループ更新
  ipcMain.handle(
    "update-subtotal-group",
    async (
      _event,
      id: string,
      data: {
        name: string
        subtotals: {
          name: string
          order: number
        }[]
      }
    ) => {
      try {
        return await updateSubtotalGroup(id, data)
      } catch (err) {
        console.error("Error updating subtotal group:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // 小計点グループ削除
  ipcMain.handle("delete-subtotal-group", async (_event, id: string) => {
    try {
      return await deleteSubtotalGroup(id)
    } catch (err) {
      console.error("Error deleting subtotal group:", err)
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  // 試験で利用可能な小計点グループ取得
  ipcMain.handle(
    "get-available-subtotal-groups-for-exam",
    async (_event, examId: string) => {
      try {
        return await getAvailableSubtotalGroupsForExam(examId)
      } catch (err) {
        console.error("Error getting available subtotal groups for exam:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // 試験で有効化されている小計点グループ取得
  ipcMain.handle(
    "get-active-subtotal-groups-for-exam",
    async (_event, examId: string) => {
      try {
        return await getActiveSubtotalGroupsForExam(examId)
      } catch (err) {
        console.error("Error getting active subtotal groups for exam:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // 試験に小計点グループを追加
  ipcMain.handle(
    "add-subtotal-group-to-exam",
    async (_event, examId: string, subtotalGroupId: string) => {
      try {
        return await addSubtotalGroupToExam(examId, subtotalGroupId)
      } catch (err) {
        console.error("Error adding subtotal group to exam:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // 試験から小計点グループを削除
  ipcMain.handle(
    "remove-subtotal-group-from-exam",
    async (_event, examId: string, subtotalGroupId: string) => {
      try {
        return await removeSubtotalGroupFromExam(examId, subtotalGroupId)
      } catch (err) {
        console.error("Error removing subtotal group from exam:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )
}
