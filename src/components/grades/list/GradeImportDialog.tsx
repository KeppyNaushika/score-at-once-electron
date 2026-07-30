"use client"

import { TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
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
import type { CourseworkImportDecision } from "@/types/courseworkArchive.types"
import type { GradeArchiveImportPreview } from "@/types/gradeArchive.types"

interface GradeImportDialogProps {
  open: boolean
  preview: GradeArchiveImportPreview | null
  importing: boolean
  onCancel: () => void
  onConfirm: (decisions: Record<string, CourseworkImportDecision>) => void
}

/** 各資料の選択肢の値 → 決定 への変換キー。"new" または "reuse:<existingId>" */
function valueToDecision(value: string): CourseworkImportDecision {
  if (value === "new") return { action: "new" }
  return { action: "reuse", existingId: value.slice("reuse:".length) }
}

/**
 * 成績アーカイブのインポート確認ウィザード
 *
 * 学級/試験/生徒の照合結果を提示し、埋め込み資料（Coursework）ごとに
 * 「既存へ統合（uuid一致 / 名前候補）」か「新規作成」かをユーザーに判断させる。
 * uuid一致があれば既定で統合、無ければ新規作成を初期選択にする。
 */
export function GradeImportDialog({
  open,
  preview,
  importing,
  onCancel,
  onConfirm,
}: GradeImportDialogProps) {
  // archiveId → 選択値（"new" | "reuse:<id>"）。ユーザーが明示的に変更した分のみ保持。
  const [selections, setSelections] = useState<Record<string, string>>({})

  // preview が切り替わったら手動選択をリセット（前回インポートの選択が残らないように）
  useEffect(() => {
    setSelections({})
  }, [preview])

  // preview が変わったら初期選択を計算（uuid一致→統合、無ければ新規）
  const initialSelections = useMemo(() => {
    const init: Record<string, string> = {}
    for (const courseworkMatch of preview?.courseworkMatches ?? []) {
      init[courseworkMatch.archiveId] = courseworkMatch.uuidMatch
        ? `reuse:${courseworkMatch.uuidMatch.id}`
        : "new"
    }
    return init
  }, [preview])

  // 初期選択を反映（preview切替時）
  const effectiveSelections = useMemo(
    () => ({ ...initialSelections, ...selections }),
    [initialSelections, selections]
  )

  if (!preview) return null

  const classroomMatched = preview.classroomMatches.filter(
    (classroomMatch) => classroomMatch.found
  ).length
  const examMatched = preview.examMatches.filter(
    (examMatch) => examMatch.found
  ).length

  const handleConfirm = () => {
    const decisions: Record<string, CourseworkImportDecision> = {}
    for (const courseworkMatch of preview.courseworkMatches) {
      decisions[courseworkMatch.archiveId] = valueToDecision(
        effectiveSelections[courseworkMatch.archiveId] ?? "new"
      )
    }
    onConfirm(decisions)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>成績アーカイブのインポート</DialogTitle>
          <DialogDescription>
            照合結果を確認し、試験外成績資料の取り込み方法を選択してください。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* 照合サマリ */}
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">
              学級 {classroomMatched}/{preview.classroomMatches.length} 一致
            </Badge>
            <Badge variant="outline">
              試験 {examMatched}/{preview.examMatches.length} 一致
            </Badge>
            <Badge variant="outline">
              生徒 {preview.studentMatchCount} 一致
            </Badge>
            {preview.studentCreateCount > 0 && (
              <Badge variant="secondary">
                生徒 {preview.studentCreateCount} 名を新規登録
              </Badge>
            )}
            {preview.classroomCreateCount > 0 && (
              <Badge variant="secondary">
                学級 {preview.classroomCreateCount} 件を新規登録
              </Badge>
            )}
            {preview.studentSkipCount > 0 && (
              <Badge variant="destructive">
                生徒 {preview.studentSkipCount} 名が見つかりません
              </Badge>
            )}
          </div>

          {/* 生徒マスタ・学級マスタへ書き込むことは事前に明示する。
              取り込みは成績を作るだけでなく、既存に無い生徒・学級を登録する */}
          {(preview.studentCreateCount > 0 ||
            preview.classroomCreateCount > 0) && (
            <div className="border-border/60 bg-muted/40 mb-4 rounded border p-3 text-sm">
              <div className="mb-1 font-medium">
                この取り込みで生徒・学級が追加されます
              </div>
              <p className="text-muted-foreground">
                既存の生徒・学級に一致しなかったものを新しく登録します
                {preview.studentCreateCount > 0 && (
                  <>（生徒 {preview.studentCreateCount} 名</>
                )}
                {preview.studentCreateCount > 0 &&
                  preview.classroomCreateCount > 0 &&
                  " / "}
                {preview.classroomCreateCount > 0 && (
                  <>学級 {preview.classroomCreateCount} 件</>
                )}
                {(preview.studentCreateCount > 0 ||
                  preview.classroomCreateCount > 0) && <>）</>}
                。学籍番号・学級名が既存と重なる場合は末尾に連番を付けて登録します。
              </p>
            </div>
          )}

          {preview.studentSkipCount > 0 && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
              <div className="mb-1 font-medium text-amber-800 dark:text-amber-300">
                生徒 {preview.studentSkipCount} 名は取り込めません
              </div>
              <p className="text-muted-foreground">
                古い形式のアーカイブは生徒の氏名を持たないため、この生徒は登録できません。
                先に生徒を登録してから取り込み直すと、その生徒の成績も一緒に戻ります。
              </p>
            </div>
          )}

          {/* 変換で失われるデータの警告（取り込み前に見せる） */}
          {preview.warnings.length > 0 && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                <TriangleAlert className="h-4 w-4" />
                取り込み時に失われるデータがあります
              </div>
              <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 資料ごとの判断 */}
          {preview.courseworkMatches.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              取り込む試験外成績資料はありません。
            </p>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">
                試験外成績資料の取り込み
              </h3>
              {preview.courseworkMatches.map((courseworkMatch) => (
                <div
                  key={courseworkMatch.archiveId}
                  className="rounded border p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {courseworkMatch.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      （評価項目 {courseworkMatch.itemCount} ・名簿{" "}
                      {courseworkMatch.studentCount}名）
                    </span>
                  </div>
                  <RadioGroup
                    value={
                      effectiveSelections[courseworkMatch.archiveId] ?? "new"
                    }
                    onValueChange={(value) =>
                      setSelections((prev) => ({
                        ...prev,
                        [courseworkMatch.archiveId]: value,
                      }))
                    }
                    className="space-y-1"
                  >
                    {courseworkMatch.uuidMatch && (
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value={`reuse:${courseworkMatch.uuidMatch.id}`}
                          id={`${courseworkMatch.archiveId}-uuid`}
                        />
                        <Label
                          htmlFor={`${courseworkMatch.archiveId}-uuid`}
                          className="text-sm font-normal"
                        >
                          既存へ統合（同一データ・uuid一致）:{" "}
                          {courseworkMatch.uuidMatch.name}
                        </Label>
                      </div>
                    )}
                    {courseworkMatch.nameCandidates.map((nameCandidate) => (
                      <div
                        key={nameCandidate.id}
                        className="flex items-center gap-2"
                      >
                        <RadioGroupItem
                          value={`reuse:${nameCandidate.id}`}
                          id={`${courseworkMatch.archiveId}-${nameCandidate.id}`}
                        />
                        <Label
                          htmlFor={`${courseworkMatch.archiveId}-${nameCandidate.id}`}
                          className="text-sm font-normal"
                        >
                          既存へ統合（名前一致）: {nameCandidate.name}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="new"
                        id={`${courseworkMatch.archiveId}-new`}
                      />
                      <Label
                        htmlFor={`${courseworkMatch.archiveId}-new`}
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
