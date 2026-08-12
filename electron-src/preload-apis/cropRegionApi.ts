import { bind } from "./invoke"

/** 採点領域（CropRegion）のIPC API（CRUD・並び順更新） */
export function createCropRegionApi() {
  return {
    // CropRegion functions (renamed from LayoutRegion)
    createCropRegion: bind("create-crop-region"),
    updateCropRegion: bind("update-crop-region"),
    deleteCropRegion: bind("delete-crop-region"),
    getCropRegionsByExamId: bind("get-crop-regions-by-exam-id"),
    getQuestionAnswerRegionsByExamId: bind(
      "get-question-answer-regions-by-exam-id"
    ),
    updateCropRegionOrders: bind("update-crop-region-orders"),
  }
}
