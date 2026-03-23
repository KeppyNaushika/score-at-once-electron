import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Minus,
  X,
} from "lucide-react"

import type { ScoringStatusColors } from "@/lib/scoringStatusColors"

/**
 * 動的な採点状態色設定を生成
 *
 * @param colors - 採点状態色（useScoringStatusColorsから取得）
 * @returns 採点状態ごとのスタイル設定オブジェクト
 */
export function getDynamicScoreStatusConfig(colors: ScoringStatusColors) {
  return {
    unscored: {
      icon: Circle,
      bgStyle: { backgroundColor: colors.unscored.bg },
      selectedBgStyle: { backgroundColor: colors.unscored.bg, opacity: 0.8 },
      textStyle: { color: colors.unscored.text },
      iconStyle: { color: colors.unscored.icon },
      key: "q",
    },
    correct: {
      icon: CheckCircle,
      bgStyle: { backgroundColor: colors.correct.bg },
      selectedBgStyle: { backgroundColor: colors.correct.bg, opacity: 0.8 },
      textStyle: { color: colors.correct.text },
      iconStyle: { color: colors.correct.icon },
      key: "e",
    },
    partial: {
      icon: AlertTriangle,
      bgStyle: { backgroundColor: colors.partial.bg },
      selectedBgStyle: { backgroundColor: colors.partial.bg, opacity: 0.8 },
      textStyle: { color: colors.partial.text },
      iconStyle: { color: colors.partial.icon },
      key: "f",
    },
    pending: {
      icon: Clock,
      bgStyle: { backgroundColor: colors.pending.bg },
      selectedBgStyle: { backgroundColor: colors.pending.bg, opacity: 0.8 },
      textStyle: { color: colors.pending.text },
      iconStyle: { color: colors.pending.icon },
      key: "j",
    },
    incorrect: {
      icon: X,
      bgStyle: { backgroundColor: colors.incorrect.bg },
      selectedBgStyle: { backgroundColor: colors.incorrect.bg, opacity: 0.8 },
      textStyle: { color: colors.incorrect.text },
      iconStyle: { color: colors.incorrect.icon },
      key: "o",
    },
    no_answer: {
      icon: Minus,
      bgStyle: { backgroundColor: colors.no_answer.bg },
      selectedBgStyle: { backgroundColor: colors.no_answer.bg, opacity: 0.8 },
      textStyle: { color: colors.no_answer.text },
      iconStyle: { color: colors.no_answer.icon },
      key: "p",
    },
    double_mark: {
      icon: CopyX,
      bgStyle: { backgroundColor: colors.double_mark.bg },
      selectedBgStyle: { backgroundColor: colors.double_mark.bg, opacity: 0.8 },
      textStyle: { color: colors.double_mark.text },
      iconStyle: { color: colors.double_mark.icon },
      key: "t",
    },
    master: {
      icon: CheckCircle,
      bgStyle: { backgroundColor: "#EFF6FF" }, // blue-50 固定
      selectedBgStyle: { backgroundColor: "#DBEAFE" }, // blue-100 固定
      textStyle: { color: "#1E40AF" }, // blue-800 固定
      iconStyle: { color: "#1E40AF" },
      key: "",
    },
  }
}

export type DynamicScoreStatusConfig = ReturnType<
  typeof getDynamicScoreStatusConfig
>
export type ScoreStatusKey = keyof DynamicScoreStatusConfig
