/**
 * 選択式セル判定ロジック テスト
 *
 * main側の認識と renderer側の再評価が共有する単一実装の検証。
 * 特に「選択肢を配列の位置ではなく choiceIndex で同定する」ことを確かめる。
 */

import { describe, expect, it } from "vitest"

import { evaluateChoiceBubbles } from "../../../src/lib/omr/choiceEvaluation"
import type {
  BubbleMeasurement,
  EllipticalInkStats,
} from "../../../src/types/omr.types"

/**
 * 測定値を作る
 *
 * 既定は「濃く一様に塗られた通常のマーク」。消し跡のように濃さや中心の
 * 塗られ方が異なるケースは ink で上書きする。
 */
function measurement(
  choiceIndex: number,
  label: string,
  fillRatio: number,
  ink: Partial<Omit<EllipticalInkStats, "fillRatio">> = {}
): BubbleMeasurement {
  return {
    choiceIndex,
    label,
    fillRatio,
    innerFillRatio: fillRatio,
    rimFillRatio: fillRatio,
    inkDarkness: 0.9,
    ...ink,
  }
}

/**
 * 答案群の濃さ分布から算出された「マークと見なす濃さの下限」の例。
 * 本来のマーク（0.8前後）と消し跡（0.25前後）の間に落ちる。
 */
const SHEET_MIN_INK_DARKNESS = 0.45

describe("evaluateChoiceBubbles", () => {
  it("閾値以上のバブルだけをマーク済みと判定する", () => {
    const evaluation = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(0, "ア", 0.05),
        measurement(1, "イ", 0.92),
        measurement(2, "ウ", 0.03),
      ],
      correctChoiceIndices: [1],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    expect(evaluation.recognizedValues).toEqual(["イ"])
    expect(evaluation.markedChoiceIndices).toEqual([1])
    expect(evaluation.autoScoreStatus).toBe("correct")
  })

  it("正解数より多くマークされたら ambiguous", () => {
    const evaluation = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(0, "ア", 0.88),
        measurement(1, "イ", 0.91),
      ],
      correctChoiceIndices: [1],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    expect(evaluation.autoScoreStatus).toBe("ambiguous")
    expect(evaluation.confidence).toBeLessThanOrEqual(0.3)
  })

  it("複数正解を全て選べば correct", () => {
    const evaluation = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(0, "ア", 0.9),
        measurement(1, "イ", 0.02),
        measurement(2, "ウ", 0.87),
      ],
      correctChoiceIndices: [0, 2],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    expect(evaluation.autoScoreStatus).toBe("correct")
    expect(evaluation.recognizedValues).toEqual(["ア", "ウ"])
  })

  it("未マークは no_answer で、薄いほど高信頼", () => {
    const clean = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(0, "ア", 0.01),
        measurement(1, "イ", 0.02),
      ],
      correctChoiceIndices: [1],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })
    const smudged = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(0, "ア", 0.35),
        measurement(1, "イ", 0.02),
      ],
      correctChoiceIndices: [1],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    expect(clean.autoScoreStatus).toBe("no_answer")
    expect(smudged.autoScoreStatus).toBe("no_answer")
    // 消し残しがあるほど「未回答」の確信は下がる
    expect(smudged.confidence).toBeLessThan(clean.confidence)
  })

  it("バブルが1つも無ければ no_answer・信頼度0", () => {
    const evaluation = evaluateChoiceBubbles({
      bubbleMeasurements: [],
      correctChoiceIndices: [0],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    expect(evaluation.autoScoreStatus).toBe("no_answer")
    expect(evaluation.confidence).toBe(0)
    expect(evaluation.recognizedValues).toEqual([])
  })

  it("choiceIndex が配列の位置と一致しなくても正しい選択肢を指す", () => {
    // 位置未設定の選択肢（choiceIndex=0,2）が脱落し、配列は [1, 3] だけになった状態
    const evaluation = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(1, "イ", 0.05),
        measurement(3, "エ", 0.93),
      ],
      correctChoiceIndices: [3],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    // 配列位置(1)ではなく choiceIndex(3) で正解と突き合わせる
    expect(evaluation.markedChoiceIndices).toEqual([3])
    expect(evaluation.recognizedValues).toEqual(["エ"])
    expect(evaluation.autoScoreStatus).toBe("correct")
  })

  it("脱落した選択肢が正解でもマーク側の同定はずれない", () => {
    const evaluation = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(1, "イ", 0.91),
        measurement(3, "エ", 0.04),
      ],
      correctChoiceIndices: [0],
      areaThreshold: 0.4,
      minInkDarkness: null,
    })

    expect(evaluation.markedChoiceIndices).toEqual([1])
    expect(evaluation.autoScoreStatus).toBe("incorrect")
  })

  describe("消し跡の切り分け", () => {
    it("薄く広がった消し跡は塗りつぶし率が閾値を超えても退けられる", () => {
      const evaluation = evaluateChoiceBubbles({
        bubbleMeasurements: [
          // 消しゴムで消した跡。面積は稼いでいるが黒鉛が薄い
          measurement(0, "ア", 0.62, { inkDarkness: 0.25 }),
          measurement(1, "イ", 0.02),
        ],
        correctChoiceIndices: [1],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })

      expect(evaluation.markedChoiceIndices).toEqual([])
      expect(evaluation.residueChoiceIndices).toEqual([0])
      expect(evaluation.autoScoreStatus).toBe("no_answer")
      // 退けた判断が黙って通らないよう信頼度は落ちる
      expect(evaluation.confidence).toBe(0)
    })

    it("消し跡と本命が並ぶとき、本命だけを認識する", () => {
      const evaluation = evaluateChoiceBubbles({
        bubbleMeasurements: [
          measurement(0, "ア", 0.55, { inkDarkness: 0.22 }),
          measurement(1, "イ", 0.94),
        ],
        correctChoiceIndices: [1],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })

      // 従来は2つともマーク済みとなり ambiguous（＝0点）になっていた
      expect(evaluation.autoScoreStatus).toBe("correct")
      expect(evaluation.recognizedValues).toEqual(["イ"])
      expect(evaluation.residueChoiceIndices).toEqual([0])
    })

    it("消し跡を退けたセルは保留に落ちる信頼度になる", () => {
      const withResidue = evaluateChoiceBubbles({
        bubbleMeasurements: [
          measurement(0, "ア", 0.55, { inkDarkness: 0.22 }),
          measurement(1, "イ", 0.94),
        ],
        correctChoiceIndices: [1],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })
      const withoutResidue = evaluateChoiceBubbles({
        bubbleMeasurements: [
          measurement(0, "ア", 0.02),
          measurement(1, "イ", 0.94),
        ],
        correctChoiceIndices: [1],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })

      // 既定の信頼度閾値0.7を下回るので保留として人が見る
      expect(withResidue.confidence).toBeLessThan(0.7)
      expect(withoutResidue.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it("輪郭をなぞった線は中心が空なので退けられる", () => {
      const evaluation = evaluateChoiceBubbles({
        bubbleMeasurements: [
          // 濃いが縁だけ。バブルを丸で囲った場合
          // （中心側と縁側は面積が揃うので fillRatio ≈ (0.02 + 0.93) / 2）
          measurement(0, "ア", 0.48, {
            innerFillRatio: 0.02,
            rimFillRatio: 0.93,
          }),
          measurement(1, "イ", 0.02),
        ],
        correctChoiceIndices: [0],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })

      expect(evaluation.markedChoiceIndices).toEqual([])
      expect(evaluation.residueChoiceIndices).toEqual([0])
    })

    it("薄めでも濃さが足りていれば退けない（薄塗りの取りこぼし防止）", () => {
      const evaluation = evaluateChoiceBubbles({
        bubbleMeasurements: [
          // 鉛筆が薄いが芯は乗っている。中心も塗られている
          measurement(0, "ア", 0.45, {
            inkDarkness: 0.55,
            innerFillRatio: 0.42,
          }),
          measurement(1, "イ", 0.02),
        ],
        correctChoiceIndices: [0],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })

      expect(evaluation.markedChoiceIndices).toEqual([0])
      expect(evaluation.residueChoiceIndices).toEqual([])
      expect(evaluation.autoScoreStatus).toBe("correct")
    })

    it("中心が塗られていれば縁が薄くても退けない（はみ出さずに塗った場合）", () => {
      // 中心側と縁側は面積が揃うので fillRatio ≈ (inner + rim) / 2 になる
      const evaluation = evaluateChoiceBubbles({
        bubbleMeasurements: [
          measurement(0, "ア", 0.55, {
            innerFillRatio: 0.9,
            rimFillRatio: 0.2,
          }),
          measurement(1, "イ", 0.02),
        ],
        correctChoiceIndices: [0],
        areaThreshold: 0.4,
        minInkDarkness: SHEET_MIN_INK_DARKNESS,
      })

      expect(evaluation.markedChoiceIndices).toEqual([0])
      expect(evaluation.residueChoiceIndices).toEqual([])
    })

    it("縁の一部だけ汚れていても退けない（紙のノイズ）", () => {
      // 塗りつぶし判定閾値を下げたときに拾ってしまう程度の汚れ。
      // 縁がぐるりと覆われていないので輪郭なぞりではない
      const evaluation = evaluateChoiceBubbles({
        bubbleMeasurements: [
          measurement(0, "ア", 0.06, {
            innerFillRatio: 0.04,
            rimFillRatio: 0.08,
          }),
          measurement(1, "イ", 0.01),
        ],
        correctChoiceIndices: [0],
        areaThreshold: 0.05,
        minInkDarkness: null,
      })

      expect(evaluation.residueChoiceIndices).toEqual([])
      expect(evaluation.markedChoiceIndices).toEqual([0])
    })
  })
})
