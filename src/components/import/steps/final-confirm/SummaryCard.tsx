"use client"

import { Card, CardContent } from "@/components/ui/card"

import type { CategorySummary } from "./types"

interface SummaryCardProps {
  icon: React.ReactNode
  title: string
  unit: string
  summary: CategorySummary
}

/**
 * 生徒/学級/小計グループ用のサマリーカード
 */
export function SummaryCard({ icon, title, unit, summary }: SummaryCardProps) {
  const hasAny =
    summary.unchanged > 0 ||
    summary.updated > 0 ||
    summary.newCount > 0 ||
    summary.skipped > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h4 className="font-medium">{title}</h4>
        </div>
        <ul className="space-y-1 text-sm">
          {!hasAny && <li className="text-muted-foreground">データなし</li>}
          {summary.unchanged > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">●</span>
              既存と一致（変更なし）: {summary.unchanged}
              {unit}
            </li>
          )}
          {summary.updated > 0 && (
            <>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="text-purple-500">●</span>
                取り込むデータで更新: {summary.updated}
                {unit}
              </li>
              {summary.idChangeToImport > 0 && (
                <li className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-amber-500">└</span>
                  うち{summary.idChangeToImport}
                  {unit}のIDを変更
                </li>
              )}
            </>
          )}
          {summary.unchanged > 0 &&
            summary.updated === 0 &&
            summary.idChangeToImport > 0 && (
              <li className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-amber-500">└</span>
                うち{summary.idChangeToImport}
                {unit}のIDを変更
              </li>
            )}
          {summary.newCount > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-blue-500">●</span>
              新規追加: {summary.newCount}
              {unit}
            </li>
          )}
          {summary.skipped > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-gray-400">●</span>
              取り込まない: {summary.skipped}
              {unit}
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
