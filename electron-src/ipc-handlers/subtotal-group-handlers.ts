import { ipcMain } from "electron"
import {
  getSubtotalGroups,
  createSubtotalGroup,
  updateSubtotalGroup,
  deleteSubtotalGroup,
  getAvailableSubtotalGroupsForProject,
  getActiveSubtotalGroupsForProject,
  addSubtotalGroupToProject,
  removeSubtotalGroupFromProject,
} from "../lib/prisma/subtotalGroup"

export function setupSubtotalGroupHandlers(): void {
  console.log("🔄 Setting up SubtotalGroup IPC handlers...")
  
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

  // プロジェクトで利用可能な小計点グループ取得
  ipcMain.handle(
    "get-available-subtotal-groups-for-project",
    async (_event, projectId: string) => {
      try {
        return await getAvailableSubtotalGroupsForProject(projectId)
      } catch (err) {
        console.error(
          "Error getting available subtotal groups for project:",
          err
        )
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // プロジェクトで有効化されている小計点グループ取得
  ipcMain.handle(
    "get-active-subtotal-groups-for-project",
    async (_event, projectId: string) => {
      try {
        return await getActiveSubtotalGroupsForProject(projectId)
      } catch (err) {
        console.error("Error getting active subtotal groups for project:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // プロジェクトに小計点グループを追加
  ipcMain.handle(
    "add-subtotal-group-to-project",
    async (_event, projectId: string, subtotalGroupId: string) => {
      try {
        return await addSubtotalGroupToProject(projectId, subtotalGroupId)
      } catch (err) {
        console.error("Error adding subtotal group to project:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  // プロジェクトから小計点グループを削除
  ipcMain.handle(
    "remove-subtotal-group-from-project",
    async (_event, projectId: string, subtotalGroupId: string) => {
      try {
        return await removeSubtotalGroupFromProject(projectId, subtotalGroupId)
      } catch (err) {
        console.error("Error removing subtotal group from project:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )
  
  console.log("✅ SubtotalGroup IPC handlers setup completed")
}