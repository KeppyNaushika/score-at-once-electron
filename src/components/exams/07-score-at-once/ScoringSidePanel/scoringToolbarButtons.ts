import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Minus,
  MousePointerClick,
  X,
} from "lucide-react"

import type { MouseBrushAction } from "@/components/exams/07-score-at-once/types"
import type { ClickScoringAction } from "@/types/clickScoring.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

export const STATUS_MAP: Record<ScoringStatus, ScoringStatus> = {
  unscored: "unscored",
  correct: "correct",
  partial: "partial",
  pending: "pending",
  incorrect: "incorrect",
  no_answer: "no_answer",
  double_mark: "double_mark",
}

export const SCORING_BUTTONS = [
  {
    status: "unscored",
    label: "未採点",
    icon: Circle,
    description: "未採点にする",
  },
  {
    status: "correct",
    label: "正答",
    icon: CheckCircle,
    description: "正答にする",
  },
  {
    status: "partial",
    label: "部分点",
    icon: AlertTriangle,
    description: "部分点にする",
  },
  {
    status: "pending",
    label: "保留",
    icon: Clock,
    description: "保留にする",
  },
  {
    status: "incorrect",
    label: "誤答",
    icon: X,
    description: "誤答にする",
  },
  {
    status: "no_answer",
    label: "無答",
    icon: Minus,
    description: "無答にする",
  },
  {
    status: "double_mark",
    label: "Wマーク",
    icon: CopyX,
    description: "ダブルマークにする",
  },
] as const

/** マウスモード用ブラシ（unscoredを除く） */
export const BRUSH_BUTTONS = SCORING_BUTTONS.filter(
  (
    button
  ): button is Extract<
    (typeof SCORING_BUTTONS)[number],
    { status: MouseBrushAction }
  > => button.status !== "unscored"
)

/** マウスモード用の特殊ブラシ（採点せず選択／モーダル展開） */
const SPECIAL_BRUSH_BUTTONS: Array<{
  status: MouseBrushAction
  label: string
  icon: typeof CheckCircle
  description: string
}> = [
  {
    status: "select",
    label: "選択",
    icon: MousePointerClick,
    description: "クリックで選択（複数選択可）",
  },
  {
    status: "partial_modal",
    label: "部分点入力",
    icon: Calculator,
    description: "クリックで部分点入力モーダルを開く",
  },
]

/** マウスモードのブラシ選択に並べる順（特殊ブラシ → 採点ブラシ） */
export const MOUSE_BRUSH_BUTTONS = [...SPECIAL_BRUSH_BUTTONS, ...BRUSH_BUTTONS]

/** ブラシ選択の選択肢（ボタンの並びと同じ順） */
export const MOUSE_BRUSH_ACTIONS = MOUSE_BRUSH_BUTTONS.map(
  (button) => button.status
)

export const CLICK_ACTION_OPTIONS: {
  value: ClickScoringAction
  label: string
}[] = [
  { value: "none", label: "なし" },
  { value: "correct", label: "正答" },
  { value: "incorrect", label: "誤答" },
  { value: "partial_modal", label: "部分点入力" },
  { value: "partial", label: "部分点（非推奨）" },
  { value: "pending", label: "保留（非推奨）" },
  { value: "unscored", label: "未採点" },
  { value: "no_answer", label: "無答" },
  { value: "double_mark", label: "Wマーク" },
  { value: "individual", label: "個別表示" },
]

export const GRID_4_3_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "0.5rem",
} as const
