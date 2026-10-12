"use client"

import { TriangleAlert } from "lucide-react"

interface ImportWarningListProps {
  /** 照合で出た警告（版の確認・変換で失われるデータなど）。空なら何も出さない */
  warnings: string[]
  /** 警告の一覧の見出し */
  heading: string
}

interface KeyedWarning {
  warning: string
  key: string
}

/**
 * 同じ文の警告が重なっても key が重ならないよう、文とその文の何度目かで key を作る
 */
function keyWarnings(warnings: string[]): KeyedWarning[] {
  const occurrenceCounts = new Map<string, number>()
  return warnings.map((warning) => {
    const occurrence = occurrenceCounts.get(warning) ?? 0
    occurrenceCounts.set(warning, occurrence + 1)
    return { warning, key: `${warning}#${occurrence}` }
  })
}

/**
 * 旧形式（.coursework / .grade）の取り込みで、照合の結果の警告を取り込む前に見せる一覧
 */
export function ImportWarningList({
  warnings,
  heading,
}: ImportWarningListProps) {
  if (warnings.length === 0) return null
  return (
    <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
        <TriangleAlert className="h-4 w-4" />
        {heading}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
        {keyWarnings(warnings).map((keyedWarning) => (
          <li key={keyedWarning.key}>{keyedWarning.warning}</li>
        ))}
      </ul>
    </div>
  )
}
