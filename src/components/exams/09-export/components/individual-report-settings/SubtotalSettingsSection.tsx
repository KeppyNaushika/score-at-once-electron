import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toTableColumns } from "@/types/individualReport.types"

import { SubtotalGroupSelector } from "../individual-report/SubtotalGroupSelector"
import { BoxPlotSettings } from "./BoxPlotSettings"
import {
  OptionCard,
  OptionCardWithChildren,
  Section,
} from "./ReportOptionControls"
import type { ReportSettingsSectionProps } from "./types"

interface SubtotalSettingsSectionProps extends ReportSettingsSectionProps {
  examId: string
}

/** 小計点の表と箱ひげ図 */
export function SubtotalSettingsSection({
  examId,
  options,
  updateOption,
}: SubtotalSettingsSectionProps) {
  return (
    <Section title="小計点関連">
      <div className="flex flex-col gap-2">
        {/* 共通オプション */}
        <OptionCard
          label="設問と関連付けのない小計点を非表示"
          checked={options.hideUnassignedSubtotals}
          onChange={(value) => updateOption("hideUnassignedSubtotals", value)}
        />

        {/* 小計点の表 */}
        <OptionCardWithChildren
          label="小計点の表"
          checked={options.showSubtotalTable}
          onChange={(value) => updateOption("showSubtotalTable", value)}
        >
          {options.showSubtotalTable && (
            <div className="mt-2 flex flex-col gap-4">
              <SubtotalGroupSelector
                examId={examId}
                selection={options.tableSubtotalGroupSelection}
                onChange={(selection) =>
                  updateOption("tableSubtotalGroupSelection", selection)
                }
              />
              <OptionCard
                label="グループごとの小計"
                checked={options.showGroupSubtotals}
                onChange={(value) => updateOption("showGroupSubtotals", value)}
                variant="sub"
              />
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <Label className="text-xs whitespace-nowrap">列数</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  className="h-6 flex-1 text-xs"
                  value={options.subtotalTableColumns}
                  onChange={(e) => {
                    const value = Math.min(
                      10,
                      Math.max(1, Number(e.target.value))
                    )
                    updateOption("subtotalTableColumns", toTableColumns(value))
                  }}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <Label className="text-xs whitespace-nowrap">文字</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-6 flex-1 text-xs"
                  value={options.subtotalTableFontSize}
                  onChange={(e) => {
                    const value = Math.max(1, Number(e.target.value))
                    if (!isNaN(value)) {
                      updateOption("subtotalTableFontSize", value)
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            </div>
          )}
        </OptionCardWithChildren>

        <BoxPlotSettings
          examId={examId}
          options={options}
          updateOption={updateOption}
        />
      </div>
    </Section>
  )
}
