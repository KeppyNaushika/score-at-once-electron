import { ipcRenderer } from "electron"

import { bind } from "./invoke"

/** OMR（光学マーク認識）のIPC API（一括認識・マスターマーカー検出・画像補正・OMR設定） */
export function createOmrApi() {
  return {
    // OMR（光学マーク認識）
    omr: {
      batchRecognize: bind("omr:batch-recognize"),
      detectMasterMarkers: bind("omr:detect-master-markers"),
      correctImage: bind("omr:correct-image"),
      onBatchProgress: (
        callback: (progress: {
          total: number
          processed: number
          succeeded: number
          failed: number
          currentStudentName?: string
        }) => void
      ) => {
        ipcRenderer.on("omr:batch-progress", (_event, progress) =>
          callback(progress)
        )
        return () => {
          ipcRenderer.removeAllListeners("omr:batch-progress")
        }
      },
    },

    // OMR Config（CropRegion OMR設定）
    omrConfig: {
      upsert: bind("omr-config:upsert"),
      delete: bind("omr-config:delete"),
      getByExam: bind("omr-config:get-by-exam"),
    },
  }
}
