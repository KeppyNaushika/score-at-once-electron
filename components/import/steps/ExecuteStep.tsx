"use client"

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type { ArchiveDataCounts } from "@/types/projectArchive.types"

/** idIntegrationImport の戻り値の型 */
interface IdIntegrationImportResult {
  success: boolean
  projectId?: string
  summary?: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
  }
  warnings?: string[]
  error?: string
}

interface ExecuteStepProps {
  wizard: UseImportWizardReturn
  onComplete?: (projectId: string) => void
  onClose: () => void
}

export function ExecuteStep({ wizard, onComplete, onClose }: ExecuteStepProps) {
  const { executeImport } = wizard
  const [result, setResult] = useState<IdIntegrationImportResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const hasStarted = useRef(false)

  // 自動実行
  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const execute = async () => {
      setIsExecuting(true)
      const importResult = await executeImport()
      setIsExecuting(false)
      if (importResult) {
        setResult(importResult)
      }
    }

    execute()
  }, [executeImport])

  const handleComplete = () => {
    if (result?.success && result.projectId && onComplete) {
      onComplete(result.projectId)
    }
    onClose()
  }

  // 実行中
  if (isExecuting) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16">
        <div className="bg-primary/10 mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl">
          <Loader2 className="text-primary h-10 w-10 animate-spin" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">インポート中...</h3>
        <p className="text-muted-foreground mb-8">
          データをインポートしています。しばらくお待ちください。
        </p>
        <div className="w-full max-w-sm">
          <Progress value={undefined} className="h-2" />
        </div>
      </div>
    )
  }

  // 完了（成功）
  if (result?.success) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">
            インポートが完了しました
          </h3>
          <p className="text-muted-foreground">
            プロジェクトが正常にインポートされました。
          </p>
        </div>

        {/* 結果サマリー */}
        {result.summary && (
          <Card className="mb-6 w-full max-w-md border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
            <CardContent className="p-5">
              <h4 className="mb-4 text-sm font-medium text-green-800 dark:text-green-200">
                インポート結果
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.summary.created.students}
                  </div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80">
                    生徒
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.summary.created.pages}
                  </div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80">
                    ページ
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.summary.created.scores}
                  </div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80">
                    採点結果
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 警告表示 */}
        {result.warnings && result.warnings.length > 0 && (
          <Card className="mb-6 w-full max-w-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                    注意事項
                  </h4>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li
                        key={index}
                        className="text-sm text-amber-700 dark:text-amber-300"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={handleComplete} size="lg" className="gap-2 px-8">
          プロジェクトを開く
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  // 完了（失敗）
  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <div className="bg-destructive/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <XCircle className="text-destructive h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">インポートに失敗しました</h3>
        <p className="text-destructive max-w-md">{result?.error}</p>
      </div>

      <Button onClick={onClose} variant="outline" size="lg">
        閉じる
      </Button>
    </div>
  )
}
