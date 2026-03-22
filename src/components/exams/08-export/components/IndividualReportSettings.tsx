"use client"

import type {
  IndividualReportOptions,
  QuestionTableColumns,
  SubtotalTableColumns,
} from "@/app/exams/[examId]/08-export/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SubtotalGroupSelector } from "./individual-report/SubtotalGroupSelector"

interface IndividualReportSettingsProps {
  examId: string
  options: IndividualReportOptions
  onChange: (options: IndividualReportOptions) => void
}

export function IndividualReportSettings({
  examId,
  options,
  onChange,
}: IndividualReportSettingsProps) {
  const updateOption = <K extends keyof IndividualReportOptions>(
    key: K,
    value: IndividualReportOptions[K]
  ) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="space-y-6">
      {/* 基本表示/統計情報 */}
      <Section title="基本表示/統計情報">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <OptionCard
            label="点数"
            checked={options.showScore}
            onChange={(v) => updateOption("showScore", v)}
          />
          <OptionCard
            label="学級平均"
            checked={
              options.showAverage === "class" || options.showAverage === "both"
            }
            onChange={(v) => {
              const showOverall =
                options.showAverage === "overall" ||
                options.showAverage === "both"
              if (v && showOverall) updateOption("showAverage", "both")
              else if (v) updateOption("showAverage", "class")
              else if (showOverall) updateOption("showAverage", "overall")
              else updateOption("showAverage", "none")
            }}
          />
          <OptionCard
            label="全体平均"
            checked={
              options.showAverage === "overall" ||
              options.showAverage === "both"
            }
            onChange={(v) => {
              const showClass =
                options.showAverage === "class" ||
                options.showAverage === "both"
              if (v && showClass) updateOption("showAverage", "both")
              else if (v) updateOption("showAverage", "overall")
              else if (showClass) updateOption("showAverage", "class")
              else updateOption("showAverage", "none")
            }}
          />
          <OptionCard
            label="偏差値"
            checked={options.showDeviation}
            onChange={(v) => updateOption("showDeviation", v)}
          />
          <OptionCard
            label="学級順位"
            checked={
              options.showRank &&
              (options.rankType === "class" || options.rankType === "both")
            }
            onChange={(v) => {
              const showOverall =
                options.showRank &&
                (options.rankType === "overall" || options.rankType === "both")
              if (v && showOverall) {
                onChange({ ...options, showRank: true, rankType: "both" })
              } else if (v) {
                onChange({ ...options, showRank: true, rankType: "class" })
              } else if (showOverall) {
                onChange({ ...options, rankType: "overall" })
              } else {
                onChange({ ...options, showRank: false })
              }
            }}
          />
          <OptionCard
            label="全体順位"
            checked={
              options.showRank &&
              (options.rankType === "overall" || options.rankType === "both")
            }
            onChange={(v) => {
              const showClass =
                options.showRank &&
                (options.rankType === "class" || options.rankType === "both")
              if (v && showClass) {
                onChange({ ...options, showRank: true, rankType: "both" })
              } else if (v) {
                onChange({ ...options, showRank: true, rankType: "overall" })
              } else if (showClass) {
                onChange({ ...options, rankType: "class" })
              } else {
                onChange({ ...options, showRank: false })
              }
            }}
          />
        </div>
        {/* 統計に含める受験状態 */}
        <div className="mt-2 flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs">
            統計に含める受験状態
          </Label>
          <div className="flex flex-wrap gap-2">
            <OptionCard
              label="受験"
              checked={options.boxPlotIncludeStatuses.participating}
              onChange={(v) =>
                updateOption("boxPlotIncludeStatuses", {
                  ...options.boxPlotIncludeStatuses,
                  participating: v,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="見込"
              checked={options.boxPlotIncludeStatuses.expected}
              onChange={(v) =>
                updateOption("boxPlotIncludeStatuses", {
                  ...options.boxPlotIncludeStatuses,
                  expected: v,
                })
              }
              variant="sub"
            />
            <OptionCard
              label="欠席"
              checked={options.boxPlotIncludeStatuses.absent}
              onChange={(v) =>
                updateOption("boxPlotIncludeStatuses", {
                  ...options.boxPlotIncludeStatuses,
                  absent: v,
                })
              }
              variant="sub"
            />
          </div>
        </div>
      </Section>

      {/* 小計点関連 */}
      <Section title="小計点関連">
        <div className="flex flex-col gap-2">
          {/* 共通オプション */}
          <OptionCard
            label="設問と関連付けのない小計点を非表示"
            checked={options.hideUnassignedSubtotals}
            onChange={(v) => updateOption("hideUnassignedSubtotals", v)}
          />

          {/* 小計点の表 */}
          <OptionCardWithChildren
            label="小計点の表"
            checked={options.showSubtotalTable}
            onChange={(v) => updateOption("showSubtotalTable", v)}
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
                  onChange={(v) => updateOption("showGroupSubtotals", v)}
                  variant="sub"
                />
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">列数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="h-6 flex-1 text-xs"
                    value={options.subtotalTableColumns}
                    onChange={(e) => {
                      const v = Math.min(
                        10,
                        Math.max(1, Number(e.target.value))
                      )
                      updateOption(
                        "subtotalTableColumns",
                        v as SubtotalTableColumns
                      )
                    }}
                  />
                </div>
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">文字</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-6 flex-1 text-xs"
                    value={options.subtotalTableFontSize}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value))
                      if (!isNaN(v)) {
                        updateOption("subtotalTableFontSize", v)
                      }
                    }}
                  />
                  <span className="text-muted-foreground text-xs">px</span>
                </div>
              </div>
            )}
          </OptionCardWithChildren>

          {/* 箱ひげ図 */}
          <OptionCardWithChildren
            label="箱ひげ図"
            checked={options.graphOptions.showBoxPlot}
            onChange={(v) =>
              updateOption("graphOptions", {
                ...options.graphOptions,
                showBoxPlot: v,
              })
            }
          >
            {options.graphOptions.showBoxPlot && (
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <OptionCard
                    label="合計点"
                    checked={options.graphOptions.showOverallBoxPlot ?? false}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showOverallBoxPlot: v,
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
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showBoxPlotMin: v,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="Q1"
                    checked={options.graphOptions.showBoxPlotQ1}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showBoxPlotQ1: v,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="中央値"
                    checked={options.graphOptions.showBoxPlotMedian}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showBoxPlotMedian: v,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="Q3"
                    checked={options.graphOptions.showBoxPlotQ3}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showBoxPlotQ3: v,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="最大"
                    checked={options.graphOptions.showBoxPlotMax}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showBoxPlotMax: v,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="平均線"
                    checked={options.graphOptions.showAverageLine}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showAverageLine: v,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="あなたの得点"
                    checked={options.graphOptions.showStudentMarker}
                    onChange={(v) =>
                      updateOption("graphOptions", {
                        ...options.graphOptions,
                        showStudentMarker: v,
                      })
                    }
                    variant="sub"
                  />
                </div>
                {/* サイズ調整 */}
                <div className="flex flex-wrap gap-2">
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                    <Label className="text-xs whitespace-nowrap">文字</Label>
                    <Input
                      type="number"
                      min={6}
                      max={16}
                      className="h-6 w-16 text-xs"
                      value={options.graphOptions.boxPlotFontSize ?? 11}
                      onChange={(e) => {
                        const v = Math.min(
                          16,
                          Math.max(6, Number(e.target.value))
                        )
                        if (!isNaN(v)) {
                          updateOption("graphOptions", {
                            ...options.graphOptions,
                            boxPlotFontSize: v,
                          })
                        }
                      }}
                    />
                    <span className="text-muted-foreground text-xs">px</span>
                  </div>
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                    <Label className="text-xs whitespace-nowrap">間隔</Label>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      className="h-6 w-16 text-xs"
                      value={options.graphOptions.boxPlotItemHeight ?? 20}
                      onChange={(e) => {
                        const v = Math.min(
                          40,
                          Math.max(0, Number(e.target.value))
                        )
                        if (!isNaN(v)) {
                          updateOption("graphOptions", {
                            ...options.graphOptions,
                            boxPlotItemHeight: v,
                          })
                        }
                      }}
                    />
                    <span className="text-muted-foreground text-xs">px</span>
                  </div>
                </div>
              </div>
            )}
          </OptionCardWithChildren>
        </div>
      </Section>

      {/* 設問関連 */}
      <Section title="設問関連">
        <div className="flex flex-col gap-2">
          <OptionCardWithChildren
            label="設問の表"
            checked={options.showQuestionTable}
            onChange={(v) => updateOption("showQuestionTable", v)}
          >
            {options.showQuestionTable && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <OptionCard
                    label="マルバツ表示"
                    checked={options.showMarks}
                    onChange={(v) => updateOption("showMarks", v)}
                    variant="sub"
                  />
                  <OptionCard
                    label="正答率"
                    checked={options.showCorrectRate}
                    onChange={(v) => updateOption("showCorrectRate", v)}
                    variant="sub"
                  />
                  <OptionCard
                    label="得点率"
                    checked={options.showScoreRate ?? false}
                    onChange={(v) => updateOption("showScoreRate", v)}
                    variant="sub"
                  />
                </div>
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">列数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="h-6 flex-1 text-xs"
                    value={options.questionTableColumns}
                    onChange={(e) => {
                      const v = Math.min(
                        10,
                        Math.max(1, Number(e.target.value))
                      )
                      updateOption(
                        "questionTableColumns",
                        v as QuestionTableColumns
                      )
                    }}
                  />
                </div>
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">文字</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-6 flex-1 text-xs"
                    value={options.questionTableFontSize}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value))
                      if (!isNaN(v)) {
                        updateOption("questionTableFontSize", v)
                      }
                    }}
                  />
                  <span className="text-muted-foreground text-xs">px</span>
                </div>
              </div>
            )}
          </OptionCardWithChildren>

          <OptionCardWithChildren
            label="学習アドバイス"
            checked={options.showLearningAdvice}
            onChange={(v) => updateOption("showLearningAdvice", v)}
          >
            {options.showLearningAdvice && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">正答率</Label>
                  <Input
                    type="text"
                    className="h-6 flex-1 text-xs"
                    placeholder="なし"
                    value={options.adviceOptions.reviewRateMin ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          reviewRateMin: null,
                        })
                      } else {
                        const num = Number(val)
                        if (!isNaN(num)) {
                          updateOption("adviceOptions", {
                            ...options.adviceOptions,
                            reviewRateMin: num,
                          })
                        }
                      }
                    }}
                  />
                  <span className="text-muted-foreground text-xs">%以上</span>
                  <Input
                    type="text"
                    className="h-6 flex-1 text-xs"
                    placeholder="なし"
                    value={options.adviceOptions.reviewRateMax ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          reviewRateMax: null,
                        })
                      } else {
                        const num = Number(val)
                        if (!isNaN(num)) {
                          updateOption("adviceOptions", {
                            ...options.adviceOptions,
                            reviewRateMax: num,
                          })
                        }
                      }
                    }}
                  />
                  <span className="text-muted-foreground text-xs">%以下</span>
                </div>
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">問題数</Label>
                  <Input
                    type="text"
                    className="h-6 flex-1 text-xs"
                    placeholder="全て"
                    value={options.adviceOptions.reviewQuestionCount ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          reviewQuestionCount: null,
                        })
                      } else {
                        const num = Number(val)
                        if (!isNaN(num)) {
                          updateOption("adviceOptions", {
                            ...options.adviceOptions,
                            reviewQuestionCount: num,
                          })
                        }
                      }
                    }}
                  />
                  <span className="text-muted-foreground text-xs">問</span>
                </div>
              </div>
            )}
          </OptionCardWithChildren>
        </div>
      </Section>

      {/* 行政要素 */}
      <Section title="行政要素">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <OptionCard
            label="コメント欄"
            checked={options.showComment}
            onChange={(v) => updateOption("showComment", v)}
          />
          <OptionCard
            label="署名・押印欄"
            checked={options.showSignature}
            onChange={(v) => updateOption("showSignature", v)}
          />
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h4>
      {children}
    </div>
  )
}

function OptionCard({
  label,
  checked,
  onChange,
  variant = "default",
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  variant?: "default" | "sub"
}) {
  const baseClasses =
    "flex items-center gap-2 rounded-lg border p-2 cursor-pointer"
  const variantClasses =
    variant === "sub"
      ? checked
        ? "bg-primary/5 border-primary/30"
        : "bg-muted/50 border-muted"
      : checked
        ? "bg-primary/5 border-primary"
        : "bg-background hover:bg-muted/50"

  return (
    <div
      className={`${baseClasses} ${variantClasses}`}
      onClick={() => onChange(!checked)}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        onClick={(e) => e.stopPropagation()}
      />
      <Label className="cursor-pointer text-xs">{label}</Label>
    </div>
  )
}

function OptionCardWithChildren({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        checked ? "bg-primary/5 border-primary" : "bg-background"
      }`}
    >
      <div
        className="flex cursor-pointer items-center gap-2"
        onClick={() => onChange(!checked)}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          onClick={(e) => e.stopPropagation()}
        />
        <Label className="cursor-pointer text-xs">{label}</Label>
      </div>
      {children}
    </div>
  )
}
