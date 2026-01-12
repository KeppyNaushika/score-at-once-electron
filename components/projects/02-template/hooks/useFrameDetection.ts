/**
 * 採点枠検出フック
 */

import { useCallback, useRef, useState } from "react"

import {
  DEFAULT_DETECTION_MODE,
  DEFAULT_DETECTION_SETTINGS,
} from "../constants/detection"
import {
  DetectedRect,
  DetectionMode,
  DetectionSettings,
  DragSelectionResult,
} from "../types"
import { frameDetector } from "../utils/frameDetector"
import {
  findIntersectingRects,
  findSmallestContainingRect,
} from "../utils/rectUtils"

interface UseFrameDetectionProps {
  imageUrl: string | null
}

interface UseFrameDetectionReturn {
  /** 検出された矩形 */
  detectedRects: DetectedRect[]
  /** 検出中フラグ */
  isDetecting: boolean
  /** 検出モード */
  detectionMode: DetectionMode
  /** 検出設定 */
  settings: DetectionSettings
  /** 検出モードを設定 */
  setDetectionMode: (mode: DetectionMode) => void
  /** 検出設定を更新 */
  updateSettings: (partial: Partial<DetectionSettings>) => void
  /** 設定をリセット */
  resetSettings: () => void
  /** 画像全体から一括検出 */
  detectAll: () => Promise<void>
  /** クリック位置の枠を検出 */
  detectAtPoint: (x: number, y: number) => DetectedRect | null
  /** ドラッグ後にスナップする矩形を取得 */
  findSnappedRects: (dragRect: {
    x: number
    y: number
    width: number
    height: number
  }) => DragSelectionResult
  /** 検出結果をクリア */
  clearDetectedRects: () => void
}

/**
 * 採点枠検出フック
 */
export function useFrameDetection({
  imageUrl,
}: UseFrameDetectionProps): UseFrameDetectionReturn {
  const [detectedRects, setDetectedRects] = useState<DetectedRect[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionMode, setDetectionMode] = useState<DetectionMode>(
    DEFAULT_DETECTION_MODE
  )
  const [settings, setSettings] = useState<DetectionSettings>(
    DEFAULT_DETECTION_SETTINGS
  )

  // キャッシュ用（同じ画像・設定で再検出を防ぐ）
  const cacheRef = useRef<{
    imageUrl: string | null
    settings: DetectionSettings
    rects: DetectedRect[]
  } | null>(null)

  /**
   * 検出設定を更新
   */
  const updateSettings = useCallback((partial: Partial<DetectionSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
    // キャッシュを無効化
    cacheRef.current = null
  }, [])

  /**
   * 設定をリセット
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_DETECTION_SETTINGS)
    cacheRef.current = null
  }, [])

  /**
   * 画像全体から一括検出
   */
  const detectAll = useCallback(async () => {
    if (!imageUrl) return

    // キャッシュチェック
    if (
      cacheRef.current &&
      cacheRef.current.imageUrl === imageUrl &&
      JSON.stringify(cacheRef.current.settings) === JSON.stringify(settings)
    ) {
      setDetectedRects(cacheRef.current.rects)
      return
    }

    setIsDetecting(true)

    try {
      const rects = await frameDetector.detectFromUrl(imageUrl, settings)
      setDetectedRects(rects)

      // キャッシュを更新
      cacheRef.current = {
        imageUrl,
        settings: { ...settings },
        rects,
      }
    } catch (error) {
      console.error("Frame detection failed:", error)
      setDetectedRects([])
    } finally {
      setIsDetecting(false)
    }
  }, [imageUrl, settings])

  /**
   * クリック位置の枠を検出
   */
  const detectAtPoint = useCallback(
    (x: number, y: number): DetectedRect | null => {
      return findSmallestContainingRect(x, y, detectedRects)
    },
    [detectedRects]
  )

  /**
   * ドラッグ後にスナップする矩形を取得
   */
  const findSnappedRects = useCallback(
    (dragRect: {
      x: number
      y: number
      width: number
      height: number
    }): DragSelectionResult => {
      return findIntersectingRects(dragRect, detectedRects)
    },
    [detectedRects]
  )

  /**
   * 検出結果をクリア
   */
  const clearDetectedRects = useCallback(() => {
    setDetectedRects([])
    cacheRef.current = null
  }, [])

  return {
    detectedRects,
    isDetecting,
    detectionMode,
    settings,
    setDetectionMode,
    updateSettings,
    resetSettings,
    detectAll,
    detectAtPoint,
    findSnappedRects,
    clearDetectedRects,
  }
}
