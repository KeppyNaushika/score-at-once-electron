"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { IndividualReportOptions } from "@/app/projects/[projectId]/08-export/types"

interface IndividualReportSettingsProps {
  options: IndividualReportOptions
  onChange: (options: IndividualReportOptions) => void
}

export function IndividualReportSettings({
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
      {/* 表示モード */}
      <Section title="表示モード">
        <div className="flex items-center gap-4">
          <Label>表示形式</Label>
          <Select
            value={options.displayMode}
            onValueChange={(v) =>
              updateOption("displayMode", v as "detail" | "subtotal_only")
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detail">設問詳細</SelectItem>
              <SelectItem value="subtotal_only">小計のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Separator />

      {/* 基本表示 */}
      <Section title="基本表示">
        <ToggleRow
          label="点数を表示"
          checked={options.showScore}
          onChange={(v) => updateOption("showScore", v)}
        />
        <ToggleRow
          label="マルバツを表示"
          checked={options.showMarks}
          onChange={(v) => updateOption("showMarks", v)}
        />
        <div className="flex items-center gap-4">
          <Label className="w-32">平均点</Label>
          <Select
            value={options.showAverage}
            onValueChange={(v) =>
              updateOption(
                "showAverage",
                v as "class" | "overall" | "both" | "none"
              )
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">非表示</SelectItem>
              <SelectItem value="class">学級のみ</SelectItem>
              <SelectItem value="overall">全体のみ</SelectItem>
              <SelectItem value="both">両方</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          <Label className="w-32">得点率形式</Label>
          <Select
            value={options.scoreRateFormat}
            onValueChange={(v) =>
              updateOption(
                "scoreRateFormat",
                v as "percentage" | "grade5" | "gradeAE"
              )
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">パーセント</SelectItem>
              <SelectItem value="grade5">5段階評価</SelectItem>
              <SelectItem value="gradeAE">A〜E評定</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Separator />

      {/* 統計情報 */}
      <Section title="統計情報">
        <ToggleRow
          label="偏差値を表示"
          checked={options.showDeviation}
          onChange={(v) => updateOption("showDeviation", v)}
        />
        <ToggleRow
          label="順位を表示"
          checked={options.showRank}
          onChange={(v) => updateOption("showRank", v)}
        />
        {options.showRank && (
          <div className="ml-8 flex items-center gap-4">
            <Label className="w-24">順位種類</Label>
            <Select
              value={options.rankType}
              onValueChange={(v) =>
                updateOption("rankType", v as "class" | "overall" | "both")
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">学級のみ</SelectItem>
                <SelectItem value="overall">全体のみ</SelectItem>
                <SelectItem value="both">両方</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </Section>

      <Separator />

      {/* グラフ */}
      <Section title="グラフ">
        <ToggleRow
          label="グラフを表示"
          checked={options.showGraph}
          onChange={(v) => updateOption("showGraph", v)}
        />
        {options.showGraph && (
          <div className="ml-8 space-y-2">
            <ToggleRow
              label="棒グラフ"
              checked={options.graphOptions.showBarChart}
              onChange={(v) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBarChart: v,
                })
              }
            />
            <ToggleRow
              label="レーダーチャート"
              checked={options.graphOptions.showRadarChart}
              onChange={(v) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showRadarChart: v,
                })
              }
            />
            <ToggleRow
              label="箱ひげ図"
              checked={options.graphOptions.showBoxPlot}
              onChange={(v) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showBoxPlot: v,
                })
              }
            />
            <ToggleRow
              label="平均線を表示"
              checked={options.graphOptions.showAverageLine}
              onChange={(v) =>
                updateOption("graphOptions", {
                  ...options.graphOptions,
                  showAverageLine: v,
                })
              }
            />
          </div>
        )}
      </Section>

      <Separator />

      {/* 学習アドバイス */}
      <Section title="学習アドバイス">
        <ToggleRow
          label="学習アドバイスを表示"
          checked={options.showLearningAdvice}
          onChange={(v) => updateOption("showLearningAdvice", v)}
        />
        {options.showLearningAdvice && (
          <div className="ml-8 space-y-4">
            {/* 差がつく問題 */}
            <div className="space-y-2">
              <ToggleRow
                label="差がつく問題"
                checked={options.adviceOptions.showDifferentiatingQuestions}
                onChange={(v) =>
                  updateOption("adviceOptions", {
                    ...options.adviceOptions,
                    showDifferentiatingQuestions: v,
                  })
                }
              />
              {options.adviceOptions.showDifferentiatingQuestions && (
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">正答率</Label>
                    <Input
                      type="number"
                      className="w-16"
                      value={options.adviceOptions.differentiatingRateMin}
                      onChange={(e) =>
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          differentiatingRateMin: Number(e.target.value),
                        })
                      }
                    />
                    <span>〜</span>
                    <Input
                      type="number"
                      className="w-16"
                      value={options.adviceOptions.differentiatingRateMax}
                      onChange={(e) =>
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          differentiatingRateMax: Number(e.target.value),
                        })
                      }
                    />
                    <span>%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">表示数</Label>
                    <Select
                      value={options.adviceOptions.differentiatingFilterMode}
                      onValueChange={(v) =>
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          differentiatingFilterMode: v as
                            | "top_n"
                            | "all_matching",
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top_n">上位N問</SelectItem>
                        <SelectItem value="all_matching">全て</SelectItem>
                      </SelectContent>
                    </Select>
                    {options.adviceOptions.differentiatingFilterMode ===
                      "top_n" && (
                      <Input
                        type="number"
                        className="w-16"
                        value={options.adviceOptions.differentiatingTopN}
                        onChange={(e) =>
                          updateOption("adviceOptions", {
                            ...options.adviceOptions,
                            differentiatingTopN: Number(e.target.value),
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 必ず復習問題 */}
            <div className="space-y-2">
              <ToggleRow
                label="必ず復習問題"
                checked={options.adviceOptions.showMustReviewQuestions}
                onChange={(v) =>
                  updateOption("adviceOptions", {
                    ...options.adviceOptions,
                    showMustReviewQuestions: v,
                  })
                }
              />
              {options.adviceOptions.showMustReviewQuestions && (
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">正答率</Label>
                    <Input
                      type="number"
                      className="w-16"
                      value={options.adviceOptions.mustReviewRateMin}
                      onChange={(e) =>
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          mustReviewRateMin: Number(e.target.value),
                        })
                      }
                    />
                    <span>% 以上</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">表示数</Label>
                    <Select
                      value={options.adviceOptions.mustReviewFilterMode}
                      onValueChange={(v) =>
                        updateOption("adviceOptions", {
                          ...options.adviceOptions,
                          mustReviewFilterMode: v as "top_n" | "all_matching",
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top_n">上位N問</SelectItem>
                        <SelectItem value="all_matching">全て</SelectItem>
                      </SelectContent>
                    </Select>
                    {options.adviceOptions.mustReviewFilterMode === "top_n" && (
                      <Input
                        type="number"
                        className="w-16"
                        value={options.adviceOptions.mustReviewTopN}
                        onChange={(e) =>
                          updateOption("adviceOptions", {
                            ...options.adviceOptions,
                            mustReviewTopN: Number(e.target.value),
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      <Separator />

      {/* 行政要素 */}
      <Section title="行政要素">
        <ToggleRow
          label="コメント欄"
          checked={options.showComment}
          onChange={(v) => updateOption("showComment", v)}
        />
        <ToggleRow
          label="署名・押印欄"
          checked={options.showSignature}
          onChange={(v) => updateOption("showSignature", v)}
        />
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
    <div className="space-y-3">
      <h4 className="text-muted-foreground text-sm font-semibold">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
