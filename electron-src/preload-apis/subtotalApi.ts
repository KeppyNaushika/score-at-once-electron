import type { Prisma } from "@prisma/client"

import { invoke } from "./invoke"

/** 小計グループ・採点領域-小計紐付けのIPC API（CRUD・試験への割り当て管理） */
export function createSubtotalApi() {
  return {
    // SubtotalGroup related (new management API with correct parameter format)
    createSubtotalGroup: (data: {
      name: string
      subtotals: { name: string; order: number }[]
    }) => invoke("create-subtotal-group", data),
    updateSubtotalGroup: (
      id: string,
      data: { name: string; subtotals: { name: string; order: number }[] }
    ) => invoke("update-subtotal-group", id, data),
    deleteSubtotalGroup: (id: string) => invoke("delete-subtotal-group", id),

    // New SubtotalGroup management API
    getSubtotalGroups: () => invoke("get-subtotal-groups"),
    getAvailableSubtotalGroupsForExam: (examId: string) =>
      invoke("get-available-subtotal-groups-for-exam", examId),
    getActiveSubtotalGroupsForExam: (examId: string) =>
      invoke("get-active-subtotal-groups-for-exam", examId),
    addSubtotalGroupToExam: (examId: string, subtotalGroupId: string) =>
      invoke("add-subtotal-group-to-exam", examId, subtotalGroupId),
    removeSubtotalGroupFromExam: (examId: string, subtotalGroupId: string) =>
      invoke("remove-subtotal-group-from-exam", examId, subtotalGroupId),
    getSubtotalGroupSelection: (examId: string) =>
      invoke("get-subtotal-group-selection", examId),
    setSubtotalGroupSelection: (
      examId: string,
      tableGroupIds: string[],
      boxPlotGroupIds: string[]
    ) =>
      invoke(
        "set-subtotal-group-selection",
        examId,
        tableGroupIds,
        boxPlotGroupIds
      ),

    // CropSubtotal related (unified from QuestionSubtotalAssignment + SubtotalDefinition)
    createManyCropSubtotals: (
      assignments: Prisma.CropSubtotalUncheckedCreateInput[]
    ) => invoke("create-many-crop-subtotals", assignments),
    deleteCropSubtotalsByCropRegionId: (cropRegionId: string) =>
      invoke("delete-crop-subtotals-by-crop-region-id", cropRegionId),
    getCropSubtotalsByCropRegionId: (cropRegionId: string) =>
      invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
  }
}
