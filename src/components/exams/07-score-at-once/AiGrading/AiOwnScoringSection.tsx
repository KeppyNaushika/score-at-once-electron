"use client"

import { Calculator, PenLine } from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { KeyboardScoringButtons } from "@/components/exams/07-score-at-once/ScoringSidePanel/KeyboardScoringButtons"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { useAiOwnScoring } from "./hooks/useAiOwnScoring"

interface AiOwnScoringSectionProps {
  cropRegion: QuestionAnswerRegionRow
  selectedCount: number
  onScore: (status: ScoringStatus) => void
  /** 部分点の入力欄（一覧表示と同じもの） */
  partialScore: ReturnType<typeof useAiOwnScoring>["partialScore"]
}

/**
 * 「自分で採点」の節（左パネルの採点反映のタブに置く）。AI の判定を採用せず、
 * 選んだ答案に自分の採点を直接書く。ボタンとキー、部分点の入力欄は一覧表示と同じ
 */
export function AiOwnScoringSection({
  cropRegion,
  selectedCount,
  onScore,
  partialScore,
}: AiOwnScoringSectionProps) {
  const { keyBindings } = useKeyBindings()
  const partialOpenKeys = `${keyBindings["scoring.openPartialWith0"]}〜${keyBindings["scoring.openPartialWith9"]}`
  return (
    <SidePanelSection icon={PenLine} title="自分で採点">
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={partialScore.openPartialScoreModal}
          disabled={selectedCount === 0}
        >
          <Calculator className="h-3.5 w-3.5" />
          部分点入力
          <Kbd variant="tiny">{partialOpenKeys}</Kbd>
        </Button>
        <KeyboardScoringButtons
          selectedAnswersCount={selectedCount}
          onScore={onScore}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        一覧表示と同じキーで、選んだ答案に自分の採点を書きます（部分点・保留のボタンは今の部分点を引き継ぎ、点は「部分点入力」で入れます）
      </p>
      <ScoringModals
        showPartialScoreModal={partialScore.showPartialScoreModal}
        partialScoreInput={partialScore.partialScoreInput}
        currentCropRegion={cropRegion}
        onPartialScoreClose={partialScore.handlePartialScoreCancel}
        onPartialScoreChange={partialScore.handlePartialScoreChange}
        onPartialScoreConfirmPartial={() =>
          partialScore.handlePartialScoreConfirm("partial")
        }
        onPartialScoreConfirmPending={() =>
          partialScore.handlePartialScoreConfirm("pending")
        }
        onPartialScoreDigit={partialScore.handlePartialScoreInput}
        onPartialScoreBackspace={partialScore.handlePartialScoreBackspace}
        keyBindings={{
          partialKey: keyBindings["scoring.partial"],
          pendingKey: keyBindings["scoring.pending"],
          cancelKey: keyBindings["modal.cancel"],
        }}
      />
    </SidePanelSection>
  )
}
