import { Prisma } from "@prisma/client"
import { ipcRenderer } from "electron"

/** 小計グループ・小計・採点領域-小計紐付けのIPC API（CRUD・試験への割り当て管理） */
export function createSubtotalApi() {
  return {
    // SubtotalGroup related (new management API with correct parameter format)
    createSubtotalGroup: (data: {
      name: string
      subtotals: { name: string; order: number }[]
    }) => ipcRenderer.invoke("create-subtotal-group", data),
    updateSubtotalGroup: (
      id: string,
      data: { name: string; subtotals: { name: string; order: number }[] }
    ) => ipcRenderer.invoke("update-subtotal-group", id, data),
    deleteSubtotalGroup: (id: string) =>
      ipcRenderer.invoke("delete-subtotal-group", id),

    // New SubtotalGroup management API
    getSubtotalGroups: () => ipcRenderer.invoke("get-subtotal-groups"),
    getAvailableSubtotalGroupsForExam: (examId: string) =>
      ipcRenderer.invoke("get-available-subtotal-groups-for-exam", examId),
    getActiveSubtotalGroupsForExam: (examId: string) =>
      ipcRenderer.invoke("get-active-subtotal-groups-for-exam", examId),
    addSubtotalGroupToExam: (examId: string, subtotalGroupId: string) =>
      ipcRenderer.invoke("add-subtotal-group-to-exam", examId, subtotalGroupId),
    removeSubtotalGroupFromExam: (examId: string, subtotalGroupId: string) =>
      ipcRenderer.invoke(
        "remove-subtotal-group-from-exam",
        examId,
        subtotalGroupId
      ),
    getSubtotalGroupSelection: (examId: string) =>
      ipcRenderer.invoke("get-subtotal-group-selection", examId),
    setSubtotalGroupSelection: (
      examId: string,
      tableGroupIds: string[],
      boxPlotGroupIds: string[]
    ) =>
      ipcRenderer.invoke(
        "set-subtotal-group-selection",
        examId,
        tableGroupIds,
        boxPlotGroupIds
      ),

    // Subtotal related (renamed from QuestionGroupItem)
    createSubtotal: (data: Prisma.SubtotalUncheckedCreateInput) =>
      ipcRenderer.invoke("create-subtotal", data),
    createManySubtotals: (items: Prisma.SubtotalUncheckedCreateInput[]) =>
      ipcRenderer.invoke("create-many-subtotals", items),
    updateSubtotal: (id: string, data: Prisma.SubtotalUpdateInput) =>
      ipcRenderer.invoke("update-subtotal", id, data),
    deleteSubtotal: (id: string) => ipcRenderer.invoke("delete-subtotal", id),
    getSubtotalsByGroupId: (subtotalGroupId: string) =>
      ipcRenderer.invoke("get-subtotals-by-group-id", subtotalGroupId),
    getSubtotalById: (id: string) =>
      ipcRenderer.invoke("get-subtotal-by-id", id),

    // CropSubtotal related (unified from QuestionSubtotalAssignment + SubtotalDefinition)
    createCropSubtotal: (data: Prisma.CropSubtotalUncheckedCreateInput) =>
      ipcRenderer.invoke("create-crop-subtotal", data),
    createManyCropSubtotals: (
      assignments: Prisma.CropSubtotalUncheckedCreateInput[]
    ) => ipcRenderer.invoke("create-many-crop-subtotals", assignments),
    deleteCropSubtotal: (id: string) =>
      ipcRenderer.invoke("delete-crop-subtotal", id),
    deleteCropSubtotalsByCropRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke(
        "delete-crop-subtotals-by-crop-region-id",
        cropRegionId
      ),
    getCropSubtotalsByCropRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
    getCropSubtotalsBySubtotalId: (subtotalId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),

    // 互換性関数（旧SubtotalDefinition用、CropSubtotalでの統合エイリアス）
    getSubtotalDefinitionsByCropRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke(
        "get-subtotal-definitions-by-crop-region-id",
        cropRegionId
      ),
  }
}
