"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  IndividualReportOptions,
  QuestionTableColumns,
  StatisticKind,
  StatisticScope,
  SubtotalTableColumns,
} from "@/types/individualReport.types"
import {
  STATISTIC_KINDS,
  STATISTIC_SCOPES,
} from "@/types/individualReport.types"

import { SubtotalGroupSelector } from "./individual-report/SubtotalGroupSelector"

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

      {/* 小計点関連 */}
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
                  onChange={(value) =>
                    updateOption("showGroupSubtotals", value)
                  }
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
                      updateOption(
                        "subtotalTableColumns",
                        value as SubtotalTableColumns
                      )
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

          {/* 箱ひげ図 */}
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
        </div>
      </Section>

      {/* 設問関連 */}
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
                      updateOption(
                        "questionTableColumns",
                        value as QuestionTableColumns
                      )
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

      {/* 行政要素 */}
      <Section title="行政要素">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <OptionCard
            label="コメント欄"
            checked={options.showComment}
            onChange={(value) => updateOption("showComment", value)}
          />
          <OptionCard
            label="署名・押印欄"
            checked={options.showSignature}
            onChange={(value) => updateOption("showSignature", value)}
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
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
        onCheckedChange={(value) => onChange(value === true)}
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
        checked ? "border-primary bg-primary/5" : "bg-background"
      }`}
    >
      <div
        className="flex cursor-pointer items-center gap-2"
        onClick={() => onChange(!checked)}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          onClick={(e) => e.stopPropagation()}
        />
        <Label className="cursor-pointer text-xs">{label}</Label>
      </div>
      {children}
    </div>
  )
}
