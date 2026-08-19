"use client"

import { useMutation } from "@tanstack/react-query"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useEditingText } from "@/hooks/useEditingText"
import { openPrintDialogMutation } from "@/queries/export"
import type { GradeCalculationResult } from "@/types/grade.types"

import { generateGradeReportBatchHtml } from "./generateGradeReportHtml"
import type { GradeReportOptions } from "./types"

interface IndividualReportTabProps {
  result: GradeCalculationResult
  selectedStudentIds: string[]
  options: GradeReportOptions
  onOptionsChange: (options: GradeReportOptions) => void
}

/** 入力中の文字を覚えるときの行。この画面には設定が1組しか無い */
const OPTIONS_ROW = "reportOptions"

export function IndividualReportTab({
  result,
  selectedStudentIds,
  options,
  onOptionsChange,
}: IndividualReportTabProps) {
  const openPrintDialog = useMutation(openPrintDialogMutation())
  /**
   * 打った文字は手元に持つ。
   *
   * 設定は DB のものをそのまま出しているので、1打鍵ごとに書くと、取り直しが
   * 着地するまで打った文字が消える（速く打つと入力が壊れる）。離れるまでは
   * 手元の文字を出す。
   */
  const { textOf, remember, forgetField } = useEditingText()

  const updateOption = <K extends keyof GradeReportOptions>(
    key: K,
    value: GradeReportOptions[K]
  ) => {
    onOptionsChange({ ...options, [key]: value })
  }

  /** 文字を打つ欄に広げる。`field` は覚えるときの鍵で、DB の鍵ではない */
  const editing = (
    field: string,
    stored: string,
    commit: (text: string) => void
  ) => ({
    value: textOf(OPTIONS_ROW, field, stored),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      remember(OPTIONS_ROW, field, event.target.value)
      commit(event.target.value)
    },
    onBlur: () => forgetField(OPTIONS_ROW, field),
  })

  const handlePrint = () => {
    if (selectedStudentIds.length === 0) return
    openPrintDialog.mutate({
      html: generateGradeReportBatchHtml(result, selectedStudentIds, options),
      title: options.title,
    })
  }

  const sourceLabel = options.dataSourceLabel || "成績資料"

  return (
    <div className="space-y-6">
      {/* タイトル */}
      <Section title="基本設定">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <Label className="text-xs whitespace-nowrap">タイトル</Label>
          <Input
            {...editing("title", options.title, (title) =>
              updateOption("title", title)
            )}
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
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                    <Label className="text-xs whitespace-nowrap">列数</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "itemGradeTableColumns",
                        String(options.itemGradeTableColumns),
                        (text) =>
                          updateOption(
                            "itemGradeTableColumns",
                            Math.min(5, Math.max(1, Number(text)))
                          )
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                    <Label className="text-xs whitespace-nowrap">文字</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "itemGradeFontSize",
                        String(options.itemGradeFontSize),
                        (text) => {
                          const fontSize = Math.max(1, Number(text))
                          if (!isNaN(fontSize)) {
                            updateOption("itemGradeFontSize", fontSize)
                          }
                        }
                      )}
                    />
                    <span className="text-xs text-muted-foreground">px</span>
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
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                  <Label className="text-xs whitespace-nowrap">表示名</Label>
                  <Input
                    placeholder="成績資料"
                    className="h-6 flex-1 text-xs"
                    {...editing(
                      "dataSourceLabel",
                      options.dataSourceLabel,
                      (dataSourceLabel) =>
                        updateOption("dataSourceLabel", dataSourceLabel)
                    )}
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
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                    <Label className="text-xs whitespace-nowrap">列数</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "sourceBreakdownTableColumns",
                        String(options.sourceBreakdownTableColumns),
                        (text) =>
                          updateOption(
                            "sourceBreakdownTableColumns",
                            Math.min(5, Math.max(1, Number(text)))
                          )
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                    <Label className="text-xs whitespace-nowrap">文字</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "sourceBreakdownFontSize",
                        String(options.sourceBreakdownFontSize),
                        (text) => {
                          const fontSize = Math.max(1, Number(text))
                          if (!isNaN(fontSize)) {
                            updateOption("sourceBreakdownFontSize", fontSize)
                          }
                        }
                      )}
                    />
                    <span className="text-xs text-muted-foreground">px</span>
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
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">左</Label>
            <Textarea
              {...editing("footer.left", options.footer.left, (text) =>
                updateOption("footer", { ...options.footer, left: text })
              )}
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">中</Label>
            <Textarea
              {...editing("footer.center", options.footer.center, (text) =>
                updateOption("footer", { ...options.footer, center: text })
              )}
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">右</Label>
            <Textarea
              {...editing("footer.right", options.footer.right, (text) =>
                updateOption("footer", { ...options.footer, right: text })
              )}
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
          disabled={
            openPrintDialog.isPending || selectedStudentIds.length === 0
          }
          className="w-full"
          size="sm"
        >
          <Printer className="mr-2 h-4 w-4" />
          {openPrintDialog.isPending
            ? "準備中..."
            : `印刷 (${selectedStudentIds.length}名)`}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
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
        checked ? "border-primary bg-primary/5" : "bg-background"
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
