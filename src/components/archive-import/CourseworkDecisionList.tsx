"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CourseworkArchiveMatch } from "@/types/courseworkArchive.types"

type CourseworkAdoptId = "existing" | "archive"

const isCourseworkAdoptId = (value: string): value is CourseworkAdoptId =>
  value === "existing" || value === "archive"

interface CourseworkDecisionListProps {
  courseworkMatches: CourseworkArchiveMatch[]
  /** archiveId → 選択値（"new" | "reuse:<id>"）。`useCourseworkImportDecisions` の値 */
  effectiveSelections: Record<string, string>
  onSelect: (archiveId: string, value: string) => void
  /** 既存の資料に取り込むとき、id をどちらに合わせるか */
  adoptIdOf: (archiveId: string) => CourseworkAdoptId
  onSelectAdoptId: (archiveId: string, adoptId: CourseworkAdoptId) => void
  /** 一覧の上に置く見出し（資料が1件も無いときは出さない） */
  heading?: string
}

/**
 * 旧形式（.coursework / .grade）の取り込みで、資料ごとに
 * 「既存に取り込む（名前の候補）」か「新規作成」かを選ぶ一覧。
 *
 * id が一致する資料は選ばせない（同じ資料として取り込む）。既存に取り込むときは、
 * id をこのPC／ファイルのどちらに合わせるかも選ぶ
 */
export function CourseworkDecisionList({
  courseworkMatches,
  effectiveSelections,
  onSelect,
  adoptIdOf,
  onSelectAdoptId,
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
      {courseworkMatches.map((courseworkMatch) => {
        const selection =
          effectiveSelections[courseworkMatch.archiveId] ?? "new"
        return (
          <div key={courseworkMatch.archiveId} className="rounded border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium">
                {courseworkMatch.name}
              </span>
              <span className="text-xs text-muted-foreground">
                （資料評価項目 {courseworkMatch.itemCount} ・名簿{" "}
                {courseworkMatch.studentCount}名）
              </span>
            </div>
            {courseworkMatch.uuidMatch ? (
              <p className="text-sm text-muted-foreground">
                このPCに同じ資料（{courseworkMatch.uuidMatch.name}
                ）があるため、同じ資料として取り込みます
              </p>
            ) : (
              <>
                <RadioGroup
                  value={selection}
                  onValueChange={(value) =>
                    onSelect(courseworkMatch.archiveId, value)
                  }
                  className="space-y-1"
                >
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
                {selection !== "new" && (
                  <div className="mt-2 ml-6 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      どちらの id に合わせる？
                    </p>
                    <Select
                      value={adoptIdOf(courseworkMatch.archiveId)}
                      onValueChange={(value) => {
                        if (isCourseworkAdoptId(value)) {
                          onSelectAdoptId(courseworkMatch.archiveId, value)
                        }
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`${courseworkMatch.name}の id`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">
                          このPCの id に合わせる
                        </SelectItem>
                        <SelectItem value="archive">
                          ファイルの id に合わせる
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
