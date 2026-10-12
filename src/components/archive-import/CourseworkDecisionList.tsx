"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { CourseworkArchiveMatch } from "@/types/courseworkArchive.types"

interface CourseworkDecisionListProps {
  courseworkMatches: CourseworkArchiveMatch[]
  /** archiveId → 選択値（"new" | "reuse:<id>"）。`useCourseworkImportDecisions` の値 */
  effectiveSelections: Record<string, string>
  onSelect: (archiveId: string, value: string) => void
  /** 一覧の上に置く見出し（資料が1件も無いときは出さない） */
  heading?: string
}

/**
 * 旧形式（.coursework / .grade）の取り込みで、資料ごとに
 * 「既存に取り込む（uuid一致 / 名前候補）」か「新規作成」かを選ぶ一覧
 */
export function CourseworkDecisionList({
  courseworkMatches,
  effectiveSelections,
  onSelect,
  heading,
}: CourseworkDecisionListProps) {
  if (courseworkMatches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        取り込む試験外成績資料はありません。
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {heading && <h3 className="text-sm font-semibold">{heading}</h3>}
      {courseworkMatches.map((courseworkMatch) => (
        <div key={courseworkMatch.archiveId} className="rounded border p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium">{courseworkMatch.name}</span>
            <span className="text-xs text-muted-foreground">
              （資料評価項目 {courseworkMatch.itemCount} ・名簿{" "}
              {courseworkMatch.studentCount}名）
            </span>
          </div>
          <RadioGroup
            value={effectiveSelections[courseworkMatch.archiveId] ?? "new"}
            onValueChange={(value) =>
              onSelect(courseworkMatch.archiveId, value)
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
                  既存に取り込む（同一データ・uuid一致）:{" "}
                  {courseworkMatch.uuidMatch.name}
                </Label>
              </div>
            )}
            {courseworkMatch.nameCandidates.map((nameCandidate) => (
              <div key={nameCandidate.id} className="flex items-center gap-2">
                <RadioGroupItem
                  value={`reuse:${nameCandidate.id}`}
                  id={`${courseworkMatch.archiveId}-${nameCandidate.id}`}
                />
                <Label
                  htmlFor={`${courseworkMatch.archiveId}-${nameCandidate.id}`}
                  className="text-sm font-normal"
                >
                  既存に取り込む（名前一致）: {nameCandidate.name}
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
  )
}
