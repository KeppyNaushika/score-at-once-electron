import {
  OptionCard,
  OptionCardWithChildren,
  OptionField,
  Section,
} from "@/components/common/ReportOptionControls"
import { ScaleValueDisplayField } from "@/components/common/ScaleValueDisplayField"
import { Input } from "@/components/ui/input"
import { useEditingInput } from "@/hooks/useEditingInput"

import { TableLayoutFields } from "./TableLayoutFields"
import type { ReportSettingsSectionProps } from "./types"

/** 設問の表と学習アドバイス */
export function QuestionSettingsSection({
  options,
  updateOption,
}: ReportSettingsSectionProps) {
  const editing = useEditingInput()

  /** 学習アドバイスの数値欄。空は「指定なし」（null）、数にできない途中は書かない */
  const editingAdviceNumber = (
    field: "reviewRateMin" | "reviewRateMax" | "reviewQuestionCount"
  ) =>
    editing(field, String(options.adviceOptions[field] ?? ""), (text) => {
      if (text.trim() === "") {
        updateOption("adviceOptions", {
          ...options.adviceOptions,
          [field]: null,
        })
        return
      }
      const parsedValue = Number(text)
      if (Number.isFinite(parsedValue)) {
        updateOption("adviceOptions", {
          ...options.adviceOptions,
          [field]: parsedValue,
        })
      }
    })

  return (
    <Section title="設問関連">
      <div className="flex flex-col gap-2">
        <OptionCardWithChildren
          label="設問の表"
          checked={options.showQuestionTable}
          onChange={(value) => updateOption("showQuestionTable", value)}
        >
          {options.showQuestionTable && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <OptionCard
                  label="マルバツ表示"
                  checked={options.showMarks}
                  onChange={(value) => updateOption("showMarks", value)}
                  variant="sub"
                />
                <OptionCard
                  label="正答率"
                  checked={options.showCorrectRate}
                  onChange={(value) => updateOption("showCorrectRate", value)}
                  variant="sub"
                />
                <OptionCard
                  label="得点率"
                  checked={options.showScoreRate ?? false}
                  onChange={(value) => updateOption("showScoreRate", value)}
                  variant="sub"
                />
              </div>
              <ScaleValueDisplayField
                display={options.scaleValueDisplay}
                onDisplayChange={(scaleValueDisplay) =>
                  updateOption("scaleValueDisplay", scaleValueDisplay)
                }
              />
              <TableLayoutFields
                tableColumns={options.questionTableColumns}
                fontSize={options.questionTableFontSize}
                onTableColumnsChange={(tableColumns) =>
                  updateOption("questionTableColumns", tableColumns)
                }
                onFontSizeChange={(fontSize) =>
                  updateOption("questionTableFontSize", fontSize)
                }
              />
            </div>
          )}
        </OptionCardWithChildren>

        <OptionCardWithChildren
          label="学習アドバイス"
          checked={options.showLearningAdvice}
          onChange={(value) => updateOption("showLearningAdvice", value)}
        >
          {options.showLearningAdvice && (
            <div className="mt-2 flex flex-col gap-2">
              <OptionField label="正答率">
                <Input
                  type="text"
                  className="h-6 flex-1 text-xs"
                  placeholder="なし"
                  {...editingAdviceNumber("reviewRateMin")}
                />
                <span className="text-xs text-muted-foreground">%以上</span>
                <Input
                  type="text"
                  className="h-6 flex-1 text-xs"
                  placeholder="なし"
                  {...editingAdviceNumber("reviewRateMax")}
                />
                <span className="text-xs text-muted-foreground">%以下</span>
              </OptionField>
              <OptionField label="問題数">
                <Input
                  type="text"
                  className="h-6 flex-1 text-xs"
                  placeholder="全て"
                  {...editingAdviceNumber("reviewQuestionCount")}
                />
                <span className="text-xs text-muted-foreground">問</span>
              </OptionField>
            </div>
          )}
        </OptionCardWithChildren>
      </div>
    </Section>
  )
}
