/**
 * マーク認識エンジン
 *
 * 選択式（バブル）マークの塗りつぶし認識。
 * 座標変換済みの画像上でバブル位置のピクセルを解析し、
 * 塗りつぶし率からマーク状態を判定する。
 */

import { evaluateChoiceBubbles } from "../../../src/lib/omr/choiceEvaluation"
import {
  computeOtsuFromHistogram,
  type OtsuOptions,
} from "../../../src/lib/omr/otsuThreshold"
import type { ComputedCell } from "../../../src/types/answerSheetLayout.types"
import type {
  BubbleMeasurement,
  ComputedOMRBubble,
  CoordinateTransform,
  OMRCellConfig,
  OMRCellResult,
  OMRRecognitionParams,
  RawImageData,
} from "../../../src/types/omr.types"
import { normalizedToPixel } from "./coordinateTransform"
import { recognizeDigitCell } from "./digitRecognizer"
import {
  accumulateEllipticalLuminanceHistogram,
  computeEllipticalFillRatio,
} from "./imageProcessor"

/** 大津法が使えないときに使う既定の暗さ閾値 */
export const DEFAULT_COLOR_THRESHOLD = 128

/** 輝度ヒストグラムのビン設定（8bitグレースケール） */
const LUMINANCE_OPTIONS: OtsuOptions = { min: 0, max: 256, bins: 256 }

/**
 * 自動決定を採用する最小の輝度差（0-255）
 *
 * 鉛筆と紙はこれ以上離れる。白紙だけの答案では2群が接近するので固定値へ退く。
 */
const MIN_LUMINANCE_SEPARATION = 60

/**
 * 1つのセルのマーク認識を実行
 *
 * @param colorThreshold 解決済みの暗さ閾値。省略時はこのセル単独で自動算出する
 */
export async function recognizeCell(
  cell: ComputedCell,
  omrConfig: OMRCellConfig,
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams,
  colorThreshold?: number
): Promise<OMRCellResult> {
  const resolvedColorThreshold =
    colorThreshold ?? resolveColorThreshold([cell], rawImage, transform, params)

  if (omrConfig.type === "choice") {
    return recognizeChoiceCell(
      cell,
      omrConfig,
      rawImage,
      transform,
      params,
      resolvedColorThreshold
    )
  }

  // handwritten-digit: ONNX Runtime による手書き数字認識
  return recognizeDigitCell(cell, rawImage, transform, resolvedColorThreshold)
}

/**
 * 暗さ閾値を解決する
 *
 * params.colorThreshold が指定されていればそれを使う（ユーザーの明示的な上書き）。
 * null の場合はバブル領域の輝度分布から大津法で自動算出し、
 * 2群の輝度差が小さいとき（＝白紙に近く分けても意味がないとき）は既定値へ退く。
 *
 * 母集団を画像全体ではなくバブル領域に限るのは、余白が支配的な答案画像では
 * 全体ヒストグラムが単峰になり大津法が破綻するため。
 */
function resolveColorThreshold(
  cells: ComputedCell[],
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams
): number {
  if (params.colorThreshold != null) return params.colorThreshold

  const histogram = new Array<number>(LUMINANCE_OPTIONS.bins).fill(0)
  for (const cell of cells) {
    for (const bubble of cell.omrBubbles ?? []) {
      const center = normalizedToPixel(
        bubble.normalizedCx,
        bubble.normalizedCy,
        transform
      )
      accumulateEllipticalLuminanceHistogram(
        rawImage,
        center.x,
        center.y,
        (bubble.normalizedWidth * rawImage.width) / 2,
        (bubble.normalizedHeight * rawImage.height) / 2,
        histogram
      )
    }
  }

  const otsu = computeOtsuFromHistogram(histogram, LUMINANCE_OPTIONS)
  if (otsu === null || otsu.meanDistance < MIN_LUMINANCE_SEPARATION) {
    return DEFAULT_COLOR_THRESHOLD
  }

  return otsu.threshold
}

/**
 * 選択式（バブル）セルのマーク認識
 */
function recognizeChoiceCell(
  cell: ComputedCell,
  config: OMRCellConfig & { type: "choice" },
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams,
  colorThreshold: number
): OMRCellResult {
  if (!cell.omrBubbles || cell.omrBubbles.length === 0) {
    return {
      label: cell.label,
      questionPath: cell.questionPath,
      recognizedValues: [],
      confidence: 0,
      autoScoreStatus: "no_answer",
    }
  }

  const bubbleMeasurements: BubbleMeasurement[] = cell.omrBubbles.map(
    (bubble) => ({
      choiceIndex: bubble.choiceIndex,
      label: bubble.label,
      fillRatio: measureBubbleFillRatio(
        bubble,
        rawImage,
        transform,
        colorThreshold
      ),
    })
  )

  const evaluation = evaluateChoiceBubbles({
    bubbleMeasurements,
    correctChoiceIndices: config.correctAnswers,
    areaThreshold: params.areaThreshold,
  })

  return {
    label: cell.label,
    questionPath: cell.questionPath,
    recognizedValues: evaluation.recognizedValues,
    bubbleMeasurements,
    confidence: evaluation.confidence,
    autoScoreStatus: evaluation.autoScoreStatus,
  }
}

/** バブル1つの塗りつぶし率を測定する */
function measureBubbleFillRatio(
  bubble: ComputedOMRBubble,
  rawImage: RawImageData,
  transform: CoordinateTransform,
  colorThreshold: number
): number {
  // 正規化座標→ピクセル座標
  const center = normalizedToPixel(
    bubble.normalizedCx,
    bubble.normalizedCy,
    transform
  )

  return computeEllipticalFillRatio(
    rawImage,
    center.x,
    center.y,
    (bubble.normalizedWidth * rawImage.width) / 2,
    (bubble.normalizedHeight * rawImage.height) / 2,
    colorThreshold
  )
}

/**
 * 複数セルのマーク認識をバッチ実行
 */
export async function recognizeCells(
  cells: ComputedCell[],
  cellConfigs: Record<string, OMRCellConfig>,
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams
): Promise<OMRCellResult[]> {
  // 暗さ閾値は1枚の答案全体で1つ。セルごとに振れると同一答案内で基準が変わる
  const colorThreshold = resolveColorThreshold(
    cells,
    rawImage,
    transform,
    params
  )

  const results: OMRCellResult[] = []

  for (const cell of cells) {
    const config = cellConfigs[cell.label]
    if (!config) continue

    results.push(
      await recognizeCell(
        cell,
        config,
        rawImage,
        transform,
        params,
        colorThreshold
      )
    )
  }

  return results
}
