"use client"

import { useMutation } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { exportGradeExcelMutation } from "@/queries/grade"

interface ExcelExportTabProps {
  gradeId: string
  selectedStudentIds: string[]
}

export function ExcelExportTab({
  gradeId,
  selectedStudentIds,
}: ExcelExportTabProps) {
  const exportExcel = useMutation(exportGradeExcelMutation(gradeId))

  const handleExportExcel = () => {
    // 失敗の知らせは中央のトーストが出す。ここは成功のときだけ言う
    exportExcel.mutate(
      { studentIds: selectedStudentIds },
      {
        onSuccess: (result) => {
          if (!result.canceled) {
            toast.success(`Excelを出力しました: ${result.outputPath}`)
          }
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Excel出力</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          成績算出結果をExcelファイルとして出力します。
        </p>
      </div>
      <Button
        onClick={handleExportExcel}
        disabled={exportExcel.isPending || selectedStudentIds.length === 0}
        size="sm"
      >
        <Download className="mr-2 h-4 w-4" />
        {exportExcel.isPending
          ? "出力中..."
          : `Excel出力 (${selectedStudentIds.length}名)`}
      </Button>
    </div>
  )
}
