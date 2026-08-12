"use client"

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { StudentImportWizard } from "@/hooks/student-import/useStudentImportWizard"
import type { StudentArchiveImportResult } from "@/types/studentArchive.types"

interface ExecuteStepProps {
  wizard: StudentImportWizard
  onComplete?: () => void
  onClose: () => void
}

export function ExecuteStep({ wizard, onComplete, onClose }: ExecuteStepProps) {
  const hasStarted = useRef(false)
  const [result, setResult] = useState<StudentArchiveImportResult | null>(null)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const run = async () => {
      const importResult = await wizard.executeImport()
      if (importResult) {
        setResult(importResult)
      }
    }

    run()
  }, [wizard])

  // 失敗（理由はウィザードが持つ）
  if (wizard.state.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">インポートに失敗しました</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {wizard.state.error}
          </p>
        </div>
      </div>
    )
  }

  // 実行中
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">インポート中...</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            データを処理しています。しばらくお待ちください。
          </p>
        </div>
      </div>
    )
  }

  const { summary, warnings } = result

  const handleComplete = () => {
    onComplete?.()
    onClose()
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold">インポートが完了しました</h3>
      </div>

      <div className="mx-auto grid w-full max-w-md gap-3">
        <div className="rounded-lg border border-border/50 p-4">
          <h4 className="mb-2 text-sm font-medium">生徒</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {summary.created.students > 0 && (
              <span>新規: {summary.created.students}名</span>
            )}
            {summary.updated.students > 0 && (
              <span>更新: {summary.updated.students}名</span>
            )}
            {summary.unchanged.students > 0 && (
              <span>変更なし: {summary.unchanged.students}名</span>
            )}
            {summary.skipped.students > 0 && (
              <span>スキップ: {summary.skipped.students}名</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/50 p-4">
          <h4 className="mb-2 text-sm font-medium">学級</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {summary.created.classrooms > 0 && (
              <span>新規: {summary.created.classrooms}件</span>
            )}
            {summary.updated.classrooms > 0 && (
              <span>更新: {summary.updated.classrooms}件</span>
            )}
            {summary.unchanged.classrooms > 0 && (
              <span>変更なし: {summary.unchanged.classrooms}件</span>
            )}
            {summary.skipped.classrooms > 0 && (
              <span>スキップ: {summary.skipped.classrooms}件</span>
            )}
          </div>
        </div>

        {summary.created.memberships > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            所属関係: {summary.created.memberships}件処理
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <h4 className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            注意事項
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-600 dark:text-amber-400">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={handleComplete} size="lg">
        閉じる
      </Button>
    </div>
  )
}
