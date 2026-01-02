import type { ScoringStatusColors } from "@/lib/scoringStatusColors"
import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  Minus,
  X,
} from "lucide-react"

// アイコンとキーバインドの定義（静的）
export const SCORE_STATUS_ICONS = {
  unscored: { icon: Circle, key: "q" },
  correct: { icon: CheckCircle, key: "e" },
  partial: { icon: AlertTriangle, key: "f" },
  pending: { icon: Clock, key: "j" },
  incorrect: { icon: X, key: "o" },
  no_answer: { icon: Minus, key: "p" },
  master: { icon: CheckCircle, key: "" },
} as const

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
      bgStyle: { backgroundColor: colors.ungraded.bg },
      selectedBgStyle: { backgroundColor: colors.ungraded.bg, opacity: 0.8 },
      textStyle: { color: colors.ungraded.text },
      iconStyle: { color: colors.ungraded.icon },
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

// 後方互換のため旧定義も維持（Tailwindクラスベース）
export const SCORE_STATUS_CONFIG = {
  unscored: {
    icon: Circle,
    borderColor: "border-gray-400",
    bgColor: "bg-gray-50",
    selectedBgColor: "bg-gray-100",
    textColor: "text-gray-600",
    key: "q",
  },
  correct: {
    icon: CheckCircle,
    borderColor: "border-green-500",
    bgColor: "bg-green-50",
    selectedBgColor: "bg-green-100",
    textColor: "text-green-700",
    key: "e",
  },
  partial: {
    icon: AlertTriangle,
    borderColor: "border-yellow-500",
    bgColor: "bg-yellow-50",
    selectedBgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    key: "f",
  },
  pending: {
    icon: Clock,
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50",
    selectedBgColor: "bg-blue-100",
    textColor: "text-blue-700",
    key: "j",
  },
  incorrect: {
    icon: X,
    borderColor: "border-red-500",
    bgColor: "bg-red-50",
    selectedBgColor: "bg-red-100",
    textColor: "text-red-700",
    key: "o",
  },
  no_answer: {
    icon: Minus,
    borderColor: "border-purple-500",
    bgColor: "bg-purple-50",
    selectedBgColor: "bg-purple-100",
    textColor: "text-purple-600",
    key: "p",
  },
  master: {
    icon: CheckCircle,
    borderColor: "border-blue-600",
    bgColor: "bg-blue-50",
    selectedBgColor: "bg-blue-100",
    textColor: "text-blue-800",
    key: "",
  },
} as const
