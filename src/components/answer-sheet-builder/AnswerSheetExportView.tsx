"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FileImage, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { parsePreference } from "@/lib/userPreferences"
import { answerSheetDefinitionQuery } from "@/queries/answerSheetBuilder"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"

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
  const currentUser = useCurrentUser()
  const { exportPdf, exportPng, isExporting } = useAnswerSheetExport()
  const [dpi, setDpi] = useState(300)

  // 前に選んだものに従う（この解答用紙ではなく、使う人に付く設定）
  const { data: storedSeparateFiles } = useQuery(
    userPreferenceQuery(currentUser.id, "asbExportSeparateFiles")
  )
  const separateFiles = parsePreference(
    "asbExportSeparateFiles",
    storedSeparateFiles ?? null
  )
  const { mutate: setPreference } = useMutation(
    setUserPreferenceMutation(currentUser.id)
  )
  const {
    data: definition = null,
    isPending,
    error: loadError,
  } = useQuery(answerSheetDefinitionQuery(definitionId))

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
          解答用紙が見つかりませんでした
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

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="separate-files" className="text-sm">
            解答用紙と模範解答を別のファイルにする
          </Label>
          <p className="text-xs text-muted-foreground">
            {separateFiles
              ? `${definition.name} と ${definition.name}_模範解答`
              : "1つのファイルに、解答用紙のあとへ模範解答を続ける"}
          </p>
        </div>
        <Switch
          id="separate-files"
          checked={separateFiles}
          onCheckedChange={(checked) =>
            setPreference({ key: "asbExportSeparateFiles", value: checked })
          }
        />
      </div>

      <Button
        variant="outline"
        className="h-12 w-full justify-start gap-3"
        disabled={isExporting}
        onClick={() => exportPdf(definition, { separateFiles })}
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
          onClick={() => exportPng(definition, dpi, { separateFiles })}
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

      <ExamIntegrationCard definition={definition} />
    </div>
  )
}
