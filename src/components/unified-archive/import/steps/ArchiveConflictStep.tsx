"use client"

import { CheckCircle2, GitMerge } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ArchiveIdChoice } from "@/electron-src/lib/import/unified-archive/types"

import { archiveColumnLabel, archiveTableLabel } from "../../archiveTableLabels"
import { uniqueKeyValueText } from "../archiveImportLabels"
import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"
import type { ArchiveUniqueConflict } from "../types"
import { StepNextButton } from "./StepNextButton"
import { UnresolvableReasonList } from "./UnresolvableReasonList"

const isArchiveIdChoice = (value: string): value is ArchiveIdChoice =>
  value === "existing" || value === "archive"

const ID_CHOICE_LABELS: Record<ArchiveIdChoice, string> = {
  existing: "このパソコンの id",
  archive: "アーカイブの id",
}

/** 衝突1件の決定のキー（main の archiveRowKey と同じ形） */
const conflictRowKey = (conflict: ArchiveUniqueConflict): string =>
  `${conflict.table}:${conflict.archiveId}`

/**
 * 4. 一意制約の衝突（設計 §7.3）。id は違うが一意キーが同じ行を、どちらの id で1つに
 * するか選ぶ。一括の選択と、1件ずつの切り替え。別で追加では既存の行に固定する
 */
export function ArchiveConflictStep({
  wizard,
}: {
  wizard: UnifiedArchiveImportWizardState
}) {
  const {
    action,
    lastAnalysis,
    conflictIdChoice,
    setConflictIdChoice,
    conflictIdOverrides,
    setConflictIdOverride,
    goNext,
    isProcessing,
  } = wizard
  const isSeparate = action === "separate"
  const conflicts =
    lastAnalysis?.kind === "ok" ? lastAnalysis.result.uniqueConflicts : []
  const conflictsByTable = new Map<string, ArchiveUniqueConflict[]>()
  for (const conflict of conflicts) {
    conflictsByTable.set(conflict.table, [
      ...(conflictsByTable.get(conflict.table) ?? []),
      conflict,
    ])
  }

  const bulkChoice = !isSeparate && (
    <Card className="mb-4">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">採用する id（一括）</p>
        <RadioGroup
          value={conflictIdChoice}
          onValueChange={(value) => {
            if (isArchiveIdChoice(value)) setConflictIdChoice(value)
          }}
          className="gap-2"
        >
          {(["existing", "archive"] as const).map((choice) => (
            <div key={choice} className="flex items-center gap-3">
              <RadioGroupItem value={choice} id={`conflict-bulk-${choice}`} />
              <Label
                htmlFor={`conflict-bulk-${choice}`}
                className="font-normal"
              >
                {ID_CHOICE_LABELS[choice]} に合わせる
                {choice === "existing" && "（おすすめ）"}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          このパソコンの id
          は、同期している他のパソコンで既に使われていることがあるため、ふだんはこのパソコンの
          id に合わせます。
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <GitMerge className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">同じ値の行の扱い</h3>
        <p className="mx-auto max-w-lg text-muted-foreground">
          id
          は違うのに、同じでなければならない値が重なった行です。1つにまとめます。
        </p>
      </div>

      {lastAnalysis?.kind === "unresolvable" && (
        <div className="mb-4">
          <UnresolvableReasonList reasons={lastAnalysis.reasons} />
        </div>
      )}

      {lastAnalysis?.kind === "ok" && conflicts.length === 0 ? (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardContent className="flex items-center justify-center gap-2 p-4 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5" />
            衝突はありません
          </CardContent>
        </Card>
      ) : (
        <>
          {bulkChoice}
          {isSeparate && conflicts.length > 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              別で追加では、このパソコンの行に触りません。重なった行は既存の行に合わせます。
            </p>
          )}
          <div className="space-y-4">
            {[...conflictsByTable].map(([table, tableConflicts]) => (
              <Card key={table}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {archiveTableLabel(table)}（{tableConflicts.length}件）
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tableConflicts.map((conflict) => {
                    const rowKey = conflictRowKey(conflict)
                    const rowChoice =
                      conflictIdOverrides[rowKey] ?? conflictIdChoice
                    return (
                      <div
                        key={rowKey}
                        className="flex items-start justify-between gap-4 rounded-lg border p-3"
                      >
                        <div className="min-w-0 space-y-1 text-sm">
                          <dl className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 text-xs">
                            <dt />
                            <dd className="text-muted-foreground">
                              アーカイブ
                            </dd>
                            <dd className="text-muted-foreground">
                              このパソコン
                            </dd>
                            {conflict.columns.map((column) => (
                              <div key={column} className="contents">
                                <dt className="text-muted-foreground">
                                  {archiveColumnLabel(column)}
                                </dt>
                                <dd className="truncate">
                                  {uniqueKeyValueText(
                                    conflict.archiveRow,
                                    column
                                  )}
                                </dd>
                                <dd className="truncate">
                                  {uniqueKeyValueText(
                                    conflict.existingRow,
                                    column
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {conflict.migrated && (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              このアーカイブは古い版で作られたため、
                              {archiveTableLabel(table)}
                              は版をまたいで同じものかを id で判断できません。
                            </p>
                          )}
                        </div>
                        {isSeparate ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            既存の行に合わせます
                          </span>
                        ) : (
                          <Select
                            value={rowChoice}
                            onValueChange={(value) => {
                              if (isArchiveIdChoice(value)) {
                                setConflictIdOverride(rowKey, value)
                              }
                            }}
                          >
                            <SelectTrigger
                              className="w-48 shrink-0"
                              aria-label={`${archiveTableLabel(table)}の採用する id`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="existing">
                                {ID_CHOICE_LABELS.existing}
                              </SelectItem>
                              <SelectItem value="archive">
                                {ID_CHOICE_LABELS.archive}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <StepNextButton
        onClick={() => void goNext()}
        isProcessing={isProcessing}
      />
    </div>
  )
}
