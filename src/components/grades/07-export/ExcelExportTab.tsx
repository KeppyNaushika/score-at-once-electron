"use client"

import { Download } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

interface ExcelExportTabProps {
  gradeId: string
  selectedStudentIds: string[]
}

export function ExcelExportTab({
  gradeId,
  selectedStudentIds,
}: ExcelExportTabProps) {
  const [exporting, setExporting] = useState(false)

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const result = await window.electronAPI.grade.exportExcel(gradeId, {
        studentIds: selectedStudentIds,
      })
      if (!result.success) {
        console.error("Export failed:", result.error)
      }
    } catch (err) {
      console.error("Export error:", err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Excel出力</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          成績算出結果をExcelファイルとして出力します。
        </p>
      </div>
      <Button
        onClick={handleExportExcel}
        disabled={exporting || selectedStudentIds.length === 0}
        size="sm"
      >
        <Download className="mr-2 h-4 w-4" />
        {exporting ? "出力中..." : `Excel出力 (${selectedStudentIds.length}名)`}
      </Button>
    </div>
  )
}
