"use client"

import { ScoringMarkSettingsContainer } from "@/components/projects/08-export/components/scoring-mark-settings/components/ScoringMarkSettingsContainer"
import type { ScoringMarkConfig } from "@/components/projects/08-export/components/scoring-mark-settings/types/scoringMarkTypes"

// Re-export types for backward compatibility
export type {
  ScoringStatus,
  MarkPosition,
  TextAlignment,
  PageSize,
  PageOrientation,
  ScoringMarkConfig,
  ScoreTextConfig,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoringMarkTypes"

export {
  defaultConfig as defaultScoringMarkConfig,
  defaultPartialScoreConfig,
  defaultSummaryScoreConfig,
} from "@/components/projects/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"

interface ScoringMarkSettingsProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export default function ScoringMarkSettings(props: ScoringMarkSettingsProps) {
  return <ScoringMarkSettingsContainer {...props} />
}
