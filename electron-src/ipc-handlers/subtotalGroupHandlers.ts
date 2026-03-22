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
import { registerSafeHandler } from "./ipcHandlerUtils"

/** 小計点グループのCRUD・試験への紐付け管理に関するIPCチャンネルを登録する */
export function setupSubtotalGroupHandlers(): void {
  // 小計点グループ一覧取得
  registerSafeHandler("get-subtotal-groups", async () => {
    return await getSubtotalGroups()
  })

  // 小計点グループ作成
  registerSafeHandler(
    "create-subtotal-group",
    async (data: {
      name: string
      subtotals: {
        name: string
        order: number
      }[]
    }) => {
      return await createSubtotalGroup(data)
    }
  )

  // 小計点グループ更新
  registerSafeHandler(
    "update-subtotal-group",
    async (
      id: string,
      data: {
        name: string
        subtotals: {
          name: string
          order: number
        }[]
      }
    ) => {
      return await updateSubtotalGroup(id, data)
    }
  )

  // 小計点グループ削除
  registerSafeHandler("delete-subtotal-group", async (id: string) => {
    return await deleteSubtotalGroup(id)
  })

  // 試験で利用可能な小計点グループ取得
  registerSafeHandler(
    "get-available-subtotal-groups-for-exam",
    async (examId: string) => {
      return await getAvailableSubtotalGroupsForExam(examId)
    }
  )

  // 試験で有効化されている小計点グループ取得
  registerSafeHandler(
    "get-active-subtotal-groups-for-exam",
    async (examId: string) => {
      return await getActiveSubtotalGroupsForExam(examId)
    }
  )

  // 試験に小計点グループを追加
  registerSafeHandler(
    "add-subtotal-group-to-exam",
    async (examId: string, subtotalGroupId: string) => {
      return await addSubtotalGroupToExam(examId, subtotalGroupId)
    }
  )

  // 試験から小計点グループを削除
  registerSafeHandler(
    "remove-subtotal-group-from-exam",
    async (examId: string, subtotalGroupId: string) => {
      return await removeSubtotalGroupFromExam(examId, subtotalGroupId)
    }
  )
}
