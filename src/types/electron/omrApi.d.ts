/**
 * OMR（光学マーク認識）・OMR Config関連API
 */
export interface OmrAPI {
  omr: {
    detectMarkers: (
      imagePath: string,
      colorThreshold?: number
    ) => Promise<import("../omr.types").MarkerDetectionResult>
    recognizeSheet: (args: {
      imagePath: string
      cells: import("../answerSheetBuilder.types").ComputedCell[]
      cellConfigs: Record<string, import("../omr.types").OMRCellConfig>
      expectedCorners: [
        import("../omr.types").Point,
        import("../omr.types").Point,
        import("../omr.types").Point,
        import("../omr.types").Point,
      ]
      params: import("../omr.types").OMRRecognitionParams
      pageIndex?: number
      studentId?: string
    }) => Promise<import("../omr.types").OMRSheetResult>
    batchRecognize: (args: {
      imagePaths: { path: string; studentId?: string; studentName?: string }[]
      cells: import("../answerSheetBuilder.types").ComputedCell[]
      cellConfigs: Record<string, import("../omr.types").OMRCellConfig>
      expectedCorners: [
        import("../omr.types").Point,
        import("../omr.types").Point,
        import("../omr.types").Point,
        import("../omr.types").Point,
      ]
      params: import("../omr.types").OMRRecognitionParams
      pageIndex?: number
    }) => Promise<import("../omr.types").OMRSheetResult[]>
    detectMasterMarkers: (
      examId: string,
      colorThreshold?: number
    ) => Promise<{
      success: boolean
      pages: Array<{
        pageNumber: number
        result: import("../omr.types").MarkerDetectionResult
      }>
      error?: string
    }>
    onBatchProgress: (
      callback: (progress: import("../omr.types").OMRBatchProgress) => void
    ) => () => void
  }

  omrConfig: {
    upsert: (data: {
      cropRegionId: string
      type: "choice" | "handwritten-digit"
      numChoices?: number | null
      choiceLayout?: string | null
      numDigits?: number | null
      correctAnswer?: string | null
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
      digitBoxes?: Array<{
        digitIndex: number
        normalizedX: number
        normalizedY: number
        normalizedW: number
        normalizedH: number
      }>
    }) => Promise<{
      success: boolean
      config?: import("../omr.types").CropRegionOmrConfigWithOptions
      error?: string
    }>
    delete: (cropRegionId: string) => Promise<{
      success: boolean
      error?: string
    }>
    getByExam: (examId: string) => Promise<{
      success: boolean
      configs?: import("../omr.types").CropRegionOmrConfigWithOptions[]
      error?: string
    }>
  }
}
