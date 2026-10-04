import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toTableColumns } from "@/types/individualReport.types"

import {
  OptionCard,
  OptionCardWithChildren,
  Section,
} from "./ReportOptionControls"
import type { ReportSettingsSectionProps } from "./types"

/** 設問の表と学習アドバイス */
export function QuestionSettingsSection({
  options,
  updateOption,
}: ReportSettingsSectionProps) {
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
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <Label className="text-xs whitespace-nowrap">列数</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  className="h-6 flex-1 text-xs"
                  value={options.questionTableColumns}
                  onChange={(e) => {
                    const value = Math.min(
                      10,
                      Math.max(1, Number(e.target.value))
                    )
                    updateOption("questionTableColumns", toTableColumns(value))
                  }}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <Label className="text-xs whitespace-nowrap">文字</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-6 flex-1 text-xs"
                  value={options.questionTableFontSize}
                  onChange={(e) => {
                    const value = Math.max(1, Number(e.target.value))
                    if (!isNaN(value)) {
                      updateOption("questionTableFontSize", value)
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
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
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <Label className="text-xs whitespace-nowrap">正答率</Label>
                <Input
                  type="text"
                  className="h-6 flex-1 text-xs"
                  placeholder="なし"
                  value={options.adviceOptions.reviewRateMin ?? ""}
                  onChange={(e) => {
                    const inputValue = e.target.value
                    if (inputValue === "") {
                      updateOption("adviceOptions", {
                        ...options.adviceOptions,
                        reviewRateMin: null,
                      })
                    } else {
                      const parsedValue = Number(inputValue)
                      if (!isNaN(parsedValue)) {
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          reviewRateMin: parsedValue,
                        })
                      }
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">%以上</span>
                <Input
                  type="text"
                  className="h-6 flex-1 text-xs"
                  placeholder="なし"
                  value={options.adviceOptions.reviewRateMax ?? ""}
                  onChange={(e) => {
                    const inputValue = e.target.value
                    if (inputValue === "") {
                      updateOption("adviceOptions", {
                        ...options.adviceOptions,
                        reviewRateMax: null,
                      })
                    } else {
                      const parsedValue = Number(inputValue)
                      if (!isNaN(parsedValue)) {
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          reviewRateMax: parsedValue,
                        })
                      }
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">%以下</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <Label className="text-xs whitespace-nowrap">問題数</Label>
                <Input
                  type="text"
                  className="h-6 flex-1 text-xs"
                  placeholder="全て"
                  value={options.adviceOptions.reviewQuestionCount ?? ""}
                  onChange={(e) => {
                    const inputValue = e.target.value
                    if (inputValue === "") {
                      updateOption("adviceOptions", {
                        ...options.adviceOptions,
                        reviewQuestionCount: null,
                      })
                    } else {
                      const parsedValue = Number(inputValue)
                      if (!isNaN(parsedValue)) {
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          reviewQuestionCount: parsedValue,
                        })
                      }
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">問</span>
              </div>
            </div>
          )}
        </OptionCardWithChildren>
      </div>
    </Section>
  )
}
