"use client"

import { useMutation } from "@tanstack/react-query"
import { Printer } from "lucide-react"

import {
  OptionCard,
  OptionCardWithChildren,
  OptionField,
  Section,
} from "@/components/common/ReportOptionControls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useEditingInput } from "@/hooks/useEditingInput"
import { parseClampedNumber } from "@/lib/clampedNumber"
import { openPrintDialogMutation } from "@/queries/export"
import type { GradeCalculationResult } from "@/types/grade.types"
import type { GradeReportSettings } from "@/types/gradeReport.types"

import type { ComparisonMarksByCell } from "../comparison-marks/types"
import { generateGradeReportBatchHtml } from "./generateGradeReportHtml"

interface IndividualReportTabProps {
  result: GradeCalculationResult
  selectedStudentIds: string[]
  /** 出力で使う比較の記号（Excel と同じ選択）。比較が無ければ null */
  comparisonMarks: ComparisonMarksByCell | null
  /** 比較の選択か比較先の結果をまだ読み込み中 */
  comparisonsPending: boolean
  options: GradeReportSettings
  /** 変えた列だけを渡す（まるごと渡すと、続けて2つ変えたときに先の1つが消える） */
  onOptionsChange: (values: Partial<GradeReportSettings>) => void
}

export function IndividualReportTab({
  result,
  selectedStudentIds,
  comparisonMarks,
  comparisonsPending,
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
  const editing = useEditingInput()

  const updateOption = <K extends keyof GradeReportSettings>(
    key: K,
    value: GradeReportSettings[K]
  ) => {
    onOptionsChange({ [key]: value })
  }

  const handlePrint = () => {
    if (selectedStudentIds.length === 0) return
    openPrintDialog.mutate({
      html: generateGradeReportBatchHtml(
        result,
        selectedStudentIds,
        options,
        comparisonMarks
      ),
      title: options.title,
    })
  }

  const sourceLabel = options.dataSourceLabel || "成績資料"
  // 記号を出すときだけ、比較先が読み込めるまで待つ（待たないと「・」で印刷される）
  const waitsForComparisons =
    options.showItemGrades &&
    options.itemGradeColumnGradeLabel &&
    options.itemGradeComparisonMarks &&
    comparisonsPending

  return (
    <div className="space-y-6">
      {/* タイトル */}
      <Section title="基本設定">
        <OptionField label="タイトル">
          <Input
            {...editing("title", options.title, (title) =>
              updateOption("title", title)
            )}
            className="h-6 flex-1 text-xs"
          />
        </OptionField>
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
                    checked={options.itemGradeColumnScore}
                    onChange={(checked) =>
                      updateOption("itemGradeColumnScore", checked)
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="得点率"
                    checked={options.itemGradeColumnPercentage}
                    onChange={(checked) =>
                      updateOption("itemGradeColumnPercentage", checked)
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="評価"
                    checked={options.itemGradeColumnGradeLabel}
                    onChange={(checked) =>
                      updateOption("itemGradeColumnGradeLabel", checked)
                    }
                    variant="sub"
                  />
                  {options.itemGradeColumnGradeLabel && (
                    <OptionCard
                      label="評価に比較の記号（例 1↑）"
                      checked={options.itemGradeComparisonMarks}
                      onChange={(checked) =>
                        updateOption("itemGradeComparisonMarks", checked)
                      }
                      variant="sub"
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <OptionField label="列数">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "itemGradeTableColumns",
                        String(options.itemGradeTableColumns),
                        (text) => {
                          const columns = parseClampedNumber(text, {
                            min: 1,
                            max: 5,
                            integer: true,
                          })
                          if (columns !== null) {
                            updateOption("itemGradeTableColumns", columns)
                          }
                        }
                      )}
                    />
                  </OptionField>
                  <OptionField label="文字">
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "itemGradeFontSize",
                        String(options.itemGradeFontSize),
                        (text) => {
                          const fontSize = parseClampedNumber(text, { min: 1 })
                          if (fontSize !== null) {
                            updateOption("itemGradeFontSize", fontSize)
                          }
                        }
                      )}
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </OptionField>
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
                <OptionField label="表示名">
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
                </OptionField>
                <div className="flex flex-wrap gap-2">
                  <OptionCard
                    label="得点"
                    checked={options.sourceBreakdownColumnScore}
                    onChange={(checked) =>
                      updateOption("sourceBreakdownColumnScore", checked)
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="換算得点"
                    checked={options.sourceBreakdownColumnWeight}
                    onChange={(checked) =>
                      updateOption("sourceBreakdownColumnWeight", checked)
                    }
                    variant="sub"
                  />
                  <OptionCard
                    label="コメント"
                    checked={options.sourceBreakdownColumnComment}
                    onChange={(checked) =>
                      updateOption("sourceBreakdownColumnComment", checked)
                    }
                    variant="sub"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <OptionField label="列数">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "sourceBreakdownTableColumns",
                        String(options.sourceBreakdownTableColumns),
                        (text) => {
                          const columns = parseClampedNumber(text, {
                            min: 1,
                            max: 5,
                            integer: true,
                          })
                          if (columns !== null) {
                            updateOption("sourceBreakdownTableColumns", columns)
                          }
                        }
                      )}
                    />
                  </OptionField>
                  <OptionField label="文字">
                    <Input
                      type="number"
                      min={1}
                      className="h-6 w-16 text-xs"
                      {...editing(
                        "sourceBreakdownFontSize",
                        String(options.sourceBreakdownFontSize),
                        (text) => {
                          const fontSize = parseClampedNumber(text, { min: 1 })
                          if (fontSize !== null) {
                            updateOption("sourceBreakdownFontSize", fontSize)
                          }
                        }
                      )}
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </OptionField>
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
              {...editing("footer.left", options.footerLeft, (text) =>
                updateOption("footerLeft", text)
              )}
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">中</Label>
            <Textarea
              {...editing("footer.center", options.footerCenter, (text) =>
                updateOption("footerCenter", text)
              )}
              rows={2}
              className="min-h-0 flex-1 resize-y text-xs"
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-2">
            <Label className="w-6 shrink-0 pt-1 text-xs">右</Label>
            <Textarea
              {...editing("footer.right", options.footerRight, (text) =>
                updateOption("footerRight", text)
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
            openPrintDialog.isPending ||
            waitsForComparisons ||
            selectedStudentIds.length === 0
          }
          className="w-full"
          size="sm"
        >
          <Printer className="mr-2 h-4 w-4" />
          {openPrintDialog.isPending
            ? "準備中..."
            : waitsForComparisons
              ? "比較先を読み込み中..."
              : `印刷 (${selectedStudentIds.length}名)`}
        </Button>
        {/* 印刷ダイアログは出ない。main が PDF を作り、既定のアプリで開く（export:openPrintDialog） */}
        <p className="text-center text-[10px] text-muted-foreground">
          選択した生徒の通知書を PDF にして、PDF
          を見るアプリで開きます。印刷・保存はそのアプリから行います
        </p>
      </div>
    </div>
  )
}
