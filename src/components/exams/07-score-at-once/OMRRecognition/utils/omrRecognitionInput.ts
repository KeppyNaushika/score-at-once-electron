/**
 * OMR一括認識に渡す材料を、DBのOMR設定・採点領域・マーカー検出結果から組み立てる
 */
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { ComputedCell } from "@/types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  CropRegionOmrConfigWithOptions,
  DetectedCornerMarker,
  MarkerDetectionResult,
  OMRCellConfig,
} from "@/types/omr.types"

type NormalizedPoint = { x: number; y: number }

/** 四隅の並び（TL, TR, BL, BR の順に揃える） */
const CORNER_ORDER: Record<DetectedCornerMarker["corner"], number> = {
  TL: 0,
  TR: 1,
  BL: 2,
  BR: 3,
}

/** OMR設定（選択式のもの）から、採点領域ごとの認識設定を作る */
export function buildCellConfigs(
  configs: CropRegionOmrConfigWithOptions[]
): Record<string, OMRCellConfig> {
  const cellConfigs: Record<string, OMRCellConfig> = {}
  for (const omrConfig of configs) {
    if (omrConfig.type === "choice") {
      const labels = omrConfig.choiceOptions.map((option) => option.label)
      const correctAnswers = omrConfig.choiceOptions
        .filter((option) => option.isCorrect)
        .map((option) => option.choiceIndex)
      cellConfigs[omrConfig.cropRegionId] = {
        type: "choice",
        numChoices: omrConfig.numChoices ?? labels.length,
        labels,
        correctAnswers,
        layout:
          (omrConfig.choiceLayout as "horizontal" | "vertical") ?? "horizontal",
      }
    }
  }
  return cellConfigs
}

/** 模範解答で検出したマーカーの中心を、0-1正規化座標の四隅（TL, TR, BL, BR）にする */
export function expectedCornersOf(
  markerDetection: MarkerDetectionResult
): [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint] {
  return markerDetection.markers
    .sort(
      (markerA, markerB) =>
        CORNER_ORDER[markerA.corner] - CORNER_ORDER[markerB.corner]
    )
    .map((marker) => ({
      x: marker.centerX / markerDetection.imageWidth,
      y: marker.centerY / markerDetection.imageHeight,
    })) as [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint]
}

/** 配点マップ（cropRegionId → points。配点の無い領域は載せない） */
export function pointsMapOf(
  regions: CropRegionWithSubtotals[]
): Record<string, number> {
  const pointsMap: Record<string, number> = {}
  for (const region of regions) {
    if (region.points != null) {
      pointsMap[region.id] = region.points
    }
  }
  return pointsMap
}

/**
 * CropRegion座標 + OMR設定からComputedCellを構築
 * DBの正規化座標（0-1）を直接使用し、バブル/数字欄の位置を計算する
 */
export function buildCellsFromRegions(
  regions: CropRegionWithSubtotals[],
  configs: CropRegionOmrConfigWithOptions[],
  cellConfigs: Record<string, OMRCellConfig>
): ComputedCell[] {
  const cells: ComputedCell[] = []

  for (const omrConfig of configs) {
    const region = regions.find(
      (candidateRegion) => candidateRegion.id === omrConfig.cropRegionId
    )
    if (!region) continue

    const config = cellConfigs[omrConfig.cropRegionId]
    if (!config) continue

    const cell: ComputedCell = {
      questionPath: [],
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      normalizedX: region.x,
      normalizedY: region.y,
      normalizedW: region.width,
      normalizedH: region.height,
      label: omrConfig.cropRegionId,
      points: region.points ?? 0,
      cellType: "answer",
      pageIndex: 0,
      textElements: [],
    }

    if (config.type === "choice") {
      // DB保存済みバブル位置を優先、なければ推定計算にフォールバック
      const hasSavedPositions = omrConfig.choiceOptions.some(
        (option) => option.normalizedCx != null
      )
      if (hasSavedPositions) {
        cell.omrBubbles = omrConfig.choiceOptions
          .filter((option) => option.normalizedCx != null)
          .map((option) => ({
            normalizedCx: option.normalizedCx!,
            normalizedCy: option.normalizedCy!,
            normalizedWidth: option.normalizedWidth!,
            normalizedHeight: option.normalizedHeight!,
            choiceIndex: option.choiceIndex,
            label: option.label,
            isCorrectAnswer: option.isCorrect,
          }))
      } else {
        cell.omrBubbles = computeBubblesFromRegion(region, config)
      }
    }

    cells.push(cell)
  }

  return cells
}

/** CropRegionの正規化座標内にバブル位置を等間隔配置 */
function computeBubblesFromRegion(
  region: CropRegionWithSubtotals,
  config: OMRCellConfig & { type: "choice" }
): ComputedOMRBubble[] {
  const numChoices = config.numChoices
  const bubbles: ComputedOMRBubble[] = []

  // バブルサイズ: 間隔の60%幅、高さは領域高さの70%（実際の印刷バブルに近似）
  const spacing =
    config.layout === "horizontal"
      ? region.width / (numChoices + 1)
      : region.height / (numChoices + 1)
  const bubbleW = spacing * 0.6
  const bubbleH = Math.min(bubbleW * 1.6, region.height * 0.7)

  if (config.layout === "horizontal") {
    const spacing = region.width / (numChoices + 1)
    const cy = region.y + region.height / 2
    for (let i = 0; i < numChoices; i++) {
      bubbles.push({
        normalizedCx: region.x + spacing * (i + 1),
        normalizedCy: cy,
        normalizedWidth: bubbleW,
        normalizedHeight: bubbleH,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
        isCorrectAnswer: config.correctAnswers.includes(i),
      })
    }
  } else {
    const spacing = region.height / (numChoices + 1)
    const cx = region.x + region.width / 2
    for (let i = 0; i < numChoices; i++) {
      bubbles.push({
        normalizedCx: cx,
        normalizedCy: region.y + spacing * (i + 1),
        normalizedWidth: bubbleW,
        normalizedHeight: bubbleH,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
        isCorrectAnswer: config.correctAnswers.includes(i),
      })
    }
  }

  return bubbles
}
