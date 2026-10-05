"use client"

import { ChevronDown, FileText, Info, RefreshCw } from "lucide-react"
import { useState } from "react"

import { ImportActionChoice } from "@/components/import/ImportActionChoice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ArchiveOptionalItem } from "@/types/unifiedArchive.types"

import { archiveTableLabel } from "../../archiveTableLabels"
import { formatArchiveDateTime } from "../archiveImportLabels"
import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"
import type { OpenedUnifiedArchive } from "../types"
import { StepNextButton } from "./StepNextButton"

/** 内容確認で先に見せる表（根と共通の実体、量の多い子） */
const MAIN_TABLES = [
  "Exam",
  "Coursework",
  "Grade",
  "AsbDefinition",
  "Student",
  "Classroom",
  "SubtotalGroup",
  "Tag",
  "User",
  "ExamStudent",
  "QuestionScore",
  "StudentAnswerImage",
  "CourseworkScore",
]

const OPTIONAL_ITEM_LABELS: Record<ArchiveOptionalItem, string> = {
  userSettings: "利用者個人の設定",
  appPreference: "組織の設定",
  auditLog: "操作履歴",
  aiGradingRecords: "AI採点の記録",
}

/** 「このアーカイブには〇〇が含まれていません」の項目を manifest から作る */
function notIncludedItems(manifest: OpenedUnifiedArchive["manifest"]) {
  const { selection, exclusions } = manifest
  const items: string[] = []
  for (const [table, ids] of Object.entries(exclusions.requested)) {
    if (ids.length > 0) {
      items.push(
        `${archiveTableLabel(table)} ${ids.length}件（書き出すときに外したもの）`
      )
    }
  }
  for (const [table, rowCount] of Object.entries(
    exclusions.excludedRowCounts
  )) {
    if (rowCount > 0) items.push(`${archiveTableLabel(table)} ${rowCount}行`)
  }
  if (selection.scoring.kind === "self") {
    items.push("他の教員の採点・確定・返却版（本人分だけを書き出しています）")
  }
  if (!selection.includeAnswers) {
    items.push(
      "受験生徒・採点・答案画像・確定・返却版（採点と答案を含めずに書き出しています）"
    )
  }
  for (const [optionalItem, label] of Object.entries(OPTIONAL_ITEM_LABELS)) {
    if (
      !selection.optionalItems.some((selected) => selected === optionalItem)
    ) {
      items.push(label)
    }
  }
  return items
}

/** 2. 何が入っているかを見せ、取り込みの方針を1回選ぶ */
export function ArchiveOverviewStep({
  wizard,
}: {
  wizard: UnifiedArchiveImportWizardState
}) {
  const { opened, action, setAction, goNext, isProcessing } = wizard
  const [showAllTables, setShowAllTables] = useState(false)
  if (!opened) return null

  const { manifest, appliedMigrations, migratedRowCounts } = opened
  const rootSummary = Object.entries(manifest.selection.roots)
    .filter(([, ids]) => ids.length > 0)
    .map(([table, ids]) => `${archiveTableLabel(table)} ${ids.length}件`)
  const mainRowCounts = MAIN_TABLES.flatMap((table) => {
    const rowCount = manifest.rowCounts[table]
    return rowCount ? [{ table, rowCount }] : []
  })
  const allRowCounts = Object.entries(manifest.rowCounts)
  const missingItems = notIncludedItems(manifest)
  const migratedEntries = Object.entries(migratedRowCounts)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">ファイルの内容</h3>
        <p className="text-muted-foreground">
          {rootSummary.length > 0 ? rootSummary.join("・") : "根の選択なし"}
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-3 p-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">書き出した日時</dt>
            <dd>{formatArchiveDateTime(manifest.exportedAt)}</dd>
            <dt className="text-muted-foreground">アプリの版</dt>
            <dd>{manifest.appVersion}</dd>
          </dl>
          <ul className="flex flex-wrap gap-2">
            {mainRowCounts.map(({ table, rowCount }) => (
              <li key={table} className="rounded bg-muted px-2 py-1 text-xs">
                {archiveTableLabel(table)} {rowCount}
              </li>
            ))}
          </ul>
          <Collapsible open={showAllTables} onOpenChange={setShowAllTables}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
                <span className="text-xs">
                  すべての表（{allRowCounts.length}）
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAllTables ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                {allRowCounts.map(([table, rowCount]) => (
                  <li key={table} className="flex justify-between gap-2">
                    <span className="truncate">{archiveTableLabel(table)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {rowCount}
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {appliedMigrations.length > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p>古い版で書き出されたため、取り込める形に変換しました。</p>
              {migratedEntries.length > 0 && (
                <p className="mt-1 text-xs">
                  変換で生まれた行:{" "}
                  {migratedEntries
                    .map(
                      ([table, rowCount]) =>
                        `${archiveTableLabel(table)} ${rowCount}行`
                    )
                    .join("、")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {missingItems.length > 0 && (
        <Card className="mb-6 bg-muted/30">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                このアーカイブには次のものが含まれていません
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {missingItems.map((missingItem) => (
                  <li key={missingItem}>{missingItem}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                取り込みはこのパソコンの行を消さないので、含まれていないものはそのまま残ります。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ImportActionChoice
        action={action}
        onChange={setAction}
        confirmCoversAllTables
      />

      <StepNextButton
        onClick={() => void goNext()}
        isProcessing={isProcessing}
      />
    </div>
  )
}
