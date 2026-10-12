"use client"

import { ClipboardCheck } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

import type { CategorySummary } from "./types"

interface ScoringSummaryCardProps {
  scoringSummary: Omit<CategorySummary, "idChangeToImport">
  totalScores: number
}

/**
 * 採点データ用のサマリーカード
 */
export function ScoringSummaryCard({
  scoringSummary,
  totalScores,
}: ScoringSummaryCardProps) {
  const total =
    scoringSummary.unchanged +
    scoringSummary.updated +
    scoringSummary.newCount +
    scoringSummary.skipped
  if (total === 0 && totalScores === 0) return null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-medium">採点データ</h4>
        </div>
        <ul className="space-y-1 text-sm">
          {scoringSummary.unchanged > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">●</span>
              既存と一致（変更なし）: {scoringSummary.unchanged}件
            </li>
          )}
          {scoringSummary.updated > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-purple-500">●</span>
              取り込む採点で上書き: {scoringSummary.updated}件
            </li>
          )}
          {scoringSummary.newCount > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-blue-500">●</span>
              新規追加: {scoringSummary.newCount}件
            </li>
          )}
          {scoringSummary.skipped > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-gray-400">●</span>
              既存の採点を維持: {scoringSummary.skipped}件
            </li>
          )}
          {scoringSummary.unchanged === 0 &&
            scoringSummary.updated === 0 &&
            scoringSummary.newCount === 0 &&
            scoringSummary.skipped === 0 && (
              <li className="text-muted-foreground">データなし</li>
            )}
        </ul>
      </CardContent>
    </Card>
  )
}
