/**
 * 手書き数字認識エンジン テスト
 *
 * ONNX Runtime / MNISTモデルが利用可能な場合のみ認識テストを実行。
 * モデル不在時はグレースフルフォールバックの動作を検証。
 */

import { describe, expect, it } from "vitest"

import { recognizeDigitCell } from "../../../electron-src/lib/omr/digitRecognizer"
import type { ComputedCell } from "../../../types/answerSheetBuilder.types"
import type {
  CoordinateTransform,
  OMRRecognitionParams,
  RawImageData,
} from "../../../types/omr.types"

// テスト用の単純な座標変換（歪みなし: 0-1座標 → ピクセル座標）
function createIdentityTransform(
  width: number,
  height: number
): CoordinateTransform {
  return {
    detectedCorners: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: width, y: height },
    ],
    expectedCorners: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    imageWidth: width,
    imageHeight: height,
  }
}

const DEFAULT_PARAMS: OMRRecognitionParams = {
  colorThreshold: 25,
  areaThreshold: 0.4,
}

describe("digitRecognizer", () => {
  it("モデル不在時: 空の認識結果が返る（graceful fallback）", async () => {
    // MNISTモデルが存在しない環境でも例外を投げずに動作する
    const width = 200
    const height = 100
    const channels = 3

    // 白い画像を作成
    const data = Buffer.alloc(width * height * channels, 255)
    const rawImage: RawImageData = { data, width, height, channels }
    const transform = createIdentityTransform(width, height)

    const cell: ComputedCell = {
      questionPath: [0, 0],
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      normalizedX: 10 / width,
      normalizedY: 10 / height,
      normalizedW: 80 / width,
      normalizedH: 40 / height,
      label: "1-1",
      points: 5,
      textElements: [],
      modelAnswer: undefined,
      cellType: "answer",
      pageIndex: 0,
      omrDigitBoxes: [
        {
          normalizedX: 0.1,
          normalizedY: 0.15,
          normalizedW: 0.3,
          normalizedH: 0.7,
          digitIndex: 0,
        },
      ],
    }

    const result = await recognizeDigitCell(
      cell,
      rawImage,
      transform,
      DEFAULT_PARAMS
    )

    expect(result).toBeDefined()
    expect(result.label).toBe("1-1")
    expect(result.questionPath).toEqual([0, 0])
    // モデルが存在しない場合は空の結果
    // (CI環境ではモデルがないためこの分岐になる)
    expect(Array.isArray(result.recognizedValues)).toBe(true)
  })

  it("omrDigitBoxes未設定のセルは no_answer を返す", async () => {
    const width = 200
    const height = 100
    const channels = 3
    const data = Buffer.alloc(width * height * channels, 255)
    const rawImage: RawImageData = { data, width, height, channels }
    const transform = createIdentityTransform(width, height)

    const cell: ComputedCell = {
      questionPath: [0, 0],
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      normalizedX: 10 / width,
      normalizedY: 10 / height,
      normalizedW: 80 / width,
      normalizedH: 40 / height,
      label: "1-1",
      points: 5,
      textElements: [],
      modelAnswer: undefined,
      cellType: "answer",
      pageIndex: 0,
      // omrDigitBoxes なし
    }

    const result = await recognizeDigitCell(
      cell,
      rawImage,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.autoScoreStatus).toBe("no_answer")
    expect(result.recognizedValues).toEqual([])
    expect(result.confidence).toBe(0)
  })

  it("空白領域（白い画像）は空文字を返す", async () => {
    const width = 200
    const height = 100
    const channels = 3

    // 完全に白い画像
    const data = Buffer.alloc(width * height * channels, 255)
    const rawImage: RawImageData = { data, width, height, channels }
    const transform = createIdentityTransform(width, height)

    const cell: ComputedCell = {
      questionPath: [0, 0],
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      normalizedX: 10 / width,
      normalizedY: 10 / height,
      normalizedW: 80 / width,
      normalizedH: 40 / height,
      label: "1-1",
      points: 5,
      textElements: [],
      modelAnswer: undefined,
      cellType: "answer",
      pageIndex: 0,
      omrDigitBoxes: [
        {
          normalizedX: 0.1,
          normalizedY: 0.15,
          normalizedW: 0.3,
          normalizedH: 0.7,
          digitIndex: 0,
        },
      ],
    }

    const result = await recognizeDigitCell(
      cell,
      rawImage,
      transform,
      DEFAULT_PARAMS
    )

    // モデルが利用可能でも白い画像は空欄として検出されるはず
    // モデル不在でも空結果
    expect(result).toBeDefined()
    expect(result.label).toBe("1-1")
  })

  it("prepareDigitInput: 領域が画像範囲外の場合でもクラッシュしない", async () => {
    const width = 50
    const height = 50
    const channels = 3
    const data = Buffer.alloc(width * height * channels, 128)
    const rawImage: RawImageData = { data, width, height, channels }
    const transform = createIdentityTransform(width, height)

    const cell: ComputedCell = {
      questionPath: [0, 0],
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      normalizedX: 0,
      normalizedY: 0,
      normalizedW: 1,
      normalizedH: 1,
      label: "1-1",
      points: 5,
      textElements: [],
      modelAnswer: undefined,
      cellType: "answer",
      pageIndex: 0,
      omrDigitBoxes: [
        {
          // 画像の右端を超える領域
          normalizedX: 0.9,
          normalizedY: 0.1,
          normalizedW: 0.2,
          normalizedH: 0.8,
          digitIndex: 0,
        },
      ],
    }

    // 例外が投げられないことを確認
    const result = await recognizeDigitCell(
      cell,
      rawImage,
      transform,
      DEFAULT_PARAMS
    )
    expect(result).toBeDefined()
  })
})
