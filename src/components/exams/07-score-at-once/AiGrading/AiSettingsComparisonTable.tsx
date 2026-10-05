"use client"

import { BarChart3 } from "lucide-react"
import { useMemo } from "react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import type { QuestionScoreRow } from "@/queries/scoring"

import type { AiGradingRunRow } from "./types"
import { aggregateSettingsAgreement } from "./utils/settingsComparison"

interface AiSettingsComparisonTableProps {
  runs: AiGradingRunRow[]
  questionScores: QuestionScoreRow[]
  cropRegionId: string
  currentUserId: string
  points: number | null
}

function formatRate(count: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((count / total) * 100)}%`
}

/**
 * 設定ごとの一致率（設計 §3-3）。自分の実行を（モデル・effort・拡大率）でまとめ、
 * 自分の採点との一致率とトークン数を並べる。採用した判定は数えない
 */
export function AiSettingsComparisonTable({
  runs,
  questionScores,
  cropRegionId,
  currentUserId,
  points,
}: AiSettingsComparisonTableProps) {
  const settingsAgreements = useMemo(
    () =>
      aggregateSettingsAgreement({
        runs,
        questionScores,
        cropRegionId,
        currentUserId,
        points,
      }),
    [runs, questionScores, cropRegionId, currentUserId, points]
  )
  if (settingsAgreements.length === 0) return null

  return (
    <SidePanelSection icon={BarChart3} title="設定ごとの一致率">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="text-left font-normal">設定</th>
            <th className="text-right font-normal">比較</th>
            <th className="text-right font-normal">一致</th>
            <th className="text-right font-normal">±1点</th>
            <th className="text-right font-normal">トークン</th>
          </tr>
        </thead>
        <tbody>
          {settingsAgreements.map((settingsAgreement) => (
            <tr key={settingsAgreement.settingsKey} className="border-t">
              <td className="py-1 font-mono">
                {settingsAgreement.model}
                <br />
                {settingsAgreement.effort} / ×{settingsAgreement.imageScale}
              </td>
              <td className="text-right">{settingsAgreement.comparedCount}</td>
              <td className="text-right">
                {formatRate(
                  settingsAgreement.exactMatchCount,
                  settingsAgreement.comparedCount
                )}
              </td>
              <td className="text-right">
                {formatRate(
                  settingsAgreement.withinOnePointCount,
                  settingsAgreement.comparedCount
                )}
              </td>
              <td className="text-right tabular-nums">
                {(
                  settingsAgreement.inputTokens + settingsAgreement.outputTokens
                ).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">
        比較は自分が採点済みの答案だけ。採用した判定は数えません
      </p>
    </SidePanelSection>
  )
}
