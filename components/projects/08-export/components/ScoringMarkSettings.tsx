"use client"

import { ScoringMarkSettingsContainer } from "@/components/projects/08-export/components/scoring-mark-settings/components/ScoringMarkSettingsContainer"
import type { ScoringMarkConfig } from "@/components/projects/08-export/components/scoring-mark-settings/types/scoringMarkTypes"

// Re-export types for backward compatibility
export {
  defaultPartialScoreConfig,
  defaultConfig as defaultScoringMarkConfig,
  defaultSummaryScoreConfig,
} from "@/components/projects/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
export type {
  MarkPosition,
  PageOrientation,
  PageSize,
  ScoreTextConfig,
  ScoringMarkConfig,
  ScoringStatus,
  TextAlignment,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoringMarkTypes"

interface ScoringMarkSettingsProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export default function ScoringMarkSettings(props: ScoringMarkSettingsProps) {
  return <ScoringMarkSettingsContainer {...props} />
}
