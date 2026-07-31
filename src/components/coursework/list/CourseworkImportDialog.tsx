"use client"

import { useEffect, useMemo, useState } from "react"

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
import type {
  CourseworkArchiveImportPreview,
  CourseworkImportDecision,
} from "@/types/courseworkArchive.types"

interface CourseworkImportDialogProps {
  open: boolean
  preview: CourseworkArchiveImportPreview | null
  importing: boolean
  onCancel: () => void
  onConfirm: (decisions: Record<string, CourseworkImportDecision>) => void
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
 */
export function CourseworkImportDialog({
  open,
  preview,
  importing,
  onCancel,
  onConfirm,
}: CourseworkImportDialogProps) {
  const [selections, setSelections] = useState<Record<string, string>>({})

  useEffect(() => {
    setSelections({})
  }, [preview])

  const initialSelections = useMemo(() => {
    const init: Record<string, string> = {}
    for (const coursework of preview?.matches ?? []) {
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

  if (!preview) return null

  const handleConfirm = () => {
    const decisions: Record<string, CourseworkImportDecision> = {}
    for (const coursework of preview.matches) {
      decisions[coursework.archiveId] = valueToDecision(
        effectiveSelections[coursework.archiveId] ?? "new"
      )
    }
    onConfirm(decisions)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>試験外成績資料のインポート</DialogTitle>
          <DialogDescription>
            資料ごとの取り込み方法を選択してください。
          </DialogDescription>
        </DialogHeader>

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
                      setSelections((prev) => ({
                        ...prev,
                        [coursework.archiveId]: value,
                      }))
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
          <Button variant="ghost" onClick={onCancel} disabled={importing}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm} disabled={importing}>
            {importing ? "インポート中..." : "インポート"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
