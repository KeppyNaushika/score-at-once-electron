"use client"

import { CheckCircle2, FileArchive, Info, Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"

interface FileSelectStepProps {
  wizard: UseImportWizardReturn
}

export function FileSelectStep({ wizard }: FileSelectStepProps) {
  const { state, selectFile } = wizard

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      {/* メインコンテンツ */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-32 items-center justify-center rounded-2xl bg-primary/10">
          <FileArchive className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-foreground">
          試験アーカイブを選択
        </h3>
        <p className="max-w-lg text-muted-foreground">
          エクスポートされた .score ファイルを選択してください。
          <br />
          ファイルには試験データ、 採点結果、画像が含まれています。
        </p>
        <p className="mt-2 max-w-lg text-muted-foreground">
          エクスポートしたときにログインしていたユーザーにかかわらず、
          <br />
          現在ログインしているユーザーの試験として追加されます。
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
      <Card className="mt-10 w-full max-w-md border-muted bg-muted/50">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">
              対応ファイル形式
            </h4>
          </div>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              一括採点試験データ (.score)
            </li>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              百問繚乱&trade;データ（採点情報のみ）(.hsz)
            </li>
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              リアテンダント&trade;データ（採点情報のみ）(.dat)
            </li>
          </ul>
          <div className="mt-3 text-[10px] leading-relaxed text-muted-foreground/60">
            <p>
              「百問繚乱」は、株式会社シンプルエデュケーションの登録商標または商標です。
            </p>
            <p>
              「リアテンダント」は、大日本印刷株式会社の登録商標または商標です。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
