/**
 * OMR認識結果の閾値再評価ユーティリティ
 *
 * キャッシュ済みの測定値に対して新しいareaThresholdを適用し、
 * 認識結果・採点ステータス・サマリーを再計算する。
 * IPC不要のレンダラー完結処理。
 */

import { evaluateChoiceBubbles } from "@/lib/omr/choiceEvaluation"
import { computeOtsuThreshold } from "@/lib/omr/otsuThreshold"
import type {
  CropRegionOmrConfigWithOptions,
  OMRCellResult,
  OMRSheetResult,
} from "@/types/omr.types"

/** 自動採点エントリ */
export interface ReevaluatedScoreEntry {
  label: string
  cropRegionId?: string
  questionPath: number[]
  status:
    | "correct"
    | "incorrect"
    | "partial"
    | "no_answer"
    | "double_mark"
    | "pending"
  score: number
  maxPoints: number
  recognizedValues: string[]
}

export interface ScoringResultSummary {
  correct: number
  incorrect: number
  noAnswer: number
  doubleMark: number
  partial: number
  pending: number
  total: number
}

export interface ReevaluationInput {
  sheetResults: OMRSheetResult[]
  omrConfigs: CropRegionOmrConfigWithOptions[]
  pointsMap: Record<string, number>
  areaThreshold: number
  confidenceThreshold: number
}

export interface ReevaluationOutput {
  updatedSheetResults: OMRSheetResult[]
  scoreEntries: Map<string, ReevaluatedScoreEntry[]>
  summary: ScoringResultSummary
}

/**
 * キャッシュ済みの測定値から閾値を変えて認識結果を再評価する
 *
 * 判定は main 側の認識と同じ evaluateChoiceBubbles に委ねる。
 * 手書き数字型セルは測定値を持たないので元の結果をそのまま保持する。
 */
export function reevaluateWithThreshold(
  input: ReevaluationInput
): ReevaluationOutput {
  const {
    sheetResults,
    omrConfigs,
    pointsMap,
    areaThreshold,
    confidenceThreshold,
  } = input

  const allEntries = new Map<string, ReevaluatedScoreEntry[]>()
  const updatedSheetResults: OMRSheetResult[] = []

  for (const sheet of sheetResults) {
    if (!sheet.success || !sheet.studentId) {
      updatedSheetResults.push(sheet)
      continue
    }

    const updatedCellResults: OMRCellResult[] = []
    const entries: ReevaluatedScoreEntry[] = []

    for (const cellResult of sheet.cellResults) {
      const cropRegionId = cellResult.label
      const omrConfig = omrConfigs.find(
        (config) => config.cropRegionId === cropRegionId
      )
      const maxPoints = pointsMap[cropRegionId] ?? 0

      // 測定値がない場合（手書き数字型など）は元の結果をそのまま使用
      if (
        !cellResult.bubbleMeasurements ||
        !omrConfig ||
        omrConfig.type !== "choice"
      ) {
        updatedCellResults.push(cellResult)
        entries.push(
          buildEntryFromCellResult(
            cellResult,
            omrConfig,
            maxPoints,
            confidenceThreshold
          )
        )
        continue
      }

      // 測定値からareaThresholdで再判定
      const updatedCell = reevaluateChoiceCell(
        cellResult,
        omrConfig,
        areaThreshold
      )
      updatedCellResults.push(updatedCell)
      entries.push(
        buildEntryFromCellResult(
          updatedCell,
          omrConfig,
          maxPoints,
          confidenceThreshold
        )
      )
    }

    updatedSheetResults.push({ ...sheet, cellResults: updatedCellResults })
    allEntries.set(sheet.studentId, entries)
  }

  // サマリーはエントリのstatusから集計
  const summary = countSummary(allEntries)

  return { updatedSheetResults, scoreEntries: allEntries, summary }
}

/**
 * 選択式セルの測定値から新しいareaThresholdで再判定する
 *
 * 判定ロジックは main 側の認識と同じ evaluateChoiceBubbles を使う。
 */
function reevaluateChoiceCell(
  cellResult: OMRCellResult,
  config: CropRegionOmrConfigWithOptions,
  areaThreshold: number
): OMRCellResult {
  const evaluation = evaluateChoiceBubbles({
    bubbleMeasurements: cellResult.bubbleMeasurements!,
    correctChoiceIndices: config.choiceOptions
      .filter((option) => option.isCorrect)
      .map((option) => option.choiceIndex),
    areaThreshold,
  })

  return {
    ...cellResult,
    recognizedValues: evaluation.recognizedValues,
    confidence: evaluation.confidence,
    autoScoreStatus: evaluation.autoScoreStatus,
  }
}

/**
 * OMRCellResultからReevaluatedScoreEntryを構築（部分点・低信頼チェック含む）
 */
function buildEntryFromCellResult(
  cellResult: OMRCellResult,
  config: CropRegionOmrConfigWithOptions | undefined,
  maxPoints: number,
  confidenceThreshold: number
): ReevaluatedScoreEntry {
  const cropRegionId = cellResult.label
  let status: ReevaluatedScoreEntry["status"]
  let score: number

  switch (cellResult.autoScoreStatus) {
    case "correct":
      status = "correct"
      score = maxPoints
      break
    case "incorrect":
      status = "incorrect"
      score = 0
      break
    case "no_answer":
      status = "no_answer"
      score = 0
      break
    case "ambiguous":
      status = "double_mark"
      score = 0
      break
    default:
      status = "no_answer"
      score = 0
  }

  // 部分点チェック
  if (
    config?.type === "choice" &&
    status === "incorrect" &&
    cellResult.recognizedValues.length > 0
  ) {
    const correctLabels = config.choiceOptions
      .filter((option) => option.isCorrect)
      .map((option) => option.label)
    if (correctLabels.length > 1) {
      const correctCount = cellResult.recognizedValues.filter((value) =>
        correctLabels.includes(value)
      ).length
      if (correctCount > 0 && correctCount < correctLabels.length) {
        status = "partial"
        score = Math.floor((maxPoints * correctCount) / correctLabels.length)
      }
    }
  }

  // 低信頼チェック
  if (
    cellResult.confidence < confidenceThreshold &&
    status !== "no_answer" &&
    status !== "double_mark"
  ) {
    status = "pending"
    score = 0
  }

  return {
    label: cellResult.label,
    cropRegionId,
    questionPath: cellResult.questionPath,
    status,
    score,
    maxPoints,
    recognizedValues: cellResult.recognizedValues,
  }
}

/** エントリのstatusからサマリーを集計 */
function countSummary(
  allEntries: Map<string, ReevaluatedScoreEntry[]>
): ScoringResultSummary {
  let correct = 0,
    incorrect = 0,
    noAnswer = 0,
    doubleMark = 0,
    partial = 0,
    pending = 0

  for (const entries of allEntries.values()) {
    for (const entry of entries) {
      switch (entry.status) {
        case "correct":
          correct++
          break
        case "incorrect":
          incorrect++
          break
        case "no_answer":
          noAnswer++
          break
        case "double_mark":
          doubleMark++
          break
        case "partial":
          partial++
          break
        case "pending":
          pending++
          break
      }
    }
  }

  return {
    correct,
    incorrect,
    noAnswer,
    doubleMark,
    partial,
    pending,
    total: correct + incorrect + noAnswer + doubleMark + partial + pending,
  }
}

/** 塗りつぶし率ヒストグラムのビン設定（1%刻み） */
const FILL_RATIO_OPTIONS = { min: 0, max: 1, bins: 100 }

/**
 * 自動決定を採用する最小の塗りつぶし率の差（0-1）
 *
 * マーク済みと未マークはこれ以上離れる。全員未回答に近い設問構成では
 * 2群が接近するので、算出値を捨てて既定値のままにする。
 */
const MIN_FILL_RATIO_SEPARATION = 0.25

/**
 * 全シートのfillRatio分布から最適なareaThresholdを算出する
 *
 * 全セルの測定値をフラットに収集し、大津法で「マークあり群 / なし群」の境界を求める。
 * 分布を足切りせず全体を使うため、母数が増えても境界が求まる。
 *
 * @returns サンプル不足・2群が離れていない場合は null
 */
export function recommendAreaThreshold(
  sheetResults: OMRSheetResult[]
): number | null {
  const allRatios = sheetResults
    .filter((sheet) => sheet.success)
    .flatMap((sheet) => sheet.cellResults)
    .flatMap((cell) => cell.bubbleMeasurements ?? [])
    .map((measurement) => measurement.fillRatio)

  const otsu = computeOtsuThreshold(allRatios, FILL_RATIO_OPTIONS)
  if (otsu === null || otsu.meanDistance < MIN_FILL_RATIO_SEPARATION) {
    return null
  }

  return Math.round(otsu.threshold * 100) / 100
}
