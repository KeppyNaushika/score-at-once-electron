/**
 * 採点枠検出フック
 *
 * 検出はバックグラウンド（Worker）で走り、利用者の操作を待たせない。
 * 新しい検出を始めたとき・取り消したときは、走っている検出を止めて結果を捨てる。
 * ページを素早く切り替えても、前のページの結果が今のページに出ることはない。
 */

import { useCallback, useRef, useState } from "react"

import {
  DEFAULT_DETECTION_MODE,
  DEFAULT_DETECTION_SETTINGS,
} from "../constants/detection"
import type {
  DetectedRect,
  DetectionMode,
  DetectionSettings,
  DragSelectionResult,
} from "../types"
import { frameDetector } from "../utils/frameDetector"
import { findIntersectingRects } from "../utils/rectUtils"

interface UseFrameDetectionProps {
  imageUrl: string | null
  /** ページの用紙サイズ名（"A4"等）。mm の設定を画素に換算するのに使う */
  pageSize: string | null
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
  /** 走っている検出を取り消す（結果は捨てる） */
  cancelDetection: () => void
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
  pageSize,
}: UseFrameDetectionProps): UseFrameDetectionReturn {
  const [detectedRects, setDetectedRects] = useState<DetectedRect[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionMode, setDetectionMode] = useState<DetectionMode>(
    DEFAULT_DETECTION_MODE
  )
  const [settings, setSettings] = useState<DetectionSettings>(
    DEFAULT_DETECTION_SETTINGS
  )

  // 検出結果の控え（画像と設定の組ごと）。ページを行き来しても再検出しない
  const rectsCacheRef = useRef(new Map<string, DetectedRect[]>())
  // 走っている検出の取り消し口。次の検出・取り消しで abort する
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 検出設定を更新
   */
  const updateSettings = useCallback((partial: Partial<DetectionSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  /**
   * 設定をリセット
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_DETECTION_SETTINGS)
  }, [])

  /**
   * 走っている検出を取り消す
   */
  const cancelDetection = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsDetecting(false)
  }, [])

  /**
   * 画像全体から一括検出
   */
  const detectAll = useCallback(async () => {
    if (!imageUrl || !pageSize) return

    // 前の検出（別のページ・前の設定）はもう要らない
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    const cacheKey = `${imageUrl}\n${pageSize}\n${JSON.stringify(settings)}`
    const cachedRects = rectsCacheRef.current.get(cacheKey)
    if (cachedRects) {
      setIsDetecting(false)
      setDetectedRects(cachedRects)
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setIsDetecting(true)

    try {
      const rects = await frameDetector.detectFromUrl(
        imageUrl,
        settings,
        pageSize,
        abortController.signal
      )
      rectsCacheRef.current.set(cacheKey, rects)
      // 待っている間に取り消された（ページを切り替えた等）なら、今の画面には出さない
      if (abortController.signal.aborted) return
      setDetectedRects(rects)
    } catch (error) {
      if (abortController.signal.aborted) return
      console.error("Frame detection failed:", error)
      setDetectedRects([])
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
        setIsDetecting(false)
      }
    }
  }, [imageUrl, pageSize, settings])

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
   * 検出結果をクリア（控えは残す。同じページへ戻ったときにすぐ出せるように）
   */
  const clearDetectedRects = useCallback(() => {
    setDetectedRects([])
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
    cancelDetection,
    findSnappedRects,
    clearDetectedRects,
  }
}
