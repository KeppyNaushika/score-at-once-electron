/**
 * @fileoverview Canvas初期化およびテキストボックス統合フック
 * 画像アスペクト比、テキスト統合のロジックを提供
 */
import { useCallback, useMemo } from "react"

import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  AnnotationTarget,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"

import { loadedPageIndexOfCropRegion } from "../../utils/canvasPageLayout"
import { useTextboxIntegration } from "../text/useTextboxIntegration"

/** Canvas初期化およびテキストボックス統合フックのパラメータ */
interface UseCanvasIntegrationParams {
  /** 読み込み済み画像配列 */
  loadedImages: HTMLImageElement[]
  /** loadedImages と同じ並びの、各画像のページ（ExamPage.id） */
  loadedExamPageIds: string[]
  /** 現在の設問領域（描画要素はこの設問のページに属する） */
  currentCropRegion: QuestionAnswerRegionRow | null | undefined
  /** 注釈の行き先（答案＋設問＋採点者）。置き場所の採点行は保存時に main が用意する */
  annotationTarget: AnnotationTarget | null
  /** 描画要素配列 */
  drawingElements: DrawingAnnotation[]
  /** 描画要素設定関数 */
  setDrawingElements: (
    elements:
      DrawingAnnotation[] | ((prev: DrawingAnnotation[]) => DrawingAnnotation[])
  ) => void
  /** 描画要素追加関数 */
  addDrawingElement: (element: DrawingAnnotation) => void | Promise<void>
  /** 描画要素更新関数 */
  updateDrawingElement: (
    id: string,
    updates: Partial<DrawingAnnotation>
  ) => void | Promise<void>
  /** 現在の採点データ */
  currentScoringData: ScoringData | null
}

/** Canvas初期化およびテキストボックス統合フックの戻り値 */
interface UseCanvasIntegrationReturn {
  /** 現在の設問のページの画像アスペクト比 */
  imageAspectRatio: number
  /** 背景画像URL */
  backgroundImageUrl: string | undefined
  /** テキストボックス統合フックの戻り値 */
  textboxIntegration: ReturnType<typeof useTextboxIntegration>
  /** テキストアンカークリックハンドラー */
  handleTextAnchorClick: (position: { x: number; y: number }) => void
  /** テキスト要素再編集ハンドラー */
  handleTextElementReClick: (element: DrawingAnnotation) => void
}

/**
 * Canvas初期化およびテキストボックス統合フック
 *
 * @description
 * 現在の設問のページの画像アスペクト比の算出、
 * テキストエディタ統合の初期化を行うフック。
 *
 * @param params - フックパラメータ
 * @returns Canvas関連の値とテキストボックス統合
 */
export function useCanvasIntegration({
  loadedImages,
  loadedExamPageIds,
  currentCropRegion,
  annotationTarget,
  drawingElements,
  setDrawingElements,
  addDrawingElement,
  updateDrawingElement,
  currentScoringData,
}: UseCanvasIntegrationParams): UseCanvasIntegrationReturn {
  // 画像アスペクト比（Shift制約で正円/正方形にするため）。
  // 描画要素の座標は現在の設問のページが基準なので、そのページの画像で測る。
  // ページが答案に無い間は描画を止めているので使われない
  const imageAspectRatio = useMemo(() => {
    const pageIndex = loadedPageIndexOfCropRegion(
      currentCropRegion,
      loadedExamPageIds
    )
    if (pageIndex === null) return 1
    const pageImage = loadedImages[pageIndex]
    if (!pageImage?.naturalWidth || !pageImage.naturalHeight) return 1
    return pageImage.naturalWidth / pageImage.naturalHeight
  }, [loadedImages, loadedExamPageIds, currentCropRegion])

  // 答案画像のURL取得（appimg://プロトコルをそのまま使用）
  const backgroundImageUrl = currentScoringData?.imageUrl

  // テキストボックス統合フック
  const textboxIntegration = useTextboxIntegration({
    annotationTarget,
    drawingElements,
    setDrawingElements,
    addDrawingElement,
    updateDrawingElement,
  })

  // テキストアンカークリック処理
  const handleTextAnchorClick = useCallback(
    (position: { x: number; y: number }) => {
      textboxIntegration.openTextboxModal(position)
    },
    [textboxIntegration]
  )

  // テキスト要素の再編集処理
  const handleTextElementReClick = useCallback(
    (element: DrawingAnnotation) => {
      // テキスト編集モーダルを開く
      textboxIntegration.openTextboxModal(
        { x: element.x, y: element.y },
        element.text,
        element.id
      )
      textboxIntegration.setCurrentTextColor(element.color)
    },
    [textboxIntegration]
  )

  return {
    imageAspectRatio,
    backgroundImageUrl,
    textboxIntegration,
    handleTextAnchorClick,
    handleTextElementReClick,
  }
}
