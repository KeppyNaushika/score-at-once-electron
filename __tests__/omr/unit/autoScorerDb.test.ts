/**
 * convertToScoreEntriesFromDb 単体テスト
 *
 * DB管理の CropRegionOmrConfig ベースで OMR認識結果を採点エントリに変換するロジック
 */

import { describe, expect, it } from "vitest"

import { convertToScoreEntriesFromDb } from "../../../electron-src/lib/omr/autoScorer"
import type {
  CropRegionOmrConfigWithOptions,
  OMRCellResult,
} from "../../../types/omr.types"

// テストヘルパー: OMR設定を構築
function makeChoiceConfig(
  cropRegionId: string,
  labels: string[],
  correctIndices: number[]
): CropRegionOmrConfigWithOptions {
  return {
    id: `cfg-${cropRegionId}`,
    cropRegionId,
    type: "choice",
    numChoices: labels.length,
    choiceLayout: "horizontal",
    numDigits: null,
    correctAnswer: null,
    cellGeometryJson: null,
    colorThreshold: null,
    areaThreshold: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    choiceOptions: labels.map((label, idx) => ({
      id: `opt-${cropRegionId}-${idx}`,
      omrConfigId: `cfg-${cropRegionId}`,
      choiceIndex: idx,
      label,
      isCorrect: correctIndices.includes(idx),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  }
}

function makeDigitConfig(
  cropRegionId: string,
  numDigits: number,
  correctAnswer: string
): CropRegionOmrConfigWithOptions {
  return {
    id: `cfg-${cropRegionId}`,
    cropRegionId,
    type: "handwritten-digit",
    numChoices: null,
    choiceLayout: null,
    numDigits,
    correctAnswer,
    cellGeometryJson: null,
    colorThreshold: null,
    areaThreshold: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    choiceOptions: [],
  }
}

function makeCellResult(
  cropRegionId: string,
  recognizedValues: string[],
  autoScoreStatus: "correct" | "incorrect" | "no_answer" | "ambiguous"
): OMRCellResult {
  return {
    label: cropRegionId,
    questionPath: [0, 0],
    recognizedValues,
    confidence: 0.9,
    autoScoreStatus,
  }
}

describe("convertToScoreEntriesFromDb", () => {
  it("正解の場合、満点を返す", () => {
    const configs = [makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [0])]
    const cellResults = [makeCellResult("cr-1", ["ア"], "correct")]
    const pointsMap = { "cr-1": 5 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries).toHaveLength(1)
    expect(entries[0].status).toBe("correct")
    expect(entries[0].score).toBe(5)
    expect(entries[0].maxPoints).toBe(5)
    expect(entries[0].cropRegionId).toBe("cr-1")
  })

  it("不正解の場合、0点を返す", () => {
    const configs = [makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [0])]
    const cellResults = [makeCellResult("cr-1", ["イ"], "incorrect")]
    const pointsMap = { "cr-1": 5 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("incorrect")
    expect(entries[0].score).toBe(0)
  })

  it("無回答の場合、0点を返す", () => {
    const configs = [makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [0])]
    const cellResults = [makeCellResult("cr-1", [], "no_answer")]
    const pointsMap = { "cr-1": 5 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("no_answer")
    expect(entries[0].score).toBe(0)
  })

  it("曖昧な場合、ambiguousを返す", () => {
    const configs = [makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [0])]
    const cellResults = [makeCellResult("cr-1", ["ア", "イ"], "ambiguous")]
    const pointsMap = { "cr-1": 5 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("ambiguous")
    expect(entries[0].score).toBe(0)
  })

  it("複数正解で部分正解の場合、部分点を返す", () => {
    // 正解が ア と ウ（2つ）の場合
    const configs = [makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [0, 2])]
    // ア だけ選択（1/2正解）
    const cellResults = [makeCellResult("cr-1", ["ア"], "incorrect")]
    const pointsMap = { "cr-1": 10 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("partial")
    expect(entries[0].score).toBe(5) // 10 * 1/2 = 5
  })

  it("複数正解で全て不正解の場合、incorrectのまま", () => {
    const configs = [makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [0, 2])]
    // イ だけ選択（0/2正解）
    const cellResults = [makeCellResult("cr-1", ["イ"], "incorrect")]
    const pointsMap = { "cr-1": 10 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("incorrect")
    expect(entries[0].score).toBe(0)
  })

  it("手書き数字の正解判定", () => {
    const configs = [makeDigitConfig("cr-2", 2, "42")]
    const cellResults = [makeCellResult("cr-2", ["4", "2"], "correct")]
    const pointsMap = { "cr-2": 8 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("correct")
    expect(entries[0].score).toBe(8)
  })

  it("複数の設問を同時に処理", () => {
    const configs = [
      makeChoiceConfig("cr-1", ["ア", "イ", "ウ", "エ"], [2]),
      makeDigitConfig("cr-2", 3, "256"),
    ]
    const cellResults = [
      makeCellResult("cr-1", ["ウ"], "correct"),
      makeCellResult("cr-2", ["2", "5", "7"], "incorrect"),
    ]
    const pointsMap = { "cr-1": 5, "cr-2": 10 }

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries).toHaveLength(2)
    expect(entries[0].status).toBe("correct")
    expect(entries[0].score).toBe(5)
    expect(entries[1].status).toBe("incorrect")
    expect(entries[1].score).toBe(0)
  })

  it("配点マップにない設問は maxPoints=0 で処理", () => {
    const configs = [makeChoiceConfig("cr-1", ["A", "B"], [0])]
    const cellResults = [makeCellResult("cr-1", ["A"], "correct")]
    const pointsMap = {} // 空

    const entries = convertToScoreEntriesFromDb(cellResults, configs, pointsMap)

    expect(entries[0].status).toBe("correct")
    expect(entries[0].score).toBe(0) // maxPoints=0なので得点も0
    expect(entries[0].maxPoints).toBe(0)
  })
})
