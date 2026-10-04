import { Label } from "@/components/ui/label"
import type {
  StatisticKind,
  StatisticScope,
} from "@/types/individualReport.types"
import {
  STATISTIC_KINDS,
  STATISTIC_SCOPES,
} from "@/types/individualReport.types"

import { OptionCard, Section } from "./ReportOptionControls"
import type { ReportSettingsSectionProps } from "./types"

/** 統計種別の見出し */
const STATISTIC_KIND_LABELS: Record<StatisticKind, string> = {
  average: "平均",
  deviation: "偏差値",
  rank: "順位",
  boxPlot: "得点分布",
}

/** 母集団の見出し。学級は複数ありうるため「所属学級」と複数を含意する語にする */
const STATISTIC_SCOPE_LABELS: Record<StatisticScope, string> = {
  classroom: "所属学級",
  overall: "全体",
}

/** 基本表示（点数）と、統計の「種別 × 母集団」・統計に含める受験状態 */
export function StatisticsSettingsSection({
  options,
  updateOption,
}: ReportSettingsSectionProps) {
  return (
    <Section title="基本表示/統計情報">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <OptionCard
          label="点数"
          checked={options.showScore}
          onChange={(value) => updateOption("showScore", value)}
        />
      </div>

      {/* 統計は「種別 × 母集団」で選ぶ。学級は複数ありうるので所属学級それぞれに出る */}
      <div className="mt-2 flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">
          統計（所属学級ごと／全体）
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATISTIC_KINDS.map((statisticKind) => (
            <div key={statisticKind} className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {STATISTIC_KIND_LABELS[statisticKind]}
              </Label>
              {STATISTIC_SCOPES.map((scope) => (
                <OptionCard
                  key={scope}
                  label={STATISTIC_SCOPE_LABELS[scope]}
                  checked={options.statistics[statisticKind][scope]}
                  onChange={(shown) =>
                    updateOption("statistics", {
                      ...options.statistics,
                      [statisticKind]: {
                        ...options.statistics[statisticKind],
                        [scope]: shown,
                      },
                    })
                  }
                  variant="sub"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* 統計に含める受験状態 */}
      <div className="mt-2 flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">
          統計に含める受験状態
        </Label>
        <div className="flex flex-wrap gap-2">
          <OptionCard
            label="受験"
            checked={options.boxPlotIncludeStatuses.participating}
            onChange={(value) =>
              updateOption("boxPlotIncludeStatuses", {
                ...options.boxPlotIncludeStatuses,
                participating: value,
              })
            }
            variant="sub"
          />
          <OptionCard
            label="見込"
            checked={options.boxPlotIncludeStatuses.expected}
            onChange={(value) =>
              updateOption("boxPlotIncludeStatuses", {
                ...options.boxPlotIncludeStatuses,
                expected: value,
              })
            }
            variant="sub"
          />
          <OptionCard
            label="欠席"
            checked={options.boxPlotIncludeStatuses.absent}
            onChange={(value) =>
              updateOption("boxPlotIncludeStatuses", {
                ...options.boxPlotIncludeStatuses,
                absent: value,
              })
            }
            variant="sub"
          />
        </div>
      </div>
    </Section>
  )
}
