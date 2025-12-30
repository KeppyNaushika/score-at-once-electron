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
    <div className="flex h-full flex-col items-center justify-center py-8">
      {/* メインコンテンツ */}
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <FileArchive className="text-primary h-10 w-10" />
        </div>
        <h3 className="text-foreground mb-2 text-xl font-semibold">
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
        className="h-12 gap-2 px-8 text-base"
      >
        {state.isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            読み込み中...
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            ファイルを選択
          </>
        )}
      </Button>

      {/* 対応ファイル形式 */}
      <Card className="bg-muted/50 border-muted mt-10 w-full max-w-md">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="text-muted-foreground h-4 w-4" />
            <h4 className="text-foreground text-sm font-medium">
              対応ファイル形式
            </h4>
          </div>
          <ul className="space-y-2">
            <li className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Score at Once アーカイブ (.score)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
