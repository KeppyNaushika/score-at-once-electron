/**
 * @fileoverview Canvas初期化およびV4統合フック
 * キャンバスサイズ計算、アスペクト比、V4テキスト統合のロジックを提供
 */
import type { ScoringData } from "@/components/projects/07-score-at-once/types"
import { useCallback, useMemo } from "react"
import type { DrawingElement } from "../../types/answerIndividualTypes"
import { useTextboxV4Integration } from "../text/useTextboxIntegration"

/** Canvas初期化およびV4統合フックのパラメータ */
export interface UseCanvasV4IntegrationParams {
  /** 読み込み済み画像配列 */
  loadedImages: HTMLImageElement[]
  /** 描画要素配列 */
  drawingElements: DrawingElement[]
  /** 描画要素設定関数 */
  setDrawingElements: (
    elements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])
  ) => void
  /** 描画要素追加関数 */
  addDrawingElement: (element: DrawingElement) => void | Promise<void>
  /** 描画要素更新関数 */
  updateDrawingElement: (
    id: string,
    updates: Partial<DrawingElement>
  ) => void | Promise<void>
  /** 現在の採点データ */
  currentScoringData: ScoringData | null
}

/** Canvas初期化およびV4統合フックの戻り値 */
export interface UseCanvasV4IntegrationReturn {
  /** Canvas幅 */
  canvasWidth: number
  /** Canvas高さ */
  canvasHeight: number
  /** 画像アスペクト比 */
  imageAspectRatio: number
  /** 背景画像URL */
  backgroundImageUrl: string | undefined
  /** V4統合フックの戻り値 */
  v4Integration: ReturnType<typeof useTextboxV4Integration>
  /** テキストアンカークリックハンドラー */
  handleTextAnchorClick: (position: { x: number; y: number }) => void
  /** テキスト要素再編集ハンドラー */
  handleTextElementReClick: (element: {
    x: number
    y: number
    text?: string
    id: string
    color?: string
  }) => void
}

/**
 * Canvas初期化およびV4統合フック
 *
 * @description
 * キャンバスのサイズ計算、画像アスペクト比の算出、
 * V4テキストエディタ統合の初期化を行うフック。
 *
 * @param params - フックパラメータ
 * @returns Canvas関連の値とV4統合
 */
export function useCanvasV4Integration({
  loadedImages,
  drawingElements,
  setDrawingElements,
  addDrawingElement,
  updateDrawingElement,
  currentScoringData,
}: UseCanvasV4IntegrationParams): UseCanvasV4IntegrationReturn {
  // V4統合: 常にV4モードを使用
  const useV4Mode = true

  // Canvas幅・高さ（画像サイズが確定してから初期化）
  const canvasWidth = loadedImages.length > 0 ? loadedImages[0].width : 800
  const canvasHeight = loadedImages.length > 0 ? loadedImages[0].height : 600

  // 画像アスペクト比（Shift制約で正円/正方形にするため）
  const imageAspectRatio = useMemo(() => {
    if (loadedImages.length > 0) {
      const img = loadedImages[0]
      return img.naturalWidth / img.naturalHeight
    }
    return 1
  }, [loadedImages])

  // 答案画像のURL取得（appimg://プロトコルをそのまま使用）
  const backgroundImageUrl = currentScoringData?.imageUrl

  // V4統合フック
  const v4Integration = useTextboxV4Integration({
    canvasWidth,
    canvasHeight,
    drawingElements,
    updateDrawingElements: setDrawingElements,
    addDrawingElement,
    updateDrawingElement,
  })

  // V4統合: テキストアンカークリック処理
  const handleTextAnchorClick = useCallback(
    (position: { x: number; y: number }) => {
      if (useV4Mode) {
        // V4統合モード: V4統合モーダルを開く
        v4Integration.openV4Modal(position)
      } else {
        // レガシーモード: 古いモーダルを開く（既存のロジック維持）
        // 注：この部分は将来的に削除予定
        console.warn(
          "レガシーテキストモードは非推奨です。V4統合モードをご利用ください。"
        )
      }
    },
    [useV4Mode, v4Integration]
  )

  // V4統合: テキスト要素の再編集処理
  const handleTextElementReClick = useCallback(
    (element: {
      x: number
      y: number
      text?: string
      id: string
      color?: string
    }) => {
      // V4統合モード: V4統合モーダルを開く
      v4Integration.openV4Modal(
        { x: element.x, y: element.y },
        element.text || "",
        element.id
      )
      v4Integration.setCurrentTextColor(element.color || "#000000")
    },
    [v4Integration]
  )

  return {
    canvasWidth,
    canvasHeight,
    imageAspectRatio,
    backgroundImageUrl,
    v4Integration,
    handleTextAnchorClick,
    handleTextElementReClick,
  }
}
