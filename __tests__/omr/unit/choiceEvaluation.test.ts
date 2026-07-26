/**
 * 選択式セル判定ロジック テスト
 *
 * main側の認識と renderer側の再評価が共有する単一実装の検証。
 * 特に「選択肢を配列の位置ではなく choiceIndex で同定する」ことを確かめる。
 */

import { describe, expect, it } from "vitest"

import { evaluateChoiceBubbles } from "../../../src/lib/omr/choiceEvaluation"
import type { BubbleMeasurement } from "../../../src/types/omr.types"

/** ラベル・choiceIndex・塗りつぶし率から測定値を作る */
function measurement(
  choiceIndex: number,
  label: string,
  fillRatio: number
): BubbleMeasurement {
  return { choiceIndex, label, fillRatio }
}

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
    })
    const smudged = evaluateChoiceBubbles({
      bubbleMeasurements: [
        measurement(0, "ア", 0.35),
        measurement(1, "イ", 0.02),
      ],
      correctChoiceIndices: [1],
      areaThreshold: 0.4,
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
    })

    expect(evaluation.markedChoiceIndices).toEqual([1])
    expect(evaluation.autoScoreStatus).toBe("incorrect")
  })
})
