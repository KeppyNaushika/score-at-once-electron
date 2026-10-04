"use client"

import { useMutation } from "@tanstack/react-query"
import { FolderInput } from "lucide-react"
import { type ComponentProps, useCallback } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  importAnswerSheetDefinitionMutation,
  selectAnswerSheetImportFileMutation,
} from "@/queries/answerSheetBuilder"

interface ImportDefinitionButtonProps extends Pick<
  ComponentProps<typeof Button>,
  "variant" | "className"
> {
  userId: string
}

/** .asb ファイルを選んで解答用紙を読み込むボタン */
export function ImportDefinitionButton({
  userId,
  variant,
  className,
}: ImportDefinitionButtonProps) {
  const { mutateAsync: selectImportFile } = useMutation(
    selectAnswerSheetImportFileMutation()
  )
  const { mutateAsync: importDefinition } = useMutation(
    importAnswerSheetDefinitionMutation()
  )

  const handleImport = useCallback(async () => {
    try {
      // 1. ファイル選択
      const fileResult = await selectImportFile()
      if (fileResult.canceled) return

      // 2. インポート実行
      const { warnings } = await importDefinition({
        filePath: fileResult.filePath,
        userId,
      })
      toast.success("解答用紙を読み込みました")
      for (const warning of warnings) {
        toast.warning(warning)
      }
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [userId, selectImportFile, importDefinition])

  return (
    <Button
      onClick={handleImport}
      variant={variant}
      size="sm"
      className={className}
    >
      <FolderInput className="mr-2 h-4 w-4" />
      .asb 読み込み
    </Button>
  )
}
