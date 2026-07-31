/**
 * 閾値の分布からの算出 テスト
 *
 * 塗りつぶし閾値と、消し跡を退けるための濃さの下限を、
 * どちらも答案群の分布から決められることを検証する。
 */

import type {
  CropRegionOmrChoiceOption,
  CropRegionOmrConfig,
} from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  recommendAreaThreshold,
  recommendMinInkDarkness,
  reevaluateWithThreshold,
} from "../../../src/components/exams/07-score-at-once/OMRRecognition/utils/reevaluateResults"
import type {
  BubbleMeasurement,
  CropRegionOmrConfigWithOptions,
  EllipticalInkStats,
  OMRSheetResult,
} from "../../../src/types/omr.types"

const AREA_THRESHOLD = 0.4

/** 濃く一様に塗られた通常のマークを既定とする測定値 */
function measurement(
  choiceIndex: number,
  fillRatio: number,
  ink: Partial<Omit<EllipticalInkStats, "fillRatio">> = {}
): BubbleMeasurement {
  return {
    choiceIndex,
    label: String(choiceIndex),
    fillRatio,
    innerFillRatio: fillRatio,
    rimFillRatio: fillRatio,
    inkDarkness: 0.85,
    ...ink,
  }
}

/** 測定値の並びを1枚の答案の認識結果に仕立てる */
function createSheet(
  examStudentId: string,
  cells: BubbleMeasurement[][]
): OMRSheetResult {
  return {
    success: true,
    examStudentId,
    pageIndex: 0,
    markerDetection: {
      success: true,
      markers: [],
      imageWidth: 1000,
      imageHeight: 1400,
    },
    cellResults: cells.map((bubbleMeasurements, cellIndex) => ({
      label: `crop-region-${cellIndex}`,
      questionPath: [0, cellIndex],
      recognizedValues: [],
      bubbleMeasurements,
      confidence: 1,
    })),
  }
}

/** 4択のうち1つを塗った設問を questionCount 問ぶん並べた答案 */
function createAnsweredSheet(
  examStudentId: string,
  questionCount: number,
  markedInk: Partial<Omit<EllipticalInkStats, "fillRatio">> = {}
): OMRSheetResult {
  return createSheet(
    examStudentId,
    Array.from({ length: questionCount }, () => [
      measurement(0, 0.02),
      measurement(1, 0.92, markedInk),
      measurement(2, 0.03),
      measurement(3, 0.01),
    ])
  )
}

describe("recommendAreaThreshold", () => {
  it("マーク済みと未マークの間に境界を返す", () => {
    const sheets = [
      createAnsweredSheet("student-1", 5),
      createAnsweredSheet("student-2", 5),
    ]

    const threshold = recommendAreaThreshold(sheets)

    expect(threshold).not.toBeNull()
    expect(threshold!).toBeGreaterThan(0.03)
    expect(threshold!).toBeLessThan(0.92)
  })

  it("全員未回答なら null（既定値のままにする）", () => {
    const sheets = [
      createSheet("student-1", [
        [measurement(0, 0.01), measurement(1, 0.02)],
        [measurement(0, 0.03), measurement(1, 0.01)],
      ]),
      createSheet("student-2", [
        [measurement(0, 0.02), measurement(1, 0.01)],
        [measurement(0, 0.01), measurement(1, 0.03)],
      ]),
    ]

    expect(recommendAreaThreshold(sheets)).toBeNull()
  })

  it("認識に失敗したシートは母集団に入れない", () => {
    const failed: OMRSheetResult = {
      success: false,
      pageIndex: 0,
      markerDetection: {
        success: false,
        markers: [],
        imageWidth: 1000,
        imageHeight: 1400,
      },
      cellResults: [],
    }

    expect(recommendAreaThreshold([failed])).toBeNull()
  })
})

describe("recommendMinInkDarkness", () => {
  it("消し跡が混ざっていれば本来のマークとの間に境界を返す", () => {
    // 大半は普通に塗り、2問だけ消し跡が閾値を超えて残っている答案
    const sheets = [
      createSheet("student-1", [
        ...Array.from({ length: 18 }, () => [
          measurement(0, 0.9),
          measurement(1, 0.02),
        ]),
        ...Array.from({ length: 2 }, () => [
          measurement(0, 0.55, { inkDarkness: 0.22 }),
          measurement(1, 0.02),
        ]),
      ]),
    ]

    const minInkDarkness = recommendMinInkDarkness(sheets, AREA_THRESHOLD)

    expect(minInkDarkness).not.toBeNull()
    expect(minInkDarkness!).toBeGreaterThan(0.22)
    expect(minInkDarkness!).toBeLessThan(0.85)
  })

  it("濃さが揃っていれば null（消し跡は無いので棄却を働かせない）", () => {
    const sheets = [
      createAnsweredSheet("student-1", 6),
      createAnsweredSheet("student-2", 6),
    ]

    expect(recommendMinInkDarkness(sheets, AREA_THRESHOLD)).toBeNull()
  })

  it("薄い鉛筆で揃っていても null（一律に薄いのは消し跡ではない）", () => {
    // 色しきい値の自動決定で拾えるようになった薄い鉛筆。
    // ここで棄却してしまうと自動キャリブレーションと衝突する
    const sheets = [
      createAnsweredSheet("student-1", 6, { inkDarkness: 0.28 }),
      createAnsweredSheet("student-2", 6, { inkDarkness: 0.26 }),
    ]

    expect(recommendMinInkDarkness(sheets, AREA_THRESHOLD)).toBeNull()
  })

  it("塗りつぶし閾値を超えたバブルが少なければ null", () => {
    const sheets = [
      createSheet("student-1", [[measurement(0, 0.9), measurement(1, 0.02)]]),
    ]

    expect(recommendMinInkDarkness(sheets, AREA_THRESHOLD)).toBeNull()
  })

  it("薄い側が多数派なら null（筆圧の個人差を消し跡と取り違えない）", () => {
    // 筆圧の強い生徒1人と弱い生徒3人。大津法は必ず2群に割るが、
    // 薄い側が多数なら消し跡ではないので棄却しない
    const sheets = [
      createAnsweredSheet("strong-presser", 6, { inkDarkness: 0.85 }),
      createAnsweredSheet("light-presser-1", 6, { inkDarkness: 0.3 }),
      createAnsweredSheet("light-presser-2", 6, { inkDarkness: 0.28 }),
      createAnsweredSheet("light-presser-3", 6, { inkDarkness: 0.32 }),
    ]

    expect(recommendMinInkDarkness(sheets, AREA_THRESHOLD)).toBeNull()
  })
})

describe("消し跡を退けたセルの下流での扱い", () => {
  const CROP_REGION_ID = "crop-region-0"

  /** 2択の設問のOMR設定を作る（choiceIndex 0 が正解） */
  function createDbConfig(): CropRegionOmrConfigWithOptions {
    const timestamp = new Date("2026-07-26T00:00:00.000Z")
    const choiceOptions: CropRegionOmrChoiceOption[] = [0, 1].map(
      (choiceIndex) => ({
        id: `option-${choiceIndex}`,
        omrConfigId: "omr-config-uuid",
        choiceIndex,
        label: String(choiceIndex),
        isCorrect: choiceIndex === 0,
        shape: "ellipse",
        normalizedCx: 0.1 + choiceIndex * 0.1,
        normalizedCy: 0.5,
        normalizedWidth: 0.03,
        normalizedHeight: 0.02,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    )
    const config: CropRegionOmrConfig = {
      id: "omr-config-uuid",
      cropRegionId: CROP_REGION_ID,
      type: "choice",
      numChoices: 2,
      choiceLayout: "horizontal",
      numDigits: null,
      correctAnswer: null,
      colorThreshold: null,
      areaThreshold: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    return { ...config, choiceOptions }
  }

  /** 1セルだけの答案を再評価し、採点エントリを取り出す */
  function evaluateSingleCell(
    bubbleMeasurements: BubbleMeasurement[],
    minInkDarkness: number | null
  ) {
    const sheet = createSheet("student-1", [bubbleMeasurements])
    const { scoreEntries } = reevaluateWithThreshold({
      sheetResults: [sheet],
      omrConfigs: [createDbConfig()],
      pointsMap: { [CROP_REGION_ID]: 5 },
      areaThreshold: AREA_THRESHOLD,
      confidenceThreshold: 0.7,
      minInkDarkness,
    })
    return scoreEntries.get("student-1")![0]
  }

  it("唯一の塗りが消し跡と判断されたセルは保留になる（未回答で確定させない）", () => {
    const entry = evaluateSingleCell(
      [measurement(0, 0.62, { inkDarkness: 0.22 }), measurement(1, 0.02)],
      0.45
    )

    // 認識としては未回答だが、退けた判断が黙って0点にならないよう保留にする
    expect(entry.status).toBe("pending")
    expect(entry.score).toBe(0)
  })

  it("消し跡を退けて正解が残ったセルも保留になる", () => {
    const entry = evaluateSingleCell(
      [measurement(0, 0.92), measurement(1, 0.55, { inkDarkness: 0.2 })],
      0.45
    )

    expect(entry.status).toBe("pending")
    expect(entry.score).toBe(0)
  })

  it("信頼度閾値を0にしても消し跡セルは保留のまま", () => {
    const sheet = createSheet("student-1", [
      [measurement(0, 0.92), measurement(1, 0.55, { inkDarkness: 0.2 })],
    ])
    const { scoreEntries } = reevaluateWithThreshold({
      sheetResults: [sheet],
      omrConfigs: [createDbConfig()],
      pointsMap: { [CROP_REGION_ID]: 5 },
      areaThreshold: AREA_THRESHOLD,
      // ユーザーが信頼度による保留を無効化しても、退けた判断は人が見る
      confidenceThreshold: 0,
      minInkDarkness: 0.45,
    })

    expect(scoreEntries.get("student-1")![0].status).toBe("pending")
  })

  it("消し跡が無ければ従来どおり採点される", () => {
    const entry = evaluateSingleCell(
      [measurement(0, 0.92), measurement(1, 0.02)],
      null
    )

    expect(entry.status).toBe("correct")
    expect(entry.score).toBe(5)
  })
})
