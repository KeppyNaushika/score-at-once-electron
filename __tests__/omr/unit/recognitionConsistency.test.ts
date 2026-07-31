/**
 * main側の認識と renderer側の再評価が一致することの検証
 *
 * 認識は main（markRecognizer）で行い、閾値スライダー操作時の再判定は
 * renderer（reevaluateResults）で行う。両者が別の選択肢を指すと、
 * 画面表示と実際に書き込まれる採点がずれる。
 *
 * 特に「バブル位置が未設定の選択肢が脱落し、配列の位置と choiceIndex が
 * 一致しなくなる」ケースを重点的に確かめる。
 */

import type {
  CropRegionOmrChoiceOption,
  CropRegionOmrConfig,
} from "@prisma/client"
import { describe, expect, it } from "vitest"

import { recognizeCell } from "../../../electron-src/lib/omr/markRecognizer"
import { reevaluateWithThreshold } from "../../../src/components/exams/07-score-at-once/OMRRecognition/utils/reevaluateResults"
import type { ComputedCell } from "../../../src/types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  CoordinateTransform,
  CropRegionOmrConfigWithOptions,
  OMRCellConfig,
  OMRCellResult,
  OMRRecognitionParams,
  OMRSheetResult,
  RawImageData,
} from "../../../src/types/omr.types"

const IMAGE_WIDTH = 400
const IMAGE_HEIGHT = 100
const CROP_REGION_ID = "crop-region-uuid"
const AREA_THRESHOLD = 0.4

const PARAMS: OMRRecognitionParams = {
  colorThreshold: 128,
  areaThreshold: AREA_THRESHOLD,
}

const TRANSFORM: CoordinateTransform = {
  detectedCorners: [
    { x: 0, y: 0 },
    { x: IMAGE_WIDTH, y: 0 },
    { x: 0, y: IMAGE_HEIGHT },
    { x: IMAGE_WIDTH, y: IMAGE_HEIGHT },
  ],
  expectedCorners: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  imageWidth: IMAGE_WIDTH,
  imageHeight: IMAGE_HEIGHT,
}

const LABELS = ["ア", "イ", "ウ", "エ"]

/** 4択のうち指定した choiceIndex だけバブル位置を持つ状態を作る */
function createBubbles(positionedChoiceIndices: number[]): ComputedOMRBubble[] {
  return positionedChoiceIndices.map((choiceIndex) => ({
    normalizedCx: (choiceIndex + 1) / 5,
    normalizedCy: 0.5,
    normalizedWidth: 30 / IMAGE_WIDTH,
    normalizedHeight: 48 / IMAGE_HEIGHT,
    choiceIndex,
    label: LABELS[choiceIndex],
  }))
}

/** 指定バブルを黒く塗った白背景画像を作る */
function createImage(
  bubbles: ComputedOMRBubble[],
  filledChoiceIndices: number[]
): RawImageData {
  const channels = 3
  const data = Buffer.alloc(IMAGE_WIDTH * IMAGE_HEIGHT * channels, 255)

  for (const bubble of bubbles) {
    if (!filledChoiceIndices.includes(bubble.choiceIndex)) continue

    const centerX = bubble.normalizedCx * IMAGE_WIDTH
    const centerY = bubble.normalizedCy * IMAGE_HEIGHT
    const halfWidth = (bubble.normalizedWidth * IMAGE_WIDTH) / 2
    const halfHeight = (bubble.normalizedHeight * IMAGE_HEIGHT) / 2

    for (let py = 0; py < IMAGE_HEIGHT; py++) {
      for (let px = 0; px < IMAGE_WIDTH; px++) {
        const dx = (px - centerX) / halfWidth
        const dy = (py - centerY) / halfHeight
        if (dx * dx + dy * dy > 1) continue
        const pixelIndex = (py * IMAGE_WIDTH + px) * channels
        data[pixelIndex] = 0
        data[pixelIndex + 1] = 0
        data[pixelIndex + 2] = 0
      }
    }
  }

  return { data, width: IMAGE_WIDTH, height: IMAGE_HEIGHT, channels }
}

function createCell(bubbles: ComputedOMRBubble[]): ComputedCell {
  return {
    questionPath: [0, 0],
    x: 0,
    y: 0,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    normalizedX: 0,
    normalizedY: 0,
    normalizedW: 1,
    normalizedH: 1,
    // renderer側は label で omrConfig を引くので cropRegionId を入れる
    label: CROP_REGION_ID,
    points: 5,
    cellType: "answer",
    pageIndex: 0,
    textElements: [],
    omrBubbles: bubbles,
  }
}

/**
 * DB由来のOMR設定を作る
 *
 * @param positionedChoiceIndices バブル位置が設定済みの choiceIndex
 * @param correctChoiceIndices    正解の choiceIndex
 */
function createDbConfig(
  positionedChoiceIndices: number[],
  correctChoiceIndices: number[]
): CropRegionOmrConfigWithOptions {
  const timestamp = new Date("2026-07-26T00:00:00.000Z")

  const choiceOptions: CropRegionOmrChoiceOption[] = LABELS.map(
    (label, choiceIndex) => {
      const isPositioned = positionedChoiceIndices.includes(choiceIndex)
      return {
        id: `option-${choiceIndex}`,
        omrConfigId: "omr-config-uuid",
        choiceIndex,
        label,
        isCorrect: correctChoiceIndices.includes(choiceIndex),
        shape: "ellipse",
        normalizedCx: isPositioned ? (choiceIndex + 1) / 5 : null,
        normalizedCy: isPositioned ? 0.5 : null,
        normalizedWidth: isPositioned ? 30 / IMAGE_WIDTH : null,
        normalizedHeight: isPositioned ? 48 / IMAGE_HEIGHT : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    }
  )

  const config: CropRegionOmrConfig = {
    id: "omr-config-uuid",
    cropRegionId: CROP_REGION_ID,
    type: "choice",
    numChoices: LABELS.length,
    choiceLayout: "horizontal",
    colorThreshold: null,
    areaThreshold: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return { ...config, choiceOptions }
}

/** main側の認識結果を renderer側の再評価に通す */
function reevaluate(
  cellResult: OMRCellResult,
  dbConfig: CropRegionOmrConfigWithOptions
): OMRCellResult {
  const sheetResult: OMRSheetResult = {
    success: true,
    examStudentId: "student-uuid",
    pageIndex: 0,
    markerDetection: {
      success: true,
      markers: [],
      imageWidth: IMAGE_WIDTH,
      imageHeight: IMAGE_HEIGHT,
    },
    cellResults: [cellResult],
  }

  const { updatedSheetResults } = reevaluateWithThreshold({
    sheetResults: [sheetResult],
    omrConfigs: [dbConfig],
    pointsMap: { [CROP_REGION_ID]: 5 },
    areaThreshold: AREA_THRESHOLD,
    confidenceThreshold: 0.7,
    // main 側と同条件で比較するため、濃さによる棄却は双方とも無効にする
    minInkDarkness: null,
  })

  return updatedSheetResults[0].cellResults[0]
}

describe("main側の認識と renderer側の再評価の一致", () => {
  it("全選択肢に位置がある通常のケースで一致する", async () => {
    const positioned = [0, 1, 2, 3]
    const bubbles = createBubbles(positioned)
    const cellConfig: OMRCellConfig = {
      type: "choice",
      numChoices: 4,
      labels: LABELS,
      correctAnswers: [1],
      layout: "horizontal",
    }

    const recognized = await recognizeCell(
      createCell(bubbles),
      cellConfig,
      createImage(bubbles, [1]),
      TRANSFORM,
      PARAMS
    )
    const reevaluated = reevaluate(recognized, createDbConfig(positioned, [1]))

    expect(recognized.autoScoreStatus).toBe("correct")
    expect(reevaluated.recognizedValues).toEqual(recognized.recognizedValues)
    expect(reevaluated.autoScoreStatus).toBe(recognized.autoScoreStatus)
    expect(reevaluated.confidence).toBeCloseTo(recognized.confidence, 10)
  })

  it("位置未設定の選択肢が脱落しても一致する（配列位置≠choiceIndex）", async () => {
    // choiceIndex 0 と 2 は位置未設定 → バブル配列は [1, 3] の2件だけになる
    const positioned = [1, 3]
    const bubbles = createBubbles(positioned)
    const cellConfig: OMRCellConfig = {
      type: "choice",
      numChoices: 4,
      labels: LABELS,
      correctAnswers: [3],
      layout: "horizontal",
    }

    const recognized = await recognizeCell(
      createCell(bubbles),
      cellConfig,
      createImage(bubbles, [3]),
      TRANSFORM,
      PARAMS
    )
    const reevaluated = reevaluate(recognized, createDbConfig(positioned, [3]))

    // 配列位置(1)ではなく choiceIndex(3) の「エ」が認識される
    expect(recognized.recognizedValues).toEqual(["エ"])
    expect(recognized.autoScoreStatus).toBe("correct")
    expect(reevaluated.recognizedValues).toEqual(recognized.recognizedValues)
    expect(reevaluated.autoScoreStatus).toBe(recognized.autoScoreStatus)
    expect(reevaluated.confidence).toBeCloseTo(recognized.confidence, 10)
  })

  it("脱落した選択肢が正解のとき、両者とも incorrect で一致する", async () => {
    const positioned = [1, 3]
    const bubbles = createBubbles(positioned)
    const cellConfig: OMRCellConfig = {
      type: "choice",
      numChoices: 4,
      labels: LABELS,
      correctAnswers: [0],
      layout: "horizontal",
    }

    const recognized = await recognizeCell(
      createCell(bubbles),
      cellConfig,
      createImage(bubbles, [1]),
      TRANSFORM,
      PARAMS
    )
    const reevaluated = reevaluate(recognized, createDbConfig(positioned, [0]))

    expect(recognized.recognizedValues).toEqual(["イ"])
    expect(recognized.autoScoreStatus).toBe("incorrect")
    expect(reevaluated.recognizedValues).toEqual(recognized.recognizedValues)
    expect(reevaluated.autoScoreStatus).toBe(recognized.autoScoreStatus)
  })
})
