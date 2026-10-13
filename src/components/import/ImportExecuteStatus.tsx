"use client"

import { CircleCheck, CircleX, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

/**
 * 取り込みの実行段で、実行中・完了・失敗を伝える部品。
 *
 * 試験（.score）・生徒（.students）の取り込みと統合アーカイブ（.sao）の取り込みで同じ見た目にする。
 * 件数の表（`ImportCountsCard`）と警告（`ImportWarningsCard`）は、作成・上書き・変更なし・
 * スキップで数える試験と生徒の取り込みが使う（.sao は表ごとに数えるので自前で出す）。
 */

/** 実行中 */
export function ImportExecutingView() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Spinner className="size-10 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-semibold">取り込み中...</h3>
      <p className="mb-8 text-muted-foreground">
        データを取り込んでいます。しばらくお待ちください。
      </p>
      <div className="w-full max-w-sm">
        <Progress value={undefined} className="h-2" />
      </div>
    </div>
  )
}

/** 完了の見出し。`description` は見出しの下に添える1文（無ければ出さない） */
export function ImportSucceededHeading({
  description,
}: {
  description?: string
}) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
        <CircleCheck className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <h3 className="mb-2 text-xl font-semibold">取り込みが完了しました</h3>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  )
}

/** 失敗。`error` が無ければ「詳細は不明です」と出す */
export function ImportFailedView({
  error,
  onClose,
}: {
  error: string | null
  onClose: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <CircleX className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">取り込みに失敗しました</h3>
        <p className="max-w-md text-destructive">{error ?? "詳細は不明です"}</p>
      </div>
      <Button onClick={onClose} variant="outline" size="lg">
        閉じる
      </Button>
    </div>
  )
}

/** 件数の表の1行（1種類のデータの、作成・上書き・変更なし・スキップの件数） */
export interface ImportCountsRow {
  label: string
  created: number
  updated: number
  unchanged: number
  skipped: number
}

const IMPORT_COUNT_COLUMNS = [
  { key: "created", label: "新規追加" },
  { key: "updated", label: "上書き" },
  { key: "unchanged", label: "変更なし" },
  { key: "skipped", label: "スキップ" },
] as const

/** 取り込み結果の件数の表。1件も無い種類の行は出さない */
export function ImportCountsCard({ rows }: { rows: ImportCountsRow[] }) {
  const rowsWithCounts = rows.filter((row) =>
    IMPORT_COUNT_COLUMNS.some((column) => row[column.key] > 0)
  )
  return (
    <Card className="mb-6 w-full max-w-md border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
      <CardContent className="p-5">
        <h4 className="mb-4 text-sm font-medium text-green-800 dark:text-green-200">
          取り込み結果
        </h4>
        {rowsWithCounts.length === 0 ? (
          <p className="text-sm text-green-700 dark:text-green-300">
            取り込んだデータはありません
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-green-600/80 dark:text-green-400/80">
                <th className="pb-2 text-left font-normal">
                  <span className="sr-only">種類</span>
                </th>
                {IMPORT_COUNT_COLUMNS.map((column) => (
                  <th key={column.key} className="pb-2 text-right font-normal">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsWithCounts.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="py-1 text-left font-medium text-green-800 dark:text-green-200"
                  >
                    {row.label}
                  </th>
                  {IMPORT_COUNT_COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className="py-1 text-right text-green-700 tabular-nums dark:text-green-300"
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 警告の文に、同じ文の何回目かを添えた key を付ける。
 * 同じ文の警告が複数出ることがあるので、文だけでは key が重なる
 */
function keyWarningsByOccurrence(warnings: string[]) {
  const occurrenceCounts = new Map<string, number>()
  return warnings.map((warning) => {
    const occurrence = (occurrenceCounts.get(warning) ?? 0) + 1
    occurrenceCounts.set(warning, occurrence)
    return { warning, key: `${occurrence}:${warning}` }
  })
}

/** 取り込みの警告（注意事項）。無ければ出さない */
export function ImportWarningsCard({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <Card className="mb-6 w-full max-w-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
              注意事項
            </h4>
            <ul className="space-y-1">
              {keyWarningsByOccurrence(warnings).map((keyedWarning) => (
                <li
                  key={keyedWarning.key}
                  className="text-sm text-amber-700 dark:text-amber-300"
                >
                  {keyedWarning.warning}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
