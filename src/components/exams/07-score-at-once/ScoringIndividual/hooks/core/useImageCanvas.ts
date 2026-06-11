/**
 * 画像キャンバス統合フック
 *
 * 複数の専門フックを統合し、既存インターフェースを維持する統合フック。
 * 内部で以下のフックを使用:
 * - useCanvasRefs: キャンバス参照管理
 * - useImageLoader: 画像読み込み・キャッシュ管理
 * - useScoringMarks: 採点記号画像管理
 * - useCanvasDrawing: Canvas描画ロジック統合
 */
import type { UseImageCanvasProps, UseImageCanvasReturn } from "./types"
import { useCanvasDrawing } from "./useCanvasDrawing"
import { useCanvasRefs } from "./useCanvasRefs"
import { useImageLoader } from "./useImageLoader"
import { useScoringMarks } from "./useScoringMarks"

/**
 * 画像キャンバスの統合フック
 *
 * @param props - フックのプロパティ
 * @returns キャンバス参照と状態を含むオブジェクト
 */
export function useImageCanvas({
  currentScoringData,
  currentCropRegion,
  studentAnswerImages,
  zoom,
  drawingElements,
  isDrawing,
  selectedElementIds,
  isDrawingSelection,
  selectionRectangle,
  showMultiplePages,
  pageSpacing,
  isDraggingElement,
  allAnnotations = [],
  currentCropRegionId,
  hoveredElementId,
  allCropRegionsWithStatus = [],
  scoringMarkConfig,
  pageSize = "A4",
}: UseImageCanvasProps): UseImageCanvasReturn {
  // キャンバス参照管理
  const {
    canvasRef,
    overlayCanvasRef,
    textCanvasRef,
    imageRef,
    containerRef,
    textBoundsCacheRef,
    scoringMarkImagesRef,
  } = useCanvasRefs()

  // 画像読み込み
  const { imageLoaded, loadedImages } = useImageLoader({
    currentScoringData,
    studentAnswerImages,
    showMultiplePages,
    imageRef,
  })

  // 採点記号画像のプリロード
  useScoringMarks({
    scoringMarkImagesRef,
  })

  // Canvas描画ロジック
  useCanvasDrawing({
    canvasRef,
    overlayCanvasRef,
    textCanvasRef,
    containerRef,
    textBoundsCacheRef,
    scoringMarkImagesRef,
    imageLoaded,
    loadedImages,
    currentScoringData,
    currentCropRegion,
    zoom,
    drawingElements,
    selectedElementIds,
    isDrawing,
    isDrawingSelection,
    selectionRectangle,
    pageSpacing,
    isDraggingElement,
    allAnnotations,
    currentCropRegionId,
    hoveredElementId,
    allCropRegionsWithStatus,
    scoringMarkConfig,
    pageSize,
  })

  return {
    canvasRef,
    overlayCanvasRef,
    textCanvasRef,
    imageRef,
    containerRef,
    imageLoaded,
    loadedImages,
    textBoundsCache: textBoundsCacheRef.current,
  }
}
