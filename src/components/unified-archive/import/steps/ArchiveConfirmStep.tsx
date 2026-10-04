"use client"

import { AlertTriangle, ClipboardCheck, Download } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { archiveTableLabel } from "../../archiveTableLabels"
import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"
import type { ArchiveImportResult } from "../types"
import { StepNextButton } from "./StepNextButton"
import { UnresolvableReasonList } from "./UnresolvableReasonList"

const COUNT_COLUMNS = [
  { key: "created", label: "新規" },
  { key: "replaced", label: "置き換え" },
  { key: "kept", label: "そのまま" },
  { key: "skipped", label: "取り込まない" },
] as const

type TableCounts = ArchiveImportResult["counts"][string]

function sumCounts(counts: ArchiveImportResult["counts"]): TableCounts {
  return Object.values(counts).reduce<TableCounts>(
    (acc, tableCounts) => ({
      created: acc.created + tableCounts.created,
      replaced: acc.replaced + tableCounts.replaced,
      kept: acc.kept + tableCounts.kept,
      skipped: acc.skipped + tableCounts.skipped,
    }),
    { created: 0, replaced: 0, kept: 0, skipped: 0 }
  )
}

/**
 * 5. 確認。試し取り込み（書いてからロールバック）の数字を、表ごとに見せる。
 * 解けない衝突があれば理由を出し、取り込ませない
 */
export function ArchiveConfirmStep({
  wizard,
}: {
  wizard: UnifiedArchiveImportWizardState
}) {
  const { lastAnalysis, isAnalysisCurrent, goNext, isProcessing } = wizard
  if (!lastAnalysis) return null

  const result = lastAnalysis.kind === "ok" ? lastAnalysis.result : null
  const countEntries = result ? Object.entries(result.counts) : []
  const totals = result ? sumCounts(result.counts) : null

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <ClipboardCheck className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">取り込む内容の確認</h3>
        <p className="text-muted-foreground">
          実際に書いてから取り消して数えた件数です。
        </p>
      </div>

      {lastAnalysis.kind === "unresolvable" && (
        <UnresolvableReasonList reasons={lastAnalysis.reasons} />
      )}

      {result && totals && (
        <div className="space-y-4">
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>表</TableHead>
                  {COUNT_COLUMNS.map((countColumn) => (
                    <TableHead key={countColumn.key} className="text-right">
                      {countColumn.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {countEntries.map(([table, tableCounts]) => (
                  <TableRow key={table}>
                    <TableCell>{archiveTableLabel(table)}</TableCell>
                    {COUNT_COLUMNS.map((countColumn) => (
                      <TableCell
                        key={countColumn.key}
                        className="text-right tabular-nums"
                      >
                        {tableCounts[countColumn.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>合計</TableCell>
                  {COUNT_COLUMNS.map((countColumn) => (
                    <TableCell
                      key={countColumn.key}
                      className="text-right tabular-nums"
                    >
                      {totals[countColumn.key]}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground">
            同じ値の行の衝突: {result.uniqueConflicts.length}件
            {result.renamedIds.length > 0 &&
              ` / id を付け替える行: ${result.renamedIds.length}件`}
          </p>

          {result.warnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                    注意事項
                  </h4>
                  <ul className="space-y-1">
                    {result.warnings.map((warning) => (
                      <li
                        key={warning}
                        className="text-sm text-amber-700 dark:text-amber-300"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <StepNextButton
        onClick={() => void goNext()}
        isProcessing={isProcessing}
        disabled={lastAnalysis.kind !== "ok" || !isAnalysisCurrent}
        processingLabel="取り込んでいます..."
      >
        <Download className="h-5 w-5" />
        取り込む
      </StepNextButton>
    </div>
  )
}
