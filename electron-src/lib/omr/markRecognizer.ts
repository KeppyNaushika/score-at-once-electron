/**
 * マーク認識エンジン
 *
 * 選択式（バブル）マークの塗りつぶし認識。
 * 座標変換済みの画像上でバブル位置のピクセルを解析し、
 * 塗りつぶし率からマーク状態を判定する。
 */

import type { ComputedCell } from "../../../src/types/answerSheetLayout.types"
import type {
  CoordinateTransform,
  OMRCellConfig,
  OMRCellResult,
  OMRRecognitionParams,
  RawImageData,
} from "../../../src/types/omr.types"
import { normalizedToPixel } from "./coordinateTransform"
import { recognizeDigitCell } from "./digitRecognizer"
import { computeEllipticalFillRatio } from "./imageProcessor"

/**
 * 1つのセルのマーク認識を実行
 */
export async function recognizeCell(
  cell: ComputedCell,
  omrConfig: OMRCellConfig,
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams
): Promise<OMRCellResult> {
  if (omrConfig.type === "choice") {
    return recognizeChoiceCell(cell, omrConfig, rawImage, transform, params)
  }

  // handwritten-digit: ONNX Runtime による手書き数字認識
  return recognizeDigitCell(cell, rawImage, transform, params)
}

/**
 * 選択式（バブル）セルのマーク認識
 */
function recognizeChoiceCell(
  cell: ComputedCell,
  config: OMRCellConfig & { type: "choice" },
  rawImage: RawImageData,
  transform: CoordinateTransform,
  params: OMRRecognitionParams
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

  const fillRatios: number[] = []
  const markedIndices: number[] = []

  for (const bubble of cell.omrBubbles) {
    // 正規化座標→ピクセル座標
    const center = normalizedToPixel(
      bubble.normalizedCx,
      bubble.normalizedCy,
      transform
    )

    const halfWidthPx = (bubble.normalizedWidth * rawImage.width) / 2
    const halfHeightPx = (bubble.normalizedHeight * rawImage.height) / 2
    const ratio = computeEllipticalFillRatio(
      rawImage,
      center.x,
      center.y,
      halfWidthPx,
      halfHeightPx,
      params.colorThreshold
    )
    fillRatios.push(ratio)

    if (ratio >= params.areaThreshold) {
      markedIndices.push(bubble.choiceIndex)
    }
  }

  // 認識結果を構築
  const recognizedValues = markedIndices.map(
    (idx) => config.labels[idx] ?? String(idx)
  )

  // 信頼度計算
  let confidence: number
  if (markedIndices.length === 0) {
    // 未回答: 全て低い塗りつぶし率なら高信頼
    const maxRatio = Math.max(...fillRatios)
    confidence = 1 - maxRatio / params.areaThreshold
  } else if (markedIndices.length === 1) {
    // 単一回答: マーク済みの塗りつぶし率が高いほど、他との差が大きいほど高信頼
    const markedRatio = fillRatios[markedIndices[0]]
    const otherMaxRatio = Math.max(
      ...fillRatios.filter((_, i) => !markedIndices.includes(i)),
      0
    )
    confidence = Math.min(
      markedRatio / params.areaThreshold,
      1 - otherMaxRatio / params.areaThreshold
    )
    confidence = Math.max(0, Math.min(1, confidence))
  } else {
    // 複数マーク: 信頼度は低い
    confidence = 0.3
  }

  // 自動採点
  let autoScoreStatus: OMRCellResult["autoScoreStatus"]
  if (markedIndices.length === 0) {
    autoScoreStatus = "no_answer"
  } else if (markedIndices.length > config.correctAnswers.length) {
    autoScoreStatus = "ambiguous"
  } else {
    const isCorrect =
      markedIndices.length === config.correctAnswers.length &&
      markedIndices.every((idx) => config.correctAnswers.includes(idx))
    autoScoreStatus = isCorrect ? "correct" : "incorrect"
  }

  return {
    label: cell.label,
    questionPath: cell.questionPath,
    recognizedValues,
    fillRatios,
    confidence,
    autoScoreStatus,
  }
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
  const results: OMRCellResult[] = []

  for (const cell of cells) {
    const configKey = cell.questionPath.join("-")
    const config = cellConfigs[configKey]
    if (!config) continue

    results.push(await recognizeCell(cell, config, rawImage, transform, params))
  }

  return results
}
