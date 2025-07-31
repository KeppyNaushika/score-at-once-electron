"use client"

import { ScoringMarkSettingsContainer } from "@/components/projects/08-export/components/scoring-mark-settings/components/ScoringMarkSettingsContainer"

// Re-export types for backward compatibility
export type {
  ScoringStatus,
  MarkPosition,
  TextAlignment,
  PageSize,
  PageOrientation,
  ScoringMarkConfig,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoring-mark-types"

// Re-export utilities
export {
  loadConfigFromStorage,
  saveConfigToStorage,
} from "@/components/projects/08-export/components/scoring-mark-settings/utils/scoring-mark-utils"

export { defaultConfig as defaultScoringMarkConfig } from "@/components/projects/08-export/components/scoring-mark-settings/constants/scoring-mark-constants"

interface ScoringMarkSettingsProps {
  config: any
  onChange: (config: any) => void
}

export default function ScoringMarkSettings(props: ScoringMarkSettingsProps) {
  return <ScoringMarkSettingsContainer {...props} />
}
