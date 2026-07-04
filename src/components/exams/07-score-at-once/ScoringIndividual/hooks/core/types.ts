/**
 * useImageCanvas関連の型定義
 */
import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"
import type {
  CropRegionWithExamPage,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { ScoringMarkConfig } from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"
import type { DrawingAnnotationWithQuestionScore } from "@/types/drawingAnnotation.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 採点領域と採点ステータスのペア（全設問マーク描画用）
 */
export interface CropRegionWithStatus {
  cropRegion: CropRegionWithExamPage
  status: ScoringStatus
  actualScore: number | null
}

/**
 * useImageCanvasのプロパティ
 */
export interface UseImageCanvasProps {
  currentScoringData: ScoringData | null
  currentCropRegion?: CropRegionWithExamPage | null
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  zoom: number
  position: { x: number; y: number }
  drawingElements: DrawingElement[]
  currentDrawing: Partial<DrawingElement> | null
  isDrawing: boolean
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  isShiftPressed: boolean
  selectedElementIds: string[]
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  showMultiplePages?: boolean
  pageSpacing?: number
  // ドラッグ中の軽量化用
  isDraggingElement?: boolean
  // 透明度制御用の全アノテーション
  allAnnotations?: DrawingAnnotationWithQuestionScore[]
  currentCropRegionId?: string | null
  // ホバー中の要素ID（ハンドル表示用）
  hoveredElementId?: string | null
  // 全設問の採点ステータス（全設問マーク描画用）
  allCropRegionsWithStatus?: CropRegionWithStatus[]
  // 印字設定（採点マーク・点数表示のプレビュー用）
  scoringMarkConfig?: ScoringMarkConfig | null
  // 模範解答の用紙サイズ（mm→px変換基準）
  pageSize?: string
}

/**
 * useImageCanvasの戻り値
 */
export interface UseImageCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>
  textCanvasRef: React.RefObject<HTMLCanvasElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  imageLoaded: boolean
  loadedImages: HTMLImageElement[]
  textBoundsCache: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >
}

/**
 * キャンバス参照の型
 */
export interface CanvasRefs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>
  textCanvasRef: React.RefObject<HTMLCanvasElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  textBoundsCacheRef: React.MutableRefObject<
    Map<string, { x: number; y: number; width: number; height: number }>
  >
  scoringMarkImagesRef: React.MutableRefObject<Map<string, HTMLImageElement>>
}

/**
 * 画像ローダーの戻り値
 */
export interface ImageLoaderReturn {
  imageLoaded: boolean
  loadedImages: HTMLImageElement[]
}

/**
 * テキスト境界キャッシュのアイテム
 */
export interface TextBoundsCacheItem {
  x: number
  y: number
  width: number
  height: number
}
