"use client"

import { Printer } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { GradeCalculationResult } from "@/types/grade.types"

import { generateGradeReportBatchHtml } from "./generateGradeReportHtml"
import type { GradeReportOptions } from "./types"

interface IndividualReportTabProps {
  result: GradeCalculationResult
  selectedStudentIds: string[]
  options: GradeReportOptions
  onOptionsChange: (options: GradeReportOptions) => void
}

export function IndividualReportTab({
  result,
  selectedStudentIds,
  options,
  onOptionsChange,
}: IndividualReportTabProps) {
  const [printing, setPrinting] = useState(false)

  const updateOption = <K extends keyof GradeReportOptions>(
    key: K,
    value: GradeReportOptions[K]
  ) => {
    onOptionsChange({ ...options, [key]: value })
  }

  const handlePrint = async () => {
    if (selectedStudentIds.length === 0) return
    setPrinting(true)
    try {
      const html = generateGradeReportBatchHtml(
        result,
        selectedStudentIds,
        options
      )
      await window.electronAPI.export.openPrintDialog({
        html,
        title: options.title,
      })
    } catch (err) {
      console.error("Print error:", err)
    } finally {
      setPrinting(false)
    }
  }

  const sourceLabel = options.dataSourceLabel || "成績資料"

  return (
    <div className="space-y-6">
      {/* タイトル */}
      <Section title="基本設定">
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
          <Label className="text-xs whitespace-nowrap">タイトル</Label>
          <Input
            value={options.title}
            onChange={(e) => updateOption("title", e.target.value)}
            className="h-6 flex-1 text-xs"
          />
        </div>
      </Section>

      {/* 評価セクション */}
      <Section title="評価セクション">
        <div className="flex flex-col gap-2">
          {/* 項目別評価 */}
          <OptionCardWithChildren
            label="項目別評価"
            checked={options.showItemGrades}
            onChange={(checked) => updateOption("showItemGrades", checked)}
          >
            {options.showItemGrades && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <OptionCard
                    label="得点"
                    checked={options.itemGradeColumns.score}
                    onChange={(checked) =>
                      updateOption("itemGradeColumns", {
                        ...options.itemGradeColumns,
                        score: checked,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="得点率"
                    checked={options.itemGradeColumns.percentage}
                    onChange={(checked) =>
                      updateOption("itemGradeColumns", {
                        ...options.itemGradeColumns,
                        percentage: checked,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="評価"
                    checked={options.itemGradeColumns.gradeLabel}
                    onChange={(checked) =>
                      updateOption("itemGradeColumns", {
                        ...options.itemGradeColumns,
                        gradeLabel: checked,
                      })
                    }
                    variant="sub"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                    <Label className="text-xs whitespace-nowrap">列数</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="h-6 w-16 text-xs"
                      value={options.itemGradeTableColumns}
                      onChange={(e) => {
                        const columnCount = Math.min(
                          5,
                          Math.max(1, Number(e.target.value))
                        )
                        updateOption("itemGradeTableColumns", columnCount)
                      }}
                    />
                  </div>
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                    <Label className="text-xs whitespace-nowrap">文字</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-16 text-xs"
                      value={options.itemGradeFontSize}
                      onChange={(e) => {
                        const fontSize = Math.max(1, Number(e.target.value))
                        if (!isNaN(fontSize)) {
                          updateOption("itemGradeFontSize", fontSize)
                        }
                      }}
                    />
                    <span className="text-muted-foreground text-xs">px</span>
                  </div>
                </div>
              </div>
            )}
          </OptionCardWithChildren>

          {/* データソース内訳 */}
          <OptionCardWithChildren
            label={`${sourceLabel}内訳`}
            checked={options.showSourceBreakdown}
            onChange={(checked) => updateOption("showSourceBreakdown", checked)}
          >
            {options.showSourceBreakdown && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                  <Label className="text-xs whitespace-nowrap">表示名</Label>
                  <Input
                    placeholder="成績資料"
                    className="h-6 flex-1 text-xs"
                    value={options.dataSourceLabel}
                    onChange={(e) =>
                      updateOption("dataSourceLabel", e.target.value)
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <OptionCard
                    label="得点"
                    checked={options.sourceBreakdownColumns.score}
                    onChange={(checked) =>
                      updateOption("sourceBreakdownColumns", {
                        ...options.sourceBreakdownColumns,
                        score: checked,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="換算得点"
                    checked={options.sourceBreakdownColumns.weight}
                    onChange={(checked) =>
                      updateOption("sourceBreakdownColumns", {
                        ...options.sourceBreakdownColumns,
                        weight: checked,
                      })
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="コメント"
                    checked={options.sourceBreakdownColumns.comment}
                    onChange={(checked) =>
                      updateOption("sourceBreakdownColumns", {
                        ...options.sourceBreakdownColumns,
                        comment: checked,
                      })
                    }
                    variant="sub"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                    <Label className="text-xs whitespace-nowrap">列数</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="h-6 w-16 text-xs"
                      value={options.sourceBreakdownTableColumns}
                      onChange={(e) => {
                        const columnCount = Math.min(
                          5,
                          Math.max(1, Number(e.target.value))
                        )
                        updateOption("sourceBreakdownTableColumns", columnCount)
                      }}
                    />
                  </div>
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
                    <Label className="text-xs whitespace-nowrap">文字</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-16 text-xs"
                      value={options.sourceBreakdownFontSize}
                      onChange={(e) => {
                        const fontSize = Math.max(1, Number(e.target.value))
                        if (!isNaN(fontSize)) {
                          updateOption("sourceBreakdownFontSize", fontSize)
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

      {/* 行政要素 */}
      <Section title="行政要素">
        <div className="grid grid-cols-2 gap-2">
          <OptionCard
            label="コメント欄"
            checked={options.showCommentSection}
            onChange={(checked) => updateOption("showCommentSection", checked)}
          />
          <OptionCard
            label="押印欄"
            checked={options.showSignatureSection}
            onChange={(checked) =>
              updateOption("showSignatureSection", checked)
            }
          />
        </div>
      </Section>

      {/* フッター */}
      <Section title="フッター">
        <div className="flex flex-col gap-2">
          <div className="bg-muted/50 flex items-start gap-2 rounded-lg border p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">左</Label>
            <Textarea
              value={options.footer.left}
              onChange={(e) =>
                updateOption("footer", {
                  ...options.footer,
                  left: e.target.value,
                })
              }
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
          <div className="bg-muted/50 flex items-start gap-2 rounded-lg border p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">中</Label>
            <Textarea
              value={options.footer.center}
              onChange={(e) =>
                updateOption("footer", {
                  ...options.footer,
                  center: e.target.value,
                })
              }
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
          <div className="bg-muted/50 flex items-start gap-2 rounded-lg border p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">右</Label>
            <Textarea
              value={options.footer.right}
              onChange={(e) =>
                updateOption("footer", {
                  ...options.footer,
                  right: e.target.value,
                })
              }
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
        </div>
      </Section>

      {/* 印刷ボタン */}
      <div className="space-y-2 border-t pt-4">
        <Button
          onClick={handlePrint}
          disabled={printing || selectedStudentIds.length === 0}
          className="w-full"
          size="sm"
        >
          <Printer className="mr-2 h-4 w-4" />
          {printing ? "準備中..." : `印刷 (${selectedStudentIds.length}名)`}
        </Button>
        <p className="text-muted-foreground text-center text-[10px]">
          選択した生徒の通知書を印刷ダイアログで出力
        </p>
      </div>
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
        onCheckedChange={(checkedState) => onChange(checkedState === true)}
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
          onCheckedChange={(checkedState) => onChange(checkedState === true)}
          onClick={(e) => e.stopPropagation()}
        />
        <Label className="cursor-pointer text-xs">{label}</Label>
      </div>
      {children}
    </div>
  )
}
