"use client"

import {
  CircleOff,
  type LucideIcon,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react"

import {
  FilterToggleButton,
  type FilterToggleColors,
} from "@/components/exams/07-score-at-once/ScoringSidePanel/FilterToggleButton"
import { GRID_4_3_STYLE } from "@/components/exams/07-score-at-once/ScoringSidePanel/scoringToolbarButtons"

import {
  CONFIDENCE_FILTER_LABELS,
  CONFIDENCE_FILTER_LEVELS,
  type ConfidenceFilterLevel,
} from "./utils/aiGridFilter"

const CONFIDENCE_FILTER_ICONS: Record<ConfidenceFilterLevel, LucideIcon> = {
  high: SignalHigh,
  medium: SignalMedium,
  low: SignalLow,
  none: CircleOff,
}

/**
 * 確信度の色。採点状態の7色と取り違えないよう、高→低を青緑・琥珀（札の「中」「低」と同じ系統）・
 * 薔薇で段階にし、判定なしは灰色にする
 */
const CONFIDENCE_FILTER_COLORS: Record<
  ConfidenceFilterLevel,
  FilterToggleColors
> = {
  high: { bg: "#CCFBF1", text: "#115E59", icon: "#0D9488" },
  medium: { bg: "#FEF3C7", text: "#92400E", icon: "#D97706" },
  low: { bg: "#FFE4E6", text: "#9F1239", icon: "#E11D48" },
  none: { bg: "#F3F4F6", text: "#374151", icon: "#6B7280" },
}

interface AiConfidenceFilterButtonsProps {
  confidenceSettings: Record<ConfidenceFilterLevel, boolean>
  onToggle: (level: ConfidenceFilterLevel) => void
}

/** AI の判定の確信度の絞り込み（採点状態の絞り込みと同じ形のボタン。キーは無い） */
export function AiConfidenceFilterButtons({
  confidenceSettings,
  onToggle,
}: AiConfidenceFilterButtonsProps) {
  return (
    <div style={GRID_4_3_STYLE} role="group" aria-label="確信度の絞り込み">
      {CONFIDENCE_FILTER_LEVELS.map((level) => (
        <FilterToggleButton
          key={level}
          label={CONFIDENCE_FILTER_LABELS[level]}
          icon={CONFIDENCE_FILTER_ICONS[level]}
          colors={CONFIDENCE_FILTER_COLORS[level]}
          isActive={confidenceSettings[level]}
          onToggle={() => onToggle(level)}
        />
      ))}
    </div>
  )
}
