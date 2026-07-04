import { useCallback } from "react"

import { DRAWING_TOLERANCES } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import type {
  DrawingElement,
  LineEditMode,
  RectangleEditMode,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

/** 線・矩形要素の編集モード（移動・端点・リサイズ）を座標から判定するユーティリティフック */
export function useEditModeUtils() {
  // 線の編集モード判定（開始点、終了点、移動）- PowerPointスタイル
  const getLineEditMode = useCallback(
    (element: DrawingElement, testX: number, testY: number): LineEditMode => {
      if (
        element.type !== "line" ||
        element.endX === undefined ||
        element.endY === undefined
      ) {
        return null
      }

      const lineTolerance = DRAWING_TOLERANCES.lineDistance

      // 1. 開始点判定（端点を優先）
      const distToStart = Math.sqrt(
        Math.pow(testX - element.x, 2) + Math.pow(testY - element.y, 2)
      )
      if (distToStart < lineTolerance) {
        return "start"
      }

      // 2. 終了点判定（端点を優先）
      const distToEnd = Math.sqrt(
        Math.pow(testX - element.endX, 2) + Math.pow(testY - element.endY, 2)
      )
      if (distToEnd < lineTolerance) {
        return "end"
      }

      // 3. 線分への最短距離を計算（移動モード判定）
      const dx = element.endX - element.x
      const dy = element.endY - element.y
      const lineLength = Math.sqrt(dx * dx + dy * dy)

      // 線の長さが0の場合
      if (lineLength === 0) {
        return distToStart < lineTolerance ? "move" : null
      }

      // 線分上の最近点を求める（0-1の範囲でクランプ）
      const ratio = Math.max(
        0,
        Math.min(
          1,
          ((testX - element.x) * dx + (testY - element.y) * dy) /
            (lineLength * lineLength)
        )
      )

      // 最近点までの距離
      const nearestX = element.x + ratio * dx
      const nearestY = element.y + ratio * dy
      const distToLine = Math.sqrt(
        Math.pow(testX - nearestX, 2) + Math.pow(testY - nearestY, 2)
      )

      if (distToLine < lineTolerance) {
        return "move"
      }

      return null
    },
    []
  )

  // 矩形の編集モード判定（角・辺でのリサイズ、内部での移動）
  const getRectangleEditMode = useCallback(
    (
      element: DrawingElement,
      testX: number,
      testY: number
    ): RectangleEditMode => {
      if (
        element.type !== "rectangle" ||
        element.width === undefined ||
        element.height === undefined
      ) {
        return null
      }

      const tolerance = DRAWING_TOLERANCES.rectangleEdge
      const left = Math.min(element.x, element.x + element.width)
      const right = Math.max(element.x, element.x + element.width)
      const top = Math.min(element.y, element.y + element.height)
      const bottom = Math.max(element.y, element.y + element.height)

      // 角や辺の近くかチェック（リサイズモード）
      const nearLeft = Math.abs(testX - left) < tolerance
      const nearRight = Math.abs(testX - right) < tolerance
      const nearTop = Math.abs(testY - top) < tolerance
      const nearBottom = Math.abs(testY - bottom) < tolerance

      if (
        (nearLeft || nearRight || nearTop || nearBottom) &&
        testX >= left - tolerance &&
        testX <= right + tolerance &&
        testY >= top - tolerance &&
        testY <= bottom + tolerance
      ) {
        return "resize"
      }

      // 内部かチェック（移動モード）
      if (testX > left && testX < right && testY > top && testY < bottom) {
        return "move"
      }

      return null
    },
    []
  )

  return {
    getLineEditMode,
    getRectangleEditMode,
  }
}
