"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ImportAsNewResult,
  MergeImportResult,
} from "@/types/project-archive.types"
import {
  Download,
  FileText,
  Users,
  ClipboardCheck,
  Image,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ExecuteStepProps {
  wizard: UseImportWizardReturn
  onComplete?: (projectId: string) => void
  onClose: () => void
}

type ImportResult = ImportAsNewResult | MergeImportResult

export function ExecuteStep({ wizard, onComplete, onClose }: ExecuteStepProps) {
  const { state, executeImportAsNew, executeMergeImport } = wizard
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const handleExecute = async () => {
    setIsExecuting(true)

    let importResult: ImportResult | null = null

    if (state.mode === "new") {
      importResult = await executeImportAsNew()
    } else {
      importResult = await executeMergeImport()
    }

    setIsExecuting(false)

    if (importResult) {
      setResult(importResult)
    }
  }

  const handleComplete = () => {
    if (result?.success && result.projectId && onComplete) {
      onComplete(result.projectId)
    }
    onClose()
  }

  // 実行前の確認画面
  if (!result && !isExecuting) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Download className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            インポートを実行しますか？
          </h3>
          <p className="text-muted-foreground max-w-md">
            {state.mode === "new"
              ? "全てのデータを新しいプロジェクトとして作成します。"
              : "既存データと統合しながらインポートします。"}
          </p>
        </div>

        {/* 実行サマリー */}
        <Card className="w-full max-w-md mb-8">
          <CardContent className="p-5">
            <h4 className="text-sm font-medium mb-4">インポート内容</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">プロジェクト</p>
                  <p className="text-xs text-muted-foreground">
                    {state.manifest?.projectName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">生徒</p>
                  <p className="text-xs text-muted-foreground">
                    {state.manifest?.counts.students}名
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">採点結果</p>
                  <p className="text-xs text-muted-foreground">
                    {state.manifest?.counts.scores}件
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Image className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">画像</p>
                  <p className="text-xs text-muted-foreground">
                    {(state.manifest?.counts.masterImages || 0) +
                      (state.manifest?.counts.answerSheetImages || 0)}枚
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleExecute} size="lg" className="gap-2 px-8">
          <Download className="w-5 h-5" />
          インポートを実行
        </Button>
      </div>
    )
  }

  // 実行中
  if (isExecuting) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <h3 className="text-xl font-semibold mb-2">インポート中...</h3>
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
      <div className="flex flex-col items-center justify-center h-full py-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            インポートが完了しました
          </h3>
          <p className="text-muted-foreground">
            プロジェクトが正常にインポートされました。
          </p>
        </div>

        {/* 結果サマリー */}
        {"importedCounts" in result && result.importedCounts && (
          <Card className="w-full max-w-md mb-6 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CardContent className="p-5">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-4">
                インポート結果
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.importedCounts.students}
                  </div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80">
                    生徒
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.importedCounts.pages}
                  </div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80">
                    ページ
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.importedCounts.scores}
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
          <Card className="w-full max-w-md mb-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
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
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    )
  }

  // 完了（失敗）
  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <XCircle className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-2">
          インポートに失敗しました
        </h3>
        <p className="text-destructive max-w-md">{result?.error}</p>
      </div>

      <Button onClick={onClose} variant="outline" size="lg">
        閉じる
      </Button>
    </div>
  )
}
