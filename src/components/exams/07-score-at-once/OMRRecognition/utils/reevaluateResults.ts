/**
 * OMR認識結果の閾値再評価ユーティリティ
 *
 * キャッシュ済みfillRatiosに対して新しいareaThresholdを適用し、
 * 認識結果・採点ステータス・サマリーを再計算する。
 * IPC不要のレンダラー完結処理。
 */

import type {
  CropRegionOmrConfigWithOptions,
  OMRCellResult,
  OMRSheetResult,
} from "@/types/omr.types"

/** 自動採点エントリ */
export interface AutoScoreEntry {
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
  scoreEntries: Map<string, AutoScoreEntry[]>
  summary: ScoringResultSummary
}

/**
 * キャッシュ済みfillRatiosから閾値を変えて認識結果を再評価する
 *
 * markRecognizer.ts の recognizeChoiceCell と同一ロジックを
 * fillRatios起点で再計算する。手書き数字型セルは元の結果をそのまま保持。
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

  const allEntries = new Map<string, AutoScoreEntry[]>()
  const updatedSheetResults: OMRSheetResult[] = []

  for (const sheet of sheetResults) {
    if (!sheet.success || !sheet.studentId) {
      updatedSheetResults.push(sheet)
      continue
    }

    const updatedCellResults: OMRCellResult[] = []
    const entries: AutoScoreEntry[] = []

    for (const cellResult of sheet.cellResults) {
      const cropRegionId = cellResult.label
      const cfg = omrConfigs.find((c) => c.cropRegionId === cropRegionId)
      const maxPoints = pointsMap[cropRegionId] ?? 0

      // fillRatiosがない場合（手書き数字型など）は元の結果をそのまま使用
      if (!cellResult.fillRatios || !cfg || cfg.type !== "choice") {
        updatedCellResults.push(cellResult)
        entries.push(
          buildEntryFromCellResult(
            cellResult,
            cfg,
            maxPoints,
            confidenceThreshold
          )
        )
        continue
      }

      // fillRatiosからareaThresholdで再判定
      const updatedCell = reevaluateChoiceCell(cellResult, cfg, areaThreshold)
      updatedCellResults.push(updatedCell)
      entries.push(
        buildEntryFromCellResult(
          updatedCell,
          cfg,
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
 * 選択式セルのfillRatiosから新しいareaThresholdで再判定する
 * markRecognizer.ts recognizeChoiceCell のfillRatio以降ロジックと同一
 */
function reevaluateChoiceCell(
  cellResult: OMRCellResult,
  cfg: CropRegionOmrConfigWithOptions,
  areaThreshold: number
): OMRCellResult {
  const fillRatios = cellResult.fillRatios!
  const correctAnswers = cfg.choiceOptions
    .filter((o) => o.isCorrect)
    .map((o) => o.choiceIndex)
  const labels = cfg.choiceOptions.map((o) => o.label)

  const markedIndices: number[] = []
  for (let i = 0; i < fillRatios.length; i++) {
    if (fillRatios[i] >= areaThreshold) {
      markedIndices.push(i)
    }
  }

  const recognizedValues = markedIndices.map(
    (idx) => labels[idx] ?? String(idx)
  )

  // 信頼度計算（markRecognizer.ts と同一）
  let confidence: number
  if (markedIndices.length === 0) {
    const maxRatio = Math.max(...fillRatios)
    confidence = 1 - maxRatio / areaThreshold
  } else if (markedIndices.length === 1) {
    const markedRatio = fillRatios[markedIndices[0]]
    const otherMaxRatio = Math.max(
      ...fillRatios.filter((_, i) => !markedIndices.includes(i)),
      0
    )
    confidence = Math.min(
      markedRatio / areaThreshold,
      1 - otherMaxRatio / areaThreshold
    )
    confidence = Math.max(0, Math.min(1, confidence))
  } else {
    confidence = 0.3
  }

  // 自動採点ステータス
  let autoScoreStatus: OMRCellResult["autoScoreStatus"]
  if (markedIndices.length === 0) {
    autoScoreStatus = "no_answer"
  } else if (markedIndices.length > correctAnswers.length) {
    autoScoreStatus = "ambiguous"
  } else {
    const isCorrect =
      markedIndices.length === correctAnswers.length &&
      markedIndices.every((idx) => correctAnswers.includes(idx))
    autoScoreStatus = isCorrect ? "correct" : "incorrect"
  }

  return {
    ...cellResult,
    recognizedValues,
    confidence,
    autoScoreStatus,
  }
}

/**
 * OMRCellResultからAutoScoreEntryを構築（部分点・低信頼チェック含む）
 */
function buildEntryFromCellResult(
  cellResult: OMRCellResult,
  cfg: CropRegionOmrConfigWithOptions | undefined,
  maxPoints: number,
  confidenceThreshold: number
): AutoScoreEntry {
  const cropRegionId = cellResult.label
  let status: AutoScoreEntry["status"]
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
    cfg?.type === "choice" &&
    status === "incorrect" &&
    cellResult.recognizedValues.length > 0
  ) {
    const correctLabels = cfg.choiceOptions
      .filter((o) => o.isCorrect)
      .map((o) => o.label)
    if (correctLabels.length > 1) {
      const correctCount = cellResult.recognizedValues.filter((v) =>
        correctLabels.includes(v)
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
  allEntries: Map<string, AutoScoreEntry[]>
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

/**
 * 全シートのfillRatio分布から最適なareaThresholdを推奨する
 *
 * 全セルのfillRatioをフラットに収集し、ソート済み配列の[0.05, 0.85]区間で
 * 隣接値間の最大ギャップを探索、ギャップの中点を推奨閾値とする。
 */
export function recommendAreaThreshold(
  sheetResults: OMRSheetResult[]
): number | null {
  const allRatios: number[] = []

  for (const sheet of sheetResults) {
    if (!sheet.success) continue
    for (const cell of sheet.cellResults) {
      if (cell.fillRatios) {
        allRatios.push(...cell.fillRatios)
      }
    }
  }

  if (allRatios.length < 2) return null

  const sorted = allRatios
    .filter((r) => r >= 0.05 && r <= 0.85)
    .sort((a, b) => a - b)

  if (sorted.length < 2) return null

  let maxGap = 0
  let gapMidpoint = 0.4

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i]
    if (gap > maxGap) {
      maxGap = gap
      gapMidpoint = (sorted[i] + sorted[i + 1]) / 2
    }
  }

  // ギャップが小さすぎる場合は推奨不可
  if (maxGap < 0.05) return null

  return Math.round(gapMidpoint * 100) / 100
}
