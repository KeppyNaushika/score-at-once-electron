"use client"

import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  Minus,
  X,
} from "lucide-react"

import {
  getScoringStatusColors,
  SCORING_STATUS_LABELS,
  type ScoringStatusType,
} from "@/lib/scoringStatusColors"

type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

// ScoringStatus -> ScoringStatusType へのマッピング
function toScoringStatusType(status: ScoringStatus): ScoringStatusType {
  switch (status) {
    case "correct":
      return "correct"
    case "incorrect":
      return "incorrect"
    case "partial":
      return "partial"
    case "pending":
      return "pending"
    case "no_answer":
      return "no_answer"
    case "ungraded":
    case "proposed":
    case "final":
    default:
      return "ungraded"
  }
}

interface StatusIconProps {
  status: ScoringStatus
  className?: string
  /** 動的色を使用するかどうか（デフォルト: false - Tailwindクラス使用） */
  useDynamicColors?: boolean
}

/**
 * アイコンコンポーネントのマッピング
 */
const STATUS_ICONS = {
  correct: CheckCircle,
  incorrect: X,
  partial: Circle,
  pending: Clock,
  no_answer: Minus,
  ungraded: AlertTriangle,
} as const

export function StatusIcon({
  status,
  className = "h-4 w-4",
  useDynamicColors = false,
}: StatusIconProps) {
  const statusType = toScoringStatusType(status)
  const Icon = STATUS_ICONS[statusType]

  if (useDynamicColors) {
    const colors = getScoringStatusColors()
    return (
      <Icon className={className} style={{ color: colors[statusType].icon }} />
    )
  }

  // 既存のTailwindクラス（後方互換性のため）
  const tailwindColors: Record<ScoringStatusType, string> = {
    correct: "text-green-600",
    incorrect: "text-red-600",
    partial: "text-yellow-600",
    pending: "text-blue-600",
    no_answer: "text-violet-600",
    ungraded: "text-gray-400",
  }

  return <Icon className={`${tailwindColors[statusType]} ${className}`} />
}

/**
 * ステータスの背景色とテキスト色を取得
 * @param status - 採点状態
 * @param useDynamicColors - 動的色を使用するかどうか
 * @returns Tailwindクラス文字列またはCSSスタイルオブジェクト
 */
export function getStatusColor(
  status: ScoringStatus,
  useDynamicColors = false
): string | React.CSSProperties {
  const statusType = toScoringStatusType(status)

  if (useDynamicColors) {
    const colors = getScoringStatusColors()
    return {
      backgroundColor: colors[statusType].bg,
      color: colors[statusType].text,
    }
  }

  // 既存のTailwindクラス（後方互換性のため）
  const tailwindColors: Record<ScoringStatusType, string> = {
    correct: "bg-green-100 text-green-800",
    incorrect: "bg-red-100 text-red-800",
    partial: "bg-yellow-100 text-yellow-800",
    pending: "bg-blue-100 text-blue-800",
    no_answer: "bg-violet-100 text-violet-800",
    ungraded: "bg-gray-50 text-gray-600",
  }

  return tailwindColors[statusType]
}

/**
 * ステータスのラベルを取得
 */
export function getStatusLabel(status: ScoringStatus): string {
  const statusType = toScoringStatusType(status)
  return SCORING_STATUS_LABELS[statusType]
}
