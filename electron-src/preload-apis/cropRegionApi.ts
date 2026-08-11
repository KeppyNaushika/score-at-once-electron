import type {
  CreateCropRegionArgs,
  UpdateCropRegionArgs,
} from "../../src/types/electron/cropRegionApi"
import { invoke } from "./invoke"

/** 採点領域（CropRegion）のIPC API（CRUD・並び順更新） */
export function createCropRegionApi() {
  return {
    // CropRegion functions (renamed from LayoutRegion)
    createCropRegion: (data: CreateCropRegionArgs) =>
      invoke("create-crop-region", data),
    updateCropRegion: (id: string, data: UpdateCropRegionArgs) =>
      invoke("update-crop-region", id, data),
    deleteCropRegion: (id: string) => invoke("delete-crop-region", id),
    getCropRegionsByExamId: (examId: string) =>
      invoke("get-crop-regions-by-exam-id", examId),
    getQuestionAnswerRegionsByExamId: (examId: string) =>
      invoke("get-question-answer-regions-by-exam-id", examId),
    updateCropRegionOrders: (
      updates: Array<{ id: string; orderIndex: number }>
    ) => invoke("update-crop-region-orders", updates),
  }
}
