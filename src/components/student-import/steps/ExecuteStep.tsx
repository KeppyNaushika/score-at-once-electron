"use client"

import { useEffect } from "react"

import {
  ImportCountsCard,
  ImportExecutingView,
  ImportFailedView,
  ImportSucceededHeading,
  ImportWarningsCard,
} from "@/components/import/ImportExecuteStatus"
import { Button } from "@/components/ui/button"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"
import { tableLabel } from "@/lib/shared/tableLabels"

interface ExecuteStepProps {
  wizard: StudentImportWizard
  /** 閉じる（取り込めていれば、フッターの「閉じる」と同じく完了の知らせも出す） */
  onClose: () => void
}

/**
 * 実行の段。開いたら取り込みを始める（二度目を走らせないのはウィザードの側が受け持つ）。
 *
 * 結果（成功・失敗）はウィザードの `importOutcome` で出し分ける。ウィザード全体のエラー
 * （上部の帯）は見ない — 帯の ✕ で消しても、この段の表示は変わらない。
 */
export function ExecuteStep({ wizard, onClose }: ExecuteStepProps) {
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

  const { summary, warnings } = importOutcome.result

  const countsRows = [
    { label: tableLabel("Student"), countsKey: "students" },
    { label: tableLabel("Classroom"), countsKey: "classrooms" },
    {
      label: tableLabel("StudentClassroomMembership"),
      countsKey: "memberships",
    },
  ] as const

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <ImportSucceededHeading description="生徒データが正常に取り込まれました。" />

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

      <Button onClick={onClose} size="lg" className="px-8">
        閉じる
      </Button>
    </div>
  )
}
