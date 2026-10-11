/**
 * 答案・判定を画面に出すときの文字列（表示のときだけ求める）。
 */

import { toAppImageUrl } from "@/lib/appImageUrl"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { AiGradingAnswer } from "../types"

/** 答案画像の URL（採点画面と同じ `appimg://`） */
export function answerImageUrl(
  studentAnswerImage: AiGradingAnswer["studentAnswerImage"]
): string {
  return studentAnswerImage.imagePath
    ? toAppImageUrl(studentAnswerImage.imagePath)
    : ""
}

/** 生徒の氏名（採点画面と同じ並び） */
export function studentDisplayName(
  studentAnswerImage: AiGradingAnswer["studentAnswerImage"]
): string {
  const { student } = studentAnswerImage.examStudent
  return `${student.lastName} ${student.firstName}`
}

/** 判定を「部分点 3点」のような文にする */
export function describeJudgement(
  status: ScoringStatus,
  partialScore: number | null
): string {
  const label = SCORING_STATUS_LABELS[status]
  return (status === "partial" || status === "pending") && partialScore !== null
    ? `${label} ${partialScore}点`
    : label
}

/** 確信度 */
export function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "high":
      return "高"
    case "medium":
      return "中"
    case "low":
      return "低"
    default:
      return "—"
  }
}

/** 日時を短く（月/日 時:分） */
export function formatShortDateTime(dateTime: Date | string): string {
  return new Date(dateTime).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
