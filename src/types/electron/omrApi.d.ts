/**
 * OMR（光学マーク認識）・OMR Config関連API
 */

import type { ComputedCell } from "../answerSheetBuilder.types"
import type {
  CropRegionOmrConfigWithOptions,
  MarkerDetectionResult,
  OMRBatchProgress,
  OMRCellConfig,
  OMRRecognitionParams,
  OMRSheetResult,
  Point,
} from "../omr.types"

export interface OmrAPI {
  omr: {
    batchRecognize: (args: {
      imagePaths: {
        path: string
        examStudentId?: string
        studentName?: string
      }[]
      cells: ComputedCell[]
      cellConfigs: Record<string, OMRCellConfig>
      expectedCorners: [Point, Point, Point, Point]
      params: OMRRecognitionParams
      pageIndex?: number
    }) => Promise<OMRSheetResult[]>
    detectMasterMarkers: (
      examId: string,
      colorThreshold?: number
    ) => Promise<{
      success: boolean
      // 同定は examPageId。pageNumber は診断メッセージの表示用。
      pages: Array<{
        examPageId: string
        pageNumber: number
        result: MarkerDetectionResult
      }>
      error?: string
    }>
    correctImage: (
      examPageId: string,
      buffer: Uint8Array,
      colorThreshold?: number
    ) => Promise<{
      success: boolean
      correctedBuffer?: Uint8Array
      status: "corrected" | "skipped"
      error?: string
    }>
    onBatchProgress: (
      callback: (progress: OMRBatchProgress) => void
    ) => () => void
  }

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
    }) => Promise<{
      success: boolean
      config?: CropRegionOmrConfigWithOptions
      error?: string
    }>
    delete: (cropRegionId: string) => Promise<{
      success: boolean
      error?: string
    }>
    getByExam: (examId: string) => Promise<{
      success: boolean
      configs?: CropRegionOmrConfigWithOptions[]
      error?: string
    }>
  }
}
