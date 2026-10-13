"use client"

import { ArrowRight } from "lucide-react"
import { useEffect } from "react"

import {
  ImportCountsCard,
  ImportExecutingView,
  ImportFailedView,
  ImportSucceededHeading,
  ImportWarningsCard,
} from "@/components/import/ImportExecuteStatus"
import { Button } from "@/components/ui/button"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import { tableLabel } from "@/lib/shared/tableLabels"

interface ExecuteStepProps {
  wizard: UseImportWizardReturn
  onComplete?: (examId: string) => void
  onClose: () => void
}

/**
 * 実行の段。開いたら取り込みを始める（二度目を走らせないのはウィザードの側が受け持つ）。
 *
 * 結果（成功・失敗）はウィザードの `importOutcome` で出し分ける。ウィザード全体のエラー
 * （上部の帯）は見ない — 帯の ✕ で消しても、この段の表示は変わらない。
 */
export function ExecuteStep({ wizard, onComplete, onClose }: ExecuteStepProps) {
  const { executeImport, importOutcome } = wizard

  useEffect(() => {
    void executeImport()
  }, [executeImport])

  // 実行中（始める前の一瞬も含む）
  if (importOutcome === null) {
    return <ImportExecutingView />
  }

  if (importOutcome.kind === "failed") {
    return <ImportFailedView error={importOutcome.error} onClose={onClose} />
  }

  const { examId, summary, warnings } = importOutcome.result

  const handleOpenExam = () => {
    onComplete?.(examId)
    onClose()
  }

  // main が数えている種類だけを出す（画像は数えていないので出さない）
  const countsRows = [
    { label: tableLabel("Student"), countsKey: "students" },
    { label: tableLabel("Classroom"), countsKey: "classrooms" },
    { label: tableLabel("User"), countsKey: "users" },
    { label: tableLabel("SubtotalGroup"), countsKey: "subtotalGroups" },
    { label: tableLabel("ExamPage"), countsKey: "pages" },
    { label: tableLabel("CropRegion"), countsKey: "regions" },
    { label: tableLabel("QuestionScore"), countsKey: "scores" },
    { label: tableLabel("DrawingAnnotation"), countsKey: "annotations" },
  ] as const

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <ImportSucceededHeading description="試験が正常に取り込まれました。" />

      <ImportCountsCard
        rows={countsRows.map((countsRow) => ({
          label: countsRow.label,
          created: summary.created[countsRow.countsKey],
          updated: summary.updated[countsRow.countsKey],
          unchanged: summary.unchanged[countsRow.countsKey],
          skipped: summary.skipped[countsRow.countsKey],
        }))}
      />

      <ImportWarningsCard warnings={warnings} />

      <Button onClick={handleOpenExam} size="lg" className="gap-2 px-8">
        試験を開く
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
