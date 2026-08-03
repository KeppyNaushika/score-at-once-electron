/**
 * @fileoverview Canvas初期化およびテキストボックス統合フック
 * キャンバスサイズ計算、アスペクト比、テキスト統合のロジックを提供
 */
import { useCallback, useMemo } from "react"

import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { useTextboxIntegration } from "../text/useTextboxIntegration"

/** Canvas初期化およびテキストボックス統合フックのパラメータ */
interface UseCanvasIntegrationParams {
  /** 読み込み済み画像配列 */
  loadedImages: HTMLImageElement[]
  /** 作成先の採点データ（新規アノテーションの行に載せる） */
  questionScoreId: string | null
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
  /** Canvas幅 */
  canvasWidth: number
  /** Canvas高さ */
  canvasHeight: number
  /** 画像アスペクト比 */
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
 * キャンバスのサイズ計算、画像アスペクト比の算出、
 * テキストエディタ統合の初期化を行うフック。
 *
 * @param params - フックパラメータ
 * @returns Canvas関連の値とテキストボックス統合
 */
export function useCanvasIntegration({
  loadedImages,
  questionScoreId,
  drawingElements,
  setDrawingElements,
  addDrawingElement,
  updateDrawingElement,
  currentScoringData,
}: UseCanvasIntegrationParams): UseCanvasIntegrationReturn {
  // Canvas幅・高さ（画像サイズが確定してから初期化）
  const canvasWidth = loadedImages.length > 0 ? loadedImages[0].width : 800
  const canvasHeight = loadedImages.length > 0 ? loadedImages[0].height : 600

  // 画像アスペクト比（Shift制約で正円/正方形にするため）
  const imageAspectRatio = useMemo(() => {
    if (loadedImages.length > 0) {
      const image = loadedImages[0]
      return image.naturalWidth / image.naturalHeight
    }
    return 1
  }, [loadedImages])

  // 答案画像のURL取得（appimg://プロトコルをそのまま使用）
  const backgroundImageUrl = currentScoringData?.imageUrl

  // テキストボックス統合フック
  const textboxIntegration = useTextboxIntegration({
    questionScoreId,
    drawingElements,
    updateDrawingElements: setDrawingElements,
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
    canvasWidth,
    canvasHeight,
    imageAspectRatio,
    backgroundImageUrl,
    textboxIntegration,
    handleTextAnchorClick,
    handleTextElementReClick,
  }
}
