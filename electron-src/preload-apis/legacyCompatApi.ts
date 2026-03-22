import { Prisma } from "@prisma/client"
import { ipcRenderer } from "electron"

import {
  CropRegionCreateData,
  CropRegionUpdateData,
} from "../../src/types/common.types"

export function createLegacyCompatApi() {
  return {
    // 互換性関数（段階的移行のため古い名前も残す）
    createLayoutRegion: (data: CropRegionCreateData) =>
      ipcRenderer.invoke("create-crop-region", data),
    updateLayoutRegion: (id: string, data: CropRegionUpdateData) =>
      ipcRenderer.invoke("update-crop-region", id, data),
    deleteLayoutRegion: (id: string) =>
      ipcRenderer.invoke("delete-crop-region", id),
    getLayoutRegionsByExamId: (examId: string) =>
      ipcRenderer.invoke("get-crop-regions-by-exam-id", examId),
    getLayoutRegionById: (id: string) =>
      ipcRenderer.invoke("get-crop-region-by-id", id),
    updateLayoutRegionOrders: (
      updates: Array<{ id: string; orderIndex: number }>
    ) => ipcRenderer.invoke("update-crop-region-orders", updates),

    createQuestionGroup: (data: Prisma.SubtotalGroupUncheckedCreateInput) =>
      ipcRenderer.invoke("create-subtotal-group", data),
    updateQuestionGroup: (id: string, data: Prisma.SubtotalGroupUpdateInput) =>
      ipcRenderer.invoke("update-subtotal-group", id, data),
    deleteQuestionGroup: (id: string) =>
      ipcRenderer.invoke("delete-subtotal-group", id),
    getQuestionGroupsByExamId: (examId: string) =>
      ipcRenderer.invoke("get-subtotal-groups-by-exam-id", examId),
    getQuestionGroupById: (id: string) =>
      ipcRenderer.invoke("get-subtotal-group-by-id", id),

    createQuestionGroupItem: (data: Prisma.SubtotalUncheckedCreateInput) =>
      ipcRenderer.invoke("create-subtotal", data),
    createManyQuestionGroupItems: (
      items: Prisma.SubtotalUncheckedCreateInput[]
    ) => ipcRenderer.invoke("create-many-subtotals", items),
    updateQuestionGroupItem: (id: string, data: Prisma.SubtotalUpdateInput) =>
      ipcRenderer.invoke("update-subtotal", id, data),
    deleteQuestionGroupItem: (id: string) =>
      ipcRenderer.invoke("delete-subtotal", id),
    getQuestionGroupItemsByGroupId: (subtotalGroupId: string) =>
      ipcRenderer.invoke("get-subtotals-by-group-id", subtotalGroupId),
    getQuestionGroupItemById: (id: string) =>
      ipcRenderer.invoke("get-subtotal-by-id", id),
    updateQuestionGroupItemOrders: (orders: { id: string; order: number }[]) =>
      ipcRenderer.invoke("update-subtotal-orders", orders),

    createQuestionSubtotalAssignment: (
      data: Prisma.CropSubtotalUncheckedCreateInput
    ) => ipcRenderer.invoke("create-crop-subtotal", data),
    createManyQuestionSubtotalAssignments: (
      assignments: Prisma.CropSubtotalUncheckedCreateInput[]
    ) => ipcRenderer.invoke("create-many-crop-subtotals", assignments),
    deleteQuestionSubtotalAssignment: (id: string) =>
      ipcRenderer.invoke("delete-crop-subtotal", id),
    deleteAssignmentsByQuestionCropRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke(
        "delete-crop-subtotals-by-crop-region-id",
        cropRegionId
      ),
    deleteAssignmentsByQuestionGroupItemId: (subtotalId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),
    getAssignmentsByQuestionCropRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
    getAssignmentsByQuestionGroupItemId: (subtotalId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),

    createSubtotalDefinition: (data: Prisma.CropSubtotalUncheckedCreateInput) =>
      ipcRenderer.invoke("create-crop-subtotal", data),
    createManySubtotalDefinitions: (
      definitions: Prisma.CropSubtotalUncheckedCreateInput[]
    ) => ipcRenderer.invoke("create-many-crop-subtotals", definitions),
    deleteSubtotalDefinition: (id: string) =>
      ipcRenderer.invoke("delete-crop-subtotal", id),
    deleteSubtotalDefinitionsByLayoutRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke(
        "delete-crop-subtotals-by-crop-region-id",
        cropRegionId
      ),
    getSubtotalDefinitionsByLayoutRegionId: (cropRegionId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
    getSubtotalDefinitionsByQuestionGroupItemId: (subtotalId: string) =>
      ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),
  }
}
