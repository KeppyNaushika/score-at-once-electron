import { Prisma } from "@prisma/client"
import { ipcRenderer } from "electron"

import {
  CropRegionCreateData,
  CropRegionUpdateData,
} from "../../src/types/common.types"

export function createCropRegionApi() {
  return {
    // CropRegion functions (renamed from LayoutRegion)
    createCropRegion: (data: CropRegionCreateData) =>
      ipcRenderer.invoke("create-crop-region", data),
    createManyCropRegions: (data: Prisma.CropRegionCreateManyInput[]) =>
      ipcRenderer.invoke("create-many-crop-regions", data),
    updateCropRegion: (id: string, data: CropRegionUpdateData) =>
      ipcRenderer.invoke("update-crop-region", id, data),
    deleteCropRegion: (id: string) =>
      ipcRenderer.invoke("delete-crop-region", id),
    getCropRegionsByExamId: (examId: string) =>
      ipcRenderer.invoke("get-crop-regions-by-exam-id", examId),
    getQuestionAnswerRegionsByExamId: (examId: string) =>
      ipcRenderer.invoke("get-question-answer-regions-by-exam-id", examId),
    getCropRegionById: (id: string) =>
      ipcRenderer.invoke("get-crop-region-by-id", id),
    updateCropRegionOrders: (
      updates: Array<{ id: string; orderIndex: number }>
    ) => ipcRenderer.invoke("update-crop-region-orders", updates),
  }
}
