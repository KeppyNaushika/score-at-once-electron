import { ipcRenderer } from "electron"

/** OMR（光学マーク認識）のIPC API（一括認識・マスターマーカー検出・画像補正・OMR設定） */
export function createOmrApi() {
  return {
    // OMR（光学マーク認識）
    omr: {
      batchRecognize: (args: {
        imagePaths: {
          path: string
          examStudentId?: string
          studentName?: string
        }[]
        cells: unknown[]
        cellConfigs: Record<string, unknown>
        expectedCorners: [
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
        ]
        params: { colorThreshold: number; areaThreshold: number }
        pageIndex?: number
      }) => ipcRenderer.invoke("omr:batch-recognize", args),
      detectMasterMarkers: (examId: string, colorThreshold?: number) =>
        ipcRenderer.invoke("omr:detect-master-markers", examId, colorThreshold),
      correctImage: (
        examPageId: string,
        buffer: Uint8Array,
        colorThreshold?: number
      ) =>
        ipcRenderer.invoke(
          "omr:correct-image",
          examPageId,
          buffer,
          colorThreshold
        ),
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
      upsert: (data: {
        cropRegionId: string
        type: "choice"
        numChoices?: number | null
        choiceLayout?: string | null
        colorThreshold?: number | null
        areaThreshold?: number | null
        choiceOptions?: Array<{
          choiceIndex: number
          label: string
          isCorrect: boolean
          shape?: string | null
          normalizedCx?: number | null
          normalizedCy?: number | null
          normalizedWidth?: number | null
          normalizedHeight?: number | null
        }>
      }) => ipcRenderer.invoke("omr-config:upsert", data),
      delete: (cropRegionId: string) =>
        ipcRenderer.invoke("omr-config:delete", cropRegionId),
      getByExam: (examId: string) =>
        ipcRenderer.invoke("omr-config:get-by-exam", examId),
    },
  }
}
