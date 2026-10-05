"use client"

import { PenLine } from "lucide-react"

import { KeyboardScoringButtons } from "@/components/exams/07-score-at-once/ScoringSidePanel/KeyboardScoringButtons"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface AiOwnScoringSectionProps {
  selectedCount: number
  onScore: (status: ScoringStatus) => void
}

/**
 * 「自分で採点」の節（左パネルの採点反映のタブに置く）。AI の判定を採用せず、
 * 選んだ答案に自分の採点を直接書く。ボタンとキーは一覧表示と同じ
 */
export function AiOwnScoringSection({
  selectedCount,
  onScore,
}: AiOwnScoringSectionProps) {
  return (
    <SidePanelSection icon={PenLine} title="自分で採点">
      <KeyboardScoringButtons
        selectedAnswersCount={selectedCount}
        onScore={onScore}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        一覧表示と同じキーで、選んだ答案に自分の採点を書きます（部分点は今の点を引き継ぎます）
      </p>
    </SidePanelSection>
  )
}
