"use client"

import { ExportOptions } from "../../../app/projects/[projectId]/07-export/types"
import ScoringMarkSettings, { ScoringMarkConfig } from "./ScoringMarkSettings"

interface ExportOptionsCardProps {
  exportOptions: ExportOptions
  setExportOptions: (options: ExportOptions) => void
  scoringMarkConfig: ScoringMarkConfig
  setScoringMarkConfig: (config: ScoringMarkConfig) => void
}

export function ExportOptionsCard({
  exportOptions,
  setExportOptions,
  scoringMarkConfig,
  setScoringMarkConfig,
}: ExportOptionsCardProps) {
  return (
    <div className="space-y-4">
      {/* 採点マーク設定を常に表示 */}
      <ScoringMarkSettings
        config={scoringMarkConfig}
        onChange={setScoringMarkConfig}
      />
    </div>
  )
}
