"use client"

import { ScoringMarkSettingsContainer } from "@/components/exams/08-export/components/scoring-mark-settings/components/ScoringMarkSettingsContainer"
import type { ScoringMarkConfig } from "@/components/exams/08-export/components/scoring-mark-settings/types"

// Re-export types for backward compatibility
export {
  defaultPartialScoreConfig,
  defaultConfig as defaultScoringMarkConfig,
  defaultSummaryScoreConfig,
} from "@/components/exams/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
export type {
  MarkPosition,
  PageOrientation,
  PageSize,
  ScoreTextConfig,
  ScoringMarkConfig,
  TextAlignment,
} from "@/components/exams/08-export/components/scoring-mark-settings/types"

interface ScoringMarkSettingsProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export default function ScoringMarkSettings(props: ScoringMarkSettingsProps) {
  return <ScoringMarkSettingsContainer {...props} />
}
