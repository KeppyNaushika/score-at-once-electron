import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SubtotalGroupSelector } from "../individual-report/SubtotalGroupSelector"
import { OptionCard, OptionCardWithChildren } from "./ReportOptionControls"
import type { ReportSettingsSectionProps } from "./types"

interface BoxPlotSettingsProps extends ReportSettingsSectionProps {
  examId: string
}

/** 箱ひげ図の表示と、図に載せる要素・大きさ */
export function BoxPlotSettings({
  examId,
  options,
  updateOption,
}: BoxPlotSettingsProps) {
  return (
    <OptionCardWithChildren
      label="箱ひげ図"
      checked={
        options.statistics.boxPlot.overall ||
        options.statistics.boxPlot.classroom
      }
      onChange={(value) =>
        updateOption("statistics", {
          ...options.statistics,
          // 全体側だけを操作する。所属学級側は上の統計グリッドが持つ
          boxPlot: { ...options.statistics.boxPlot, overall: value },
        })
      }
    >
      {(options.statistics.boxPlot.overall ||
        options.statistics.boxPlot.classroom) && (
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <OptionCard
              label="合計点"
              checked={options.graphOptions.showTotalScoreBoxPlot}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showTotalScoreBoxPlot: value,
                })
              }
              variant="sub"
            />
          </div>
          <SubtotalGroupSelector
            examId={examId}
            selection={options.boxPlotSubtotalGroupSelection}
            onChange={(selection) =>
              updateOption("boxPlotSubtotalGroupSelection", selection)
            }
          />
          <div className="flex flex-wrap gap-2">
            <OptionCard
              label="最小"
              checked={options.graphOptions.showBoxPlotMin}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBoxPlotMin: value,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="Q1"
              checked={options.graphOptions.showBoxPlotQ1}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBoxPlotQ1: value,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="中央値"
              checked={options.graphOptions.showBoxPlotMedian}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBoxPlotMedian: value,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="Q3"
              checked={options.graphOptions.showBoxPlotQ3}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBoxPlotQ3: value,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="最大"
              checked={options.graphOptions.showBoxPlotMax}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBoxPlotMax: value,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="平均線"
              checked={options.graphOptions.showAverageLine}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showAverageLine: value,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="あなたの得点"
              checked={options.graphOptions.showStudentMarker}
              onChange={(value) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showStudentMarker: value,
                })
              }
              variant="sub"
            />
          </div>
          {/* サイズ調整 */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
              <Label className="text-xs whitespace-nowrap">文字</Label>
              <Input
                type="number"
                min={6}
                max={16}
                className="h-6 w-16 text-xs"
                value={options.graphOptions.boxPlotFontSize ?? 11}
                onChange={(e) => {
                  const value = Math.min(
                    16,
                    Math.max(6, Number(e.target.value))
                  )
                  if (!isNaN(value)) {
                    updateOption("graphOptions", {
                      ...options.graphOptions,
                      boxPlotFontSize: value,
                    })
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
              <Label className="text-xs whitespace-nowrap">間隔</Label>
              <Input
                type="number"
                min={0}
                max={40}
                className="h-6 w-16 text-xs"
                value={options.graphOptions.boxPlotItemHeight ?? 20}
                onChange={(e) => {
                  const value = Math.min(
                    40,
                    Math.max(0, Number(e.target.value))
                  )
                  if (!isNaN(value)) {
                    updateOption("graphOptions", {
                      ...options.graphOptions,
                      boxPlotItemHeight: value,
                    })
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          </div>
        </div>
      )}
    </OptionCardWithChildren>
  )
}
