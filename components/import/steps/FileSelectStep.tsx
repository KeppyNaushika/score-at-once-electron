"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import { Upload, FileArchive, Loader2, CheckCircle2, Info } from "lucide-react"

interface FileSelectStepProps {
  wizard: UseImportWizardReturn
}

export function FileSelectStep({ wizard }: FileSelectStepProps) {
  const { state, selectFile } = wizard

  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      {/* メインコンテンツ */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileArchive className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          プロジェクトアーカイブを選択
        </h3>
        <p className="text-muted-foreground max-w-md">
          エクスポートされた .score ファイルを選択してください。
          ファイルにはプロジェクトデータ、採点結果、画像が含まれています。
        </p>
      </div>

      {/* ファイル選択ボタン */}
      <Button
        onClick={selectFile}
        disabled={state.isProcessing}
        size="lg"
        className="gap-2 px-8 h-12 text-base"
      >
        {state.isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            読み込み中...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            ファイルを選択
          </>
        )}
      </Button>

      {/* 対応ファイル形式 */}
      <Card className="mt-10 w-full max-w-md bg-muted/50 border-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">
              対応ファイル形式
            </h4>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Score at Once アーカイブ (.score)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
