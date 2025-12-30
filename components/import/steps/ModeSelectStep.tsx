"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import {
  FilePlus2,
  GitMerge,
  Calendar,
  Users,
  FileText,
  ClipboardCheck,
  Image,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ModeSelectStepProps {
  wizard: UseImportWizardReturn
}

export function ModeSelectStep({ wizard }: ModeSelectStepProps) {
  const { state, selectMode } = wizard
  const manifest = state.manifest

  return (
    <div className="space-y-6">
      {/* アーカイブ情報 */}
      {manifest && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              アーカイブ情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">プロジェクト名</p>
                <p className="font-medium">{manifest.projectName}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">エクスポート日時</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(manifest.exportedAt).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>

            {/* データ件数 */}
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">含まれるデータ</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Users className="w-3 h-3" />
                  生徒 {manifest.counts.students}名
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <FileText className="w-3 h-3" />
                  ページ {manifest.counts.pages}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  設問 {manifest.counts.regions}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <ClipboardCheck className="w-3 h-3" />
                  採点 {manifest.counts.scores}件
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Image className="w-3 h-3" aria-hidden="true" />
                  画像 {manifest.counts.masterImages + manifest.counts.answerSheetImages}枚
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* モード選択 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">インポートモードを選択</h3>

        <div className="grid gap-4">
          {/* 新規作成モード */}
          <button
            onClick={() => selectMode("new")}
            className={cn(
              "w-full p-5 rounded-xl border-2 text-left transition-all",
              "hover:border-primary hover:bg-primary/5",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "group"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <FilePlus2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">新規作成</h4>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  全てのデータを新しいプロジェクトとして作成します。
                  既存データとの統合は行いません。
                </p>
                <Badge variant="outline" className="mt-3 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950">
                  推奨: 新しいマシンへの移行時
                </Badge>
              </div>
            </div>
          </button>

          {/* 統合モード */}
          <button
            onClick={() => selectMode("merge")}
            className={cn(
              "w-full p-5 rounded-xl border-2 text-left transition-all",
              "hover:border-primary hover:bg-primary/5",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "group"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                <GitMerge className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">統合</h4>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  既存の生徒・学級データとマッチングし、採点結果を統合します。
                  競合がある場合は解決方法を選択できます。
                </p>
                <Badge variant="outline" className="mt-3 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950">
                  推奨: 複数マシンでの採点結果を統合する場合
                </Badge>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
