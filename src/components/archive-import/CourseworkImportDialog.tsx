"use client"

import { useMutation } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ImportActionChoice } from "@/components/import/ImportActionChoice"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { importCourseworkArchiveMutation } from "@/queries/coursework"
import type {
  CourseworkArchiveImportPreview,
  CourseworkImportDecision,
} from "@/types/courseworkArchive.types"
import type { ImportAction } from "@/types/importAction.types"

interface CourseworkImportDialogProps {
  /** 取り込むファイル。中身は持たず、実行時に main が読み直す */
  archivePath: string
  /** 一覧の「読み込み」でファイルを読んだときの照合の結果 */
  preview: CourseworkArchiveImportPreview
  /** 取り込んだとき・やめたとき */
  onClose: () => void
}

/** 選択値 → 決定。"new" または "reuse:<existingId>" */
function valueToDecision(value: string): CourseworkImportDecision {
  if (value === "new") return { action: "new" }
  return { action: "reuse", existingId: value.slice("reuse:".length) }
}

/**
 * 試験外成績資料アーカイブ（.coursework）のインポート確認ウィザード。
 * 資料ごとに「既存へ統合（uuid一致 / 名前候補）」か「新規作成」かを選ばせる。
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
  // ユーザーが明示的に変更した分のみ保持する。どの preview に対する選択かを
  // 一緒に持ち、preview が切り替わったら前回の選択は無効になる
  const [action, setAction] = useState<ImportAction>("merge")
  const [manualSelections, setManualSelections] = useState<{
    preview: CourseworkArchiveImportPreview | null
    values: Record<string, string>
  }>({ preview: null, values: {} })
  const selections = useMemo(
    () => (manualSelections.preview === preview ? manualSelections.values : {}),
    [manualSelections, preview]
  )

  const selectArchive = (archiveId: string, value: string) => {
    setManualSelections({
      preview,
      values: { ...selections, [archiveId]: value },
    })
  }

  const initialSelections = useMemo(() => {
    const init: Record<string, string> = {}
    for (const coursework of preview.matches) {
      init[coursework.archiveId] = coursework.uuidMatch
        ? `reuse:${coursework.uuidMatch.id}`
        : "new"
    }
    return init
  }, [preview])

  const effectiveSelections = useMemo(
    () => ({ ...initialSelections, ...selections }),
    [initialSelections, selections]
  )

  const importing = importArchive.isPending

  const handleConfirm = async () => {
    const decisions: Record<string, CourseworkImportDecision> = {}
    for (const coursework of preview.matches) {
      decisions[coursework.archiveId] = valueToDecision(
        effectiveSelections[coursework.archiveId] ?? "new"
      )
    }
    try {
      const result = await importArchive.mutateAsync({
        archivePath,
        courseworkDecisions: decisions,
        action,
      })
      if (result.warnings.length > 0) {
        toast.warning(
          `インポートは完了しましたが ${result.warnings.length} 件の警告があります`,
          {
            description: result.warnings.join("\n"),
            duration: Infinity,
            closeButton: true,
          }
        )
      } else {
        toast.success("資料をインポートしました")
      }
    } catch {
      // 失敗の通知は MutationCache が出す
    }
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => !nextOpen && !importing && onClose()}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>試験外成績資料のインポート</DialogTitle>
          <DialogDescription>
            資料ごとの取り込み方法を選択してください。
          </DialogDescription>
        </DialogHeader>

        {/* 取り込みの方針（この1つが読み込む全ての値に効く）。
            「別で追加する」は下の資料ごとの選択で「新規作成」を選ぶことに当たるので、
            ここには出さない */}
        <ImportActionChoice
          action={action}
          onChange={setAction}
          allowSeparate={false}
        />

        <ScrollArea className="max-h-[60vh] pr-4">
          {preview.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              取り込む試験外成績資料はありません。
            </p>
          ) : (
            <div className="space-y-4">
              {preview.matches.map((coursework) => (
                <div key={coursework.archiveId} className="rounded border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {coursework.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      （評価項目 {coursework.itemCount} ・名簿{" "}
                      {coursework.studentCount}名）
                    </span>
                  </div>
                  <RadioGroup
                    value={effectiveSelections[coursework.archiveId] ?? "new"}
                    onValueChange={(value) =>
                      selectArchive(coursework.archiveId, value)
                    }
                    className="space-y-1"
                  >
                    {coursework.uuidMatch && (
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value={`reuse:${coursework.uuidMatch.id}`}
                          id={`${coursework.archiveId}-uuid`}
                        />
                        <Label
                          htmlFor={`${coursework.archiveId}-uuid`}
                          className="text-sm font-normal"
                        >
                          既存へ統合（同一データ・uuid一致）:{" "}
                          {coursework.uuidMatch.name}
                        </Label>
                      </div>
                    )}
                    {coursework.nameCandidates.map((nameCandidate) => (
                      <div
                        key={nameCandidate.id}
                        className="flex items-center gap-2"
                      >
                        <RadioGroupItem
                          value={`reuse:${nameCandidate.id}`}
                          id={`${coursework.archiveId}-${nameCandidate.id}`}
                        />
                        <Label
                          htmlFor={`${coursework.archiveId}-${nameCandidate.id}`}
                          className="text-sm font-normal"
                        >
                          既存へ統合（名前一致）: {nameCandidate.name}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="new"
                        id={`${coursework.archiveId}-new`}
                      />
                      <Label
                        htmlFor={`${coursework.archiveId}-new`}
                        className="text-sm font-normal"
                      >
                        新規作成（別の資料として取り込む）
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            キャンセル
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={importing}>
            {importing ? "インポート中..." : "インポート"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
