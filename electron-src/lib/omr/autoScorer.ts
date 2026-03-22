/**
 * OMR自動採点モジュール
 *
 * OMR認識結果を既存のQuestionScore APIを通じて採点データとして書き込む。
 */

import type {
  CropRegionOmrConfigWithOptions,
  OMRCellConfig,
  OMRCellResult,
} from "../../../src/types/omr.types"

export interface AutoScoreEntry {
  /** CropRegionラベル（QuestionScore特定用） */
  label: string
  /** CropRegion ID（DB直接参照用） */
  cropRegionId?: string
  questionPath: number[]
  /** 認識されたステータス */
  status: "correct" | "incorrect" | "partial" | "no_answer" | "ambiguous"
  /** 得点 */
  score: number
  /** 満点 */
  maxPoints: number
  /** 認識された回答値 */
  recognizedValues: string[]
}

/**
 * OMR認識結果を採点エントリに変換
 *
 * @param cellResults OMR認識結果の配列
 * @param cellConfigs セルパスキー→設定のマップ
 * @param pointsMap セルパスキー→配点のマップ
 */
export function convertToScoreEntries(
  cellResults: OMRCellResult[],
  cellConfigs: Record<string, OMRCellConfig>,
  pointsMap: Record<string, number>
): AutoScoreEntry[] {
  return cellResults.map((result) => {
    const configKey = result.questionPath.join("-")
    const config = cellConfigs[configKey]
    const maxPoints = pointsMap[configKey] ?? 0

    let status: AutoScoreEntry["status"]
    let score: number

    switch (result.autoScoreStatus) {
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
        status = "ambiguous"
        score = 0
        break
      default:
        status = "no_answer"
        score = 0
    }

    // 複数正解の部分点（choiceで複数正解の場合）
    if (
      config?.type === "choice" &&
      config.correctAnswers.length > 1 &&
      result.recognizedValues.length > 0 &&
      result.autoScoreStatus === "incorrect"
    ) {
      const correctCount = result.recognizedValues.filter((v) => {
        const idx = config.labels.indexOf(v)
        return idx !== -1 && config.correctAnswers.includes(idx)
      }).length
      if (correctCount > 0 && correctCount < config.correctAnswers.length) {
        status = "partial"
        score = Math.floor(
          (maxPoints * correctCount) / config.correctAnswers.length
        )
      }
    }

    return {
      label: result.label,
      questionPath: result.questionPath,
      status,
      score,
      maxPoints,
      recognizedValues: result.recognizedValues,
    }
  })
}

/**
 * DB管理のCropRegionOmrConfigベースでOMR認識結果を採点エントリに変換
 *
 * @param cellResults OMR認識結果（cropRegionIdをkeyとする）
 * @param omrConfigs DB取得のOMR設定配列
 * @param cropRegionPointsMap cropRegionId → 配点のマップ
 */
export function convertToScoreEntriesFromDb(
  cellResults: OMRCellResult[],
  omrConfigs: CropRegionOmrConfigWithOptions[],
  cropRegionPointsMap: Record<string, number>
): AutoScoreEntry[] {
  // omrConfigをcropRegionIdでインデックス化
  const configMap = new Map(omrConfigs.map((c) => [c.cropRegionId, c]))

  return cellResults.map((result) => {
    // resultのlabelにはcropRegionIdが格納されている前提
    const cropRegionId = result.label
    const config = configMap.get(cropRegionId)
    const maxPoints = cropRegionPointsMap[cropRegionId] ?? 0

    let status: AutoScoreEntry["status"]
    let score: number

    switch (result.autoScoreStatus) {
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
        status = "ambiguous"
        score = 0
        break
      default:
        status = "no_answer"
        score = 0
    }

    // 複数正解の部分点
    if (
      config?.type === "choice" &&
      result.autoScoreStatus === "incorrect" &&
      result.recognizedValues.length > 0
    ) {
      const correctLabels = config.choiceOptions
        .filter((opt) => opt.isCorrect)
        .map((opt) => opt.label)

      if (correctLabels.length > 1) {
        const correctCount = result.recognizedValues.filter((v) =>
          correctLabels.includes(v)
        ).length
        if (correctCount > 0 && correctCount < correctLabels.length) {
          status = "partial"
          score = Math.floor((maxPoints * correctCount) / correctLabels.length)
        }
      }
    }

    return {
      label: result.label,
      cropRegionId,
      questionPath: result.questionPath,
      status,
      score,
      maxPoints,
      recognizedValues: result.recognizedValues,
    }
  })
}
