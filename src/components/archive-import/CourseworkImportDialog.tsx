"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { ImportActionChoice } from "@/components/import/ImportActionChoice"
import { ScrollArea } from "@/components/ui/scroll-area"
import { importCourseworkArchiveMutation } from "@/queries/coursework"
import type { CourseworkArchiveImportPreview } from "@/types/courseworkArchive.types"
import type { ImportAction } from "@/types/importAction.types"

import { CourseworkDecisionList } from "./CourseworkDecisionList"
import { useCourseworkImportDecisions } from "./hooks/useCourseworkImportDecisions"
import { ImportWarningList } from "./ImportWarningList"
import { LegacyArchiveImportDialogFrame } from "./LegacyArchiveImportDialogFrame"
import { toastImportWarnings } from "./toastImportWarnings"

interface CourseworkImportDialogProps {
  /** 取り込むファイル。中身は持たず、実行時に main が読み直す */
  archivePath: string
  /** 一覧の「読み込み」でファイルを読んだときの照合の結果 */
  preview: CourseworkArchiveImportPreview
  /** 取り込んだとき・やめたとき */
  onClose: () => void
}

/**
 * 試験外成績資料アーカイブ（.coursework）のインポート確認ウィザード。
 * 資料ごとに「既存に取り込む（uuid一致 / 名前候補）」か「新規作成」かを選ばせる。
 * uuid一致があれば既定で統合、無ければ新規作成を初期選択にする。
 *
 * 一覧の「読み込み」で .coursework を選んだときに開く（ファイルは選び終えている）。
 */
export function CourseworkImportDialog({
  archivePath,
  preview,
  onClose,
}: CourseworkImportDialogProps) {
  const importArchive = useMutation(importCourseworkArchiveMutation())
  const [action, setAction] = useState<ImportAction>("merge")
  const { effectiveSelections, selectArchive, buildDecisions } =
    useCourseworkImportDecisions(preview.matches)

  const importing = importArchive.isPending

  const handleConfirm = async () => {
    try {
      const result = await importArchive.mutateAsync({
        archivePath,
        courseworkDecisions: buildDecisions(),
        action,
      })
      if (!toastImportWarnings(result.warnings)) {
        toast.success("資料を取り込みました")
      }
    } catch {
      // 失敗の通知は MutationCache が出す
    }
    onClose()
  }

  return (
    <LegacyArchiveImportDialogFrame
      title="試験外成績資料の取り込み"
      description="資料ごとの取り込み方法を選択してください。"
      importing={importing}
      onConfirm={() => void handleConfirm()}
      onClose={onClose}
    >
      {/* 取り込みの方針（この1つが読み込む全ての値に効く）。
          「別で追加する」は下の資料ごとの選択で「新規作成」を選ぶことに当たるので、
          ここには出さない */}
      <ImportActionChoice
        action={action}
        onChange={setAction}
        allowSeparate={false}
      />

      <ScrollArea className="max-h-[60vh] pr-4">
        {/* 版の確認・変換で失われるデータの警告（取り込み前に見せる。
            取り込んだ後のトーストには版の確認の警告は入らない） */}
        <ImportWarningList
          warnings={preview.warnings}
          heading="取り込む前に確認してください"
        />
        <CourseworkDecisionList
          courseworkMatches={preview.matches}
          effectiveSelections={effectiveSelections}
          onSelect={selectArchive}
        />
      </ScrollArea>
    </LegacyArchiveImportDialogFrame>
  )
}
