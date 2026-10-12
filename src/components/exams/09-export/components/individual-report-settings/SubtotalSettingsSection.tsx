import {
  OptionCard,
  OptionCardWithChildren,
  Section,
} from "@/components/common/ReportOptionControls"

import { SubtotalGroupSelector } from "../individual-report/SubtotalGroupSelector"
import { BoxPlotSettings } from "./BoxPlotSettings"
import { TableLayoutFields } from "./TableLayoutFields"
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
              <TableLayoutFields
                tableColumns={options.subtotalTableColumns}
                fontSize={options.subtotalTableFontSize}
                onTableColumnsChange={(tableColumns) =>
                  updateOption("subtotalTableColumns", tableColumns)
                }
                onFontSizeChange={(fontSize) =>
                  updateOption("subtotalTableFontSize", fontSize)
                }
              />
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
