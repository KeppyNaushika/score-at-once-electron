import { ipcRenderer } from "electron"

export function createOmrApi() {
  return {
    // OMR（光学マーク認識）
    omr: {
      detectMarkers: (imagePath: string, colorThreshold?: number) =>
        ipcRenderer.invoke("omr:detect-markers", imagePath, colorThreshold),
      recognizeSheet: (args: {
        imagePath: string
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
        studentId?: string
      }) => ipcRenderer.invoke("omr:recognize-sheet", args),
      batchRecognize: (args: {
        imagePaths: {
          path: string
          studentId?: string
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
        type: "choice" | "handwritten-digit"
        numChoices?: number | null
        choiceLayout?: string | null
        numDigits?: number | null
        correctAnswer?: string | null
        cellGeometryJson?: string | null
        colorThreshold?: number | null
        areaThreshold?: number | null
        choiceOptions?: Array<{
          choiceIndex: number
          label: string
          isCorrect: boolean
        }>
      }) => ipcRenderer.invoke("omr-config:upsert", data),
      delete: (cropRegionId: string) =>
        ipcRenderer.invoke("omr-config:delete", cropRegionId),
      getByExam: (examId: string) =>
        ipcRenderer.invoke("omr-config:get-by-exam", examId),
    },
  }
}
