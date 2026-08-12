"use client"

import { useQuery } from "@tanstack/react-query"
import { FileImage, FileText, Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { queryKeys } from "@/lib/queryKeys"

import { ExamIntegrationCard } from "./components/export/ExamIntegrationCard"
import { useAnswerSheetExport } from "./hooks/useAnswerSheetExport"

interface AnswerSheetExportViewProps {
  definitionId: string
}

/**
 * 解答用紙の書き出しページ。
 * PDF/PNG出力・印刷を提供する（旧 ExportDialog をページ化したもの）。
 */
export function AnswerSheetExportView({
  definitionId,
}: AnswerSheetExportViewProps) {
  const { exportPdf, exportPng, printSheet, isExporting } =
    useAnswerSheetExport()
  const [dpi, setDpi] = useState(300)
  const {
    data: definition = null,
    isPending,
    error: loadError,
  } = useQuery({
    queryKey: queryKeys.answerSheetDefinition.detail(definitionId),
    queryFn: () =>
      window.electronAPI.answerSheetBuilder.loadDefinition(definitionId),
  })

  // 読み込みの失敗は通知する（取得ではないので effect でよい）
  useEffect(() => {
    if (loadError) toast.error(loadError.message)
  }, [loadError])

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!definition) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          定義が見つかりませんでした
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">解答用紙を書き出し</h2>
        <p className="text-sm text-muted-foreground">{definition.name}</p>
      </div>

      <Button
        variant="outline"
        className="h-12 w-full justify-start gap-3"
        disabled={isExporting}
        onClick={() => exportPdf(definition)}
      >
        <FileText className="h-5 w-5 text-red-500" />
        <div className="text-left">
          <div className="text-sm font-medium">PDF出力</div>
          <div className="text-xs text-muted-foreground">印刷用ベクターPDF</div>
        </div>
      </Button>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="h-12 w-full justify-start gap-3"
          disabled={isExporting || dpi < 72}
          onClick={() => exportPng(definition, dpi)}
        >
          <FileImage className="h-5 w-5 text-blue-500" />
          <div className="text-left">
            <div className="text-sm font-medium">PNG出力</div>
            <div className="text-xs text-muted-foreground">
              ラスター画像（{dpi} DPI）
            </div>
          </div>
        </Button>
        <div className="flex items-center gap-2 pl-2">
          <Label className="text-xs text-muted-foreground">DPI:</Label>
          <Input
            type="number"
            className="h-7 w-20 text-xs"
            value={dpi}
            min={72}
            max={600}
            step={50}
            onChange={(e) => setDpi(Number(e.target.value))}
          />
        </div>
      </div>

      <Button
        variant="outline"
        className="h-12 w-full justify-start gap-3"
        disabled={isExporting}
        onClick={() => printSheet(definition)}
      >
        <Printer className="h-5 w-5 text-green-500" />
        <div className="text-left">
          <div className="text-sm font-medium">印刷</div>
          <div className="text-xs text-muted-foreground">
            システム印刷ダイアログを表示
          </div>
        </div>
      </Button>

      <ExamIntegrationCard definition={definition} />
    </div>
  )
}
