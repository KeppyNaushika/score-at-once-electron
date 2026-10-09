"use client"

import { useMutation } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { exportGradeExcelMutation } from "@/queries/grade"
import type { GradeComparisonRow } from "@/queries/gradeStructure"
import type { GradeCalculationResult } from "@/types/grade.types"
import type { GradeExcelComparisonColumn } from "@/types/gradeExport.types"

import { comparedTargetNameOf } from "../comparison-marks/comparedTargetName"

interface ExcelExportTabProps {
  gradeId: string
  selectedStudentIds: string[]
  gradeItems: GradeCalculationResult["gradeItems"]
  /** この成績算出の比較（評価項目ごとの登録順） */
  comparisons: readonly GradeComparisonRow[]
  isComparisonExported: (comparisonId: string) => boolean
  onComparisonExportedChange: (comparisonId: string, enabled: boolean) => void
  /** 成績一覧に足す比較の列（renderer が算出した値） */
  comparisonColumns: GradeExcelComparisonColumn[]
  /** 比較の選択か比較先の結果をまだ読み込み中 */
  comparisonsPending: boolean
}

export function ExcelExportTab({
  gradeId,
  selectedStudentIds,
  gradeItems,
  comparisons,
  isComparisonExported,
  onComparisonExportedChange,
  comparisonColumns,
  comparisonsPending,
}: ExcelExportTabProps) {
  const exportExcel = useMutation(exportGradeExcelMutation(gradeId))

  const handleExportExcel = () => {
    // 失敗の知らせは中央のトーストが出す。ここは成功のときだけ言う
    exportExcel.mutate(
      { studentIds: selectedStudentIds, comparisonColumns },
      {
        onSuccess: (result) => {
          if (!result.canceled) {
            toast.success(`Excelを出力しました: ${result.outputPath}`)
          }
        },
      }
    )
  }

  const itemsWithComparisons = gradeItems.flatMap((gradeItem) => {
    const itemComparisons = comparisons.filter(
      (comparison) => comparison.gradeItemId === gradeItem.id
    )
    return itemComparisons.length > 0 ? [{ gradeItem, itemComparisons }] : []
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Excel出力</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          成績算出結果をExcelファイルとして出力します。
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium">載せる比較</h4>
        <p className="text-xs text-muted-foreground">
          「成績一覧」の評価項目の右に、比較先の成績と変化（↑ ↓ → * ・）を
          並べます。個人成績通知書の記号も、ここで選んだ比較を使います。
        </p>
        {itemsWithComparisons.length === 0 ? (
          <p className="rounded-lg border bg-muted/50 p-2 text-xs text-muted-foreground">
            比較はありません。「比較」の段で設定すると、ここで選べます。
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border bg-muted/50 p-2">
            {itemsWithComparisons.map(({ gradeItem, itemComparisons }) => (
              <div key={gradeItem.id} className="space-y-1">
                <div className="text-xs font-medium">{gradeItem.name}</div>
                {itemComparisons.map((comparison) => (
                  <div
                    key={comparison.id}
                    className="flex items-center gap-2 pl-2"
                  >
                    <Checkbox
                      id={`export-comparison-${comparison.id}`}
                      checked={isComparisonExported(comparison.id)}
                      onCheckedChange={(checked) =>
                        onComparisonExportedChange(
                          comparison.id,
                          checked === true
                        )
                      }
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor={`export-comparison-${comparison.id}`}
                      className="cursor-pointer text-xs font-normal"
                    >
                      {comparedTargetNameOf(comparison, gradeId)}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={handleExportExcel}
        disabled={
          exportExcel.isPending ||
          comparisonsPending ||
          selectedStudentIds.length === 0
        }
        size="sm"
      >
        <Download className="mr-2 h-4 w-4" />
        {exportExcel.isPending
          ? "出力中..."
          : comparisonsPending
            ? "比較先を読み込み中..."
            : `Excel出力 (${selectedStudentIds.length}名)`}
      </Button>
    </div>
  )
}
