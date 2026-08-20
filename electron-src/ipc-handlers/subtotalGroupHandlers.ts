import {
  addSubtotalGroupToExam,
  createSubtotalGroup,
  deleteSubtotalGroup,
  getActiveSubtotalGroupsForExam,
  getAvailableSubtotalGroupsForExam,
  getSubtotalGroups,
  getSubtotalGroupSelection,
  removeSubtotalGroupFromExam,
  setSubtotalGroupSelection,
  updateSubtotalGroup,
} from "../lib/prisma/subtotalGroup"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 小計点グループのCRUD・試験への紐付け管理に関するIPCチャンネルを登録する */
export const subtotalGroupHandlers = {
  // 小計点グループ一覧取得
  "get-subtotal-groups": async () => {
    return await getSubtotalGroups()
  },

  // 小計点グループ作成
  "create-subtotal-group": async (data: {
    name: string
    subtotals: {
      name: string
      order: number
    }[]
  }) => {
    return await createSubtotalGroup(data)
  },

  // 小計点グループ更新（小計項目は id で突き合わせて差分だけを書く。id が null の
  // 項目は新しく作るもので、その id は DB が振る）
  "update-subtotal-group": async (
    id: string,
    data: {
      name: string
      subtotals: {
        id: string | null
        name: string
        order: number
      }[]
    }
  ) => {
    return await updateSubtotalGroup(id, data)
  },

  // 小計点グループ削除
  "delete-subtotal-group": async (id: string) => {
    return await deleteSubtotalGroup(id)
  },

  // 試験で利用可能な小計点グループ取得
  "get-available-subtotal-groups-for-exam": async (examId: string) => {
    return await getAvailableSubtotalGroupsForExam(examId)
  },

  // 試験で有効化されている小計点グループ取得
  "get-active-subtotal-groups-for-exam": async (examId: string) => {
    return await getActiveSubtotalGroupsForExam(examId)
  },

  // 試験に小計点グループを追加
  "add-subtotal-group-to-exam": async (
    examId: string,
    subtotalGroupId: string
  ) => {
    return await addSubtotalGroupToExam(examId, subtotalGroupId)
  },

  // 試験から小計点グループを削除
  "remove-subtotal-group-from-exam": async (
    examId: string,
    subtotalGroupId: string
  ) => {
    return await removeSubtotalGroupFromExam(examId, subtotalGroupId)
  },

  // 小計グループの出力選択フラグ取得（個人成績表のテーブル/箱ひげ図）
  "get-subtotal-group-selection": async (examId: string) => {
    return await getSubtotalGroupSelection(examId)
  },

  // 小計グループの出力選択フラグ設定
  "set-subtotal-group-selection": async (
    examId: string,
    tableGroupIds: string[],
    boxPlotGroupIds: string[]
  ) => {
    return await setSubtotalGroupSelection(
      examId,
      tableGroupIds,
      boxPlotGroupIds
    )
  },
} satisfies HandlerMap
