/**
 * マーク認識エンジン テスト
 *
 * 楕円形バブルの塗りつぶし判定→選択肢認識→自動採点の
 * パイプラインをテスト画像で検証する。
 *
 * 理想的なケースに加え、実際のスキャンで発生するリアルなケースも検証:
 * - 鉛筆の濃淡（薄塗り・しっかり塗り）
 * - 消しゴム跡（消し残し）
 * - はみ出し塗り
 * - ダブルマーク（微妙な塗り残し）
 * - 楕円の一部だけ塗る（チェックマーク的な塗り方）
 */

import { describe, expect, it } from "vitest"

import { recognizeCell } from "../../../electron-src/lib/omr/markRecognizer"
import type { ComputedCell } from "../../../types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  CoordinateTransform,
  OMRCellConfig,
  OMRRecognitionParams,
  RawImageData,
} from "../../../types/omr.types"

// =====================
// テストヘルパー
// =====================

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
  colorThreshold: 128,
  areaThreshold: 0.4,
}

/**
 * バブル内の楕円ピクセルを指定グレー値・充填率で塗る
 *
 * @param data    RGBバッファ（直接変更）
 * @param width   画像幅
 * @param bubble  対象バブル
 * @param gray    塗りの明度（0=真っ黒, 255=白）
 * @param coverage 楕円領域のうち塗る割合（0-1, 1=全域）
 * @param pattern 塗りパターン
 *   - "solid": 全域を均一に塗る（デフォルト）
 *   - "center": 中心部のみ塗る（楕円の内側coverage比率の領域）
 *   - "random": ランダムに散らす（鉛筆の粗い塗りシミュレーション）
 *   - "top-half": 上半分だけ塗る（チェックマーク風のずさんな塗り）
 */
function paintBubble(
  data: Buffer,
  width: number,
  height: number,
  bubble: ComputedOMRBubble,
  gray: number,
  coverage: number = 1,
  pattern: "solid" | "center" | "random" | "top-half" = "solid"
): void {
  const channels = 3
  const cx = bubble.normalizedCx * width
  const cy = bubble.normalizedCy * height
  const halfW = (bubble.normalizedWidth * width) / 2
  const halfH = (bubble.normalizedHeight * height) / 2

  // 固定シードの簡易PRNG（テスト再現性のため）
  let seed = 12345
  function nextRand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const dx = (px - cx) / halfW
      const dy = (py - cy) / halfH
      const dist2 = dx * dx + dy * dy
      if (dist2 > 1) continue

      let shouldPaint = false
      switch (pattern) {
        case "solid":
          shouldPaint = true
          break
        case "center":
          // 楕円の内側 coverage^2 比率（面積=πab, 内側楕円=π(a*r)(b*r) → r^2 = coverage）
          shouldPaint = dist2 <= coverage
          break
        case "random":
          shouldPaint = nextRand() < coverage
          break
        case "top-half":
          shouldPaint = dy < 0 // 上半分のみ
          break
      }

      if (shouldPaint) {
        const pidx = (py * width + px) * channels
        data[pidx] = gray
        data[pidx + 1] = gray
        data[pidx + 2] = gray
      }
    }
  }
}

/**
 * テスト用画像を生成: 白背景に指定バブルを黒楕円で塗りつぶす（基本版）
 */
function createTestImage(
  width: number,
  height: number,
  bubbles: ComputedOMRBubble[],
  filledIndices: number[]
): RawImageData {
  const channels = 3
  const data = Buffer.alloc(width * height * channels, 255)

  for (const idx of filledIndices) {
    const bubble = bubbles[idx]
    if (!bubble) continue
    paintBubble(data, width, height, bubble, 0, 1, "solid")
  }

  return { data, width, height, channels }
}

/**
 * テスト用画像を生成: 各バブルに個別の塗り設定を適用
 */
function createRealisticTestImage(
  width: number,
  height: number,
  bubbles: ComputedOMRBubble[],
  fills: {
    index: number
    gray: number
    coverage?: number
    pattern?: "solid" | "center" | "random" | "top-half"
  }[]
): RawImageData {
  const channels = 3
  const data = Buffer.alloc(width * height * channels, 255)

  for (const fill of fills) {
    const bubble = bubbles[fill.index]
    if (!bubble) continue
    paintBubble(
      data,
      width,
      height,
      bubble,
      fill.gray,
      fill.coverage ?? 1,
      fill.pattern ?? "solid"
    )
  }

  return { data, width, height, channels }
}

/** 共通テスト風の縦長楕円バブル4択を生成 */
function create4ChoiceBubbles(
  imgWidth: number,
  imgHeight: number
): ComputedOMRBubble[] {
  const bubbleW = 30 / imgWidth
  const bubbleH = 48 / imgHeight
  const n = 4
  const spacing = 1 / (n + 1)

  return Array.from({ length: n }, (_, i) => ({
    normalizedCx: spacing * (i + 1),
    normalizedCy: 0.5,
    normalizedWidth: bubbleW,
    normalizedHeight: bubbleH,
    choiceIndex: i,
    label: ["①", "②", "③", "④"][i],
  }))
}

describe("markRecognizer", () => {
  const imgWidth = 400
  const imgHeight = 100
  const transform = createIdentityTransform(imgWidth, imgHeight)
  const bubbles = create4ChoiceBubbles(imgWidth, imgHeight)

  const config: OMRCellConfig & { type: "choice" } = {
    type: "choice",
    numChoices: 4,
    labels: ["①", "②", "③", "④"],
    correctAnswers: [1], // ②が正解
    layout: "horizontal",
  }

  function makeCell(omrBubbles: ComputedOMRBubble[]): ComputedCell {
    return {
      questionPath: [0, 0],
      x: 0,
      y: 0,
      width: imgWidth,
      height: imgHeight,
      normalizedX: 0,
      normalizedY: 0,
      normalizedW: 1,
      normalizedH: 1,
      label: "1",
      points: 5,
      textElements: [],
      cellType: "answer",
      pageIndex: 0,
      omrBubbles,
    }
  }

  it("塗りつぶしなし → no_answer", async () => {
    const img = createTestImage(imgWidth, imgHeight, bubbles, [])
    const cell = makeCell(bubbles)
    const result = await recognizeCell(
      cell,
      config,
      img,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.autoScoreStatus).toBe("no_answer")
    expect(result.recognizedValues).toEqual([])
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("正解のバブルを塗りつぶし → correct", async () => {
    const img = createTestImage(imgWidth, imgHeight, bubbles, [1]) // ②を塗る
    const cell = makeCell(bubbles)
    const result = await recognizeCell(
      cell,
      config,
      img,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.autoScoreStatus).toBe("correct")
    expect(result.recognizedValues).toEqual(["②"])
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("不正解のバブルを塗りつぶし → incorrect", async () => {
    const img = createTestImage(imgWidth, imgHeight, bubbles, [2]) // ③を塗る
    const cell = makeCell(bubbles)
    const result = await recognizeCell(
      cell,
      config,
      img,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.autoScoreStatus).toBe("incorrect")
    expect(result.recognizedValues).toEqual(["③"])
  })

  it("複数バブルを塗りつぶし（正解数より多い） → ambiguous", async () => {
    const img = createTestImage(imgWidth, imgHeight, bubbles, [0, 1]) // ①②を塗る
    const cell = makeCell(bubbles)
    const result = await recognizeCell(
      cell,
      config,
      img,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.autoScoreStatus).toBe("ambiguous")
    expect(result.recognizedValues).toHaveLength(2)
  })

  it("fillRatiosが各バブルの値を返す", async () => {
    const img = createTestImage(imgWidth, imgHeight, bubbles, [1])
    const cell = makeCell(bubbles)
    const result = await recognizeCell(
      cell,
      config,
      img,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.fillRatios).toHaveLength(4)
    // 塗ったバブルは高い塗りつぶし率
    expect(result.fillRatios![1]).toBeGreaterThan(0.8)
    // 塗っていないバブルは低い塗りつぶし率
    expect(result.fillRatios![0]).toBeLessThan(0.1)
    expect(result.fillRatios![2]).toBeLessThan(0.1)
    expect(result.fillRatios![3]).toBeLessThan(0.1)
  })

  it("omrBubblesが空の場合は no_answer", async () => {
    const img = createTestImage(imgWidth, imgHeight, [], [])
    const cell = makeCell([])
    const result = await recognizeCell(
      cell,
      config,
      img,
      transform,
      DEFAULT_PARAMS
    )

    expect(result.autoScoreStatus).toBe("no_answer")
    expect(result.recognizedValues).toEqual([])
  })

  describe("複数正解対応", () => {
    const multiConfig: OMRCellConfig & { type: "choice" } = {
      type: "choice",
      numChoices: 4,
      labels: ["①", "②", "③", "④"],
      correctAnswers: [0, 2], // ①③が正解
      layout: "horizontal",
    }

    it("複数正解を全て選択 → correct", async () => {
      const img = createTestImage(imgWidth, imgHeight, bubbles, [0, 2])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        multiConfig,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("correct")
      expect(result.recognizedValues).toEqual(["①", "③"])
    })

    it("正解を一部だけ選択 → incorrect", async () => {
      const img = createTestImage(imgWidth, imgHeight, bubbles, [0])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        multiConfig,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("incorrect")
    })
  })

  describe("0〜9数値解答（10択）", () => {
    const digitBubbles: ComputedOMRBubble[] = Array.from(
      { length: 10 },
      (_, i) => ({
        normalizedCx: (i + 1) / 11,
        normalizedCy: 0.5,
        normalizedWidth: 20 / imgWidth,
        normalizedHeight: 32 / imgHeight,
        choiceIndex: i,
        label: String(i),
      })
    )

    const digitConfig: OMRCellConfig & { type: "choice" } = {
      type: "choice",
      numChoices: 10,
      labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      correctAnswers: [7], // 7が正解
      layout: "horizontal",
    }

    it("数字7を塗りつぶし → correct + 認識値は '7'", async () => {
      const img = createTestImage(imgWidth, imgHeight, digitBubbles, [7])
      const cell = makeCell(digitBubbles)
      const result = await recognizeCell(
        cell,
        digitConfig,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("correct")
      expect(result.recognizedValues).toEqual(["7"])
    })
  })

  // =====================
  // リアルケース: 鉛筆の濃淡・消しゴム跡・ダブルマーク
  // =====================

  describe("鉛筆の濃淡", () => {
    it("しっかり濃く塗った鉛筆マーク（gray=30）→ 認識される", async () => {
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 30, coverage: 0.9, pattern: "solid" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("correct")
      expect(result.recognizedValues).toEqual(["②"])
    })

    it("薄く塗った鉛筆マーク（gray=100）→ 認識される", async () => {
      // gray=100 は colorThreshold=128 より暗いので「暗い」判定
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 100, coverage: 0.85, pattern: "random" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("correct")
      expect(result.fillRatios![1]).toBeGreaterThan(0.4)
    })

    it("非常に薄い塗り（gray=140）→ 閾値以上なので認識されない", async () => {
      // gray=140 > colorThreshold=128 なので「暗くない」判定
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 140, coverage: 1, pattern: "solid" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("no_answer")
      expect(result.fillRatios![1]).toBe(0)
    })
  })

  describe("消しゴム跡（消し残し）", () => {
    it("消しゴムで消した跡（gray=180, 20%残り）→ 認識しない", async () => {
      // 消しゴムで消したが20%程度のピクセルが薄く残っている
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 0, gray: 80, coverage: 0.2, pattern: "random" },
        { index: 1, gray: 10, coverage: 0.95, pattern: "solid" }, // 本命の塗り
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      // 消し残しはareaThreshold(0.4)未満なのでマークと判定しない
      expect(result.fillRatios![0]).toBeLessThan(0.4)
      // 本命は認識される
      expect(result.fillRatios![1]).toBeGreaterThan(0.8)
      expect(result.autoScoreStatus).toBe("correct")
      expect(result.recognizedValues).toEqual(["②"])
    })

    it("消しゴム跡が35%残り → ギリギリ認識しない", async () => {
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 0, gray: 60, coverage: 0.35, pattern: "random" },
        { index: 1, gray: 0, coverage: 1, pattern: "solid" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.fillRatios![0]).toBeLessThan(0.4)
      expect(result.autoScoreStatus).toBe("correct")
    })
  })

  describe("ダブルマーク（怪しいケース）", () => {
    it("2つのバブルを均等にしっかり塗り → ambiguous", async () => {
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 1, pattern: "solid" },
        { index: 2, gray: 0, coverage: 1, pattern: "solid" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.autoScoreStatus).toBe("ambiguous")
      expect(result.recognizedValues).toHaveLength(2)
      expect(result.confidence).toBeLessThanOrEqual(0.3) // ダブルマークは低信頼度
    })

    it("本命しっかり + 別の微妙な塗り(45%) → ダブルマーク判定", async () => {
      // 1つはしっかり塗り、もう1つが閾値ギリギリ超え
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 1, pattern: "solid" },
        { index: 3, gray: 50, coverage: 0.5, pattern: "random" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      // ③の塗りが閾値を超えたかどうかで結果が分かれる
      if (result.fillRatios![3]! >= 0.4) {
        expect(result.autoScoreStatus).toBe("ambiguous")
        expect(result.recognizedValues).toHaveLength(2)
      } else {
        expect(result.autoScoreStatus).toBe("correct")
        expect(result.recognizedValues).toEqual(["②"])
      }
    })

    it("本命しっかり + 別の薄塗り(30%) → 本命のみ認識", async () => {
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 1, pattern: "solid" },
        { index: 3, gray: 80, coverage: 0.3, pattern: "random" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.fillRatios![3]).toBeLessThan(0.4)
      expect(result.autoScoreStatus).toBe("correct")
      expect(result.recognizedValues).toEqual(["②"])
    })
  })

  describe("雑な塗り方", () => {
    it("楕円の上半分だけ塗る → 約50%で閾値超えなら認識", async () => {
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 1, pattern: "top-half" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      // 上半分 ≈ 50%の塗り → areaThreshold(0.4)を超えるので認識される
      expect(result.fillRatios![1]).toBeGreaterThan(0.4)
      expect(result.autoScoreStatus).toBe("correct")
    })

    it("中心部だけ塗る（coverage=0.6）→ 認識される", async () => {
      // 楕円の中心60%の面積だけ塗る
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 0.6, pattern: "center" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.fillRatios![1]).toBeGreaterThan(0.4)
      expect(result.autoScoreStatus).toBe("correct")
    })

    it("中心の小さな点だけ（coverage=0.15）→ 認識されない", async () => {
      // ちょっとだけ点を打った程度
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 0.15, pattern: "center" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        DEFAULT_PARAMS
      )

      expect(result.fillRatios![1]).toBeLessThan(0.4)
      expect(result.autoScoreStatus).toBe("no_answer")
    })
  })

  describe("閾値パラメータの影響", () => {
    it("areaThresholdを下げると薄塗りでも認識される", async () => {
      const looseParams: OMRRecognitionParams = {
        colorThreshold: 128,
        areaThreshold: 0.2, // 通常0.4 → 0.2に緩和
      }
      // 30%しか塗っていない
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 0.3, pattern: "random" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        looseParams
      )

      expect(result.fillRatios![1]).toBeGreaterThan(0.2)
      expect(result.autoScoreStatus).toBe("correct")
    })

    it("areaThresholdを上げると普通の塗りでも認識されにくくなる", async () => {
      const strictParams: OMRRecognitionParams = {
        colorThreshold: 128,
        areaThreshold: 0.9, // 90%以上塗らないと認識しない
      }
      // 70%塗り
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 0, coverage: 0.7, pattern: "random" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        strictParams
      )

      expect(result.autoScoreStatus).toBe("no_answer")
    })

    it("colorThresholdを下げると濃い鉛筆のみ認識", async () => {
      const darkOnlyParams: OMRRecognitionParams = {
        colorThreshold: 50, // gray < 50 のみ「暗い」
        areaThreshold: 0.4,
      }
      // gray=80（中程度の鉛筆）で塗る
      const img = createRealisticTestImage(imgWidth, imgHeight, bubbles, [
        { index: 1, gray: 80, coverage: 1, pattern: "solid" },
      ])
      const cell = makeCell(bubbles)
      const result = await recognizeCell(
        cell,
        config,
        img,
        transform,
        darkOnlyParams
      )

      // gray=80 > colorThreshold=50 なので認識されない
      expect(result.autoScoreStatus).toBe("no_answer")
    })
  })
})
