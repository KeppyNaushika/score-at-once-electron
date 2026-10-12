"use client"

import { RotateCcw } from "lucide-react"
import type { ReactNode } from "react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { RubricRecalculationDialog } from "../Rubric/RubricRecalculationDialog"
import { AiManualScoringButtons } from "./AiManualScoringButtons"
import { AiQuestioningCard } from "./AiQuestioningCard"
import { AiQuestioningLog } from "./AiQuestioningLog"
import { AiQuestioningReview } from "./AiQuestioningReview"
import type { AiQuestioning } from "./hooks/useAiQuestioning"
import { planQuestioningCommit } from "./utils/questioningCommitPlan"
import type { QuestioningMode } from "./utils/questioningReview"

interface AiQuestioningPanelProps {
  mode: QuestioningMode
  questioning: AiQuestioning
  cropRegion: QuestionAnswerRegionRow
  /** 実行の状態（走っている・失敗した）。無ければ null */
  statusNotice: ReactNode
  /** 問いが無いときの案内 */
  emptyMessage: string
  /** 2段目が返した気づいた点（AI採点だけ） */
  notes: string
  /** 指示を添えて再採点する（AI採点だけ。答案を選んで実行ダイアログを開く） */
  onRegrade?: (examStudentIds: string[]) => void
}

/**
 * 左パネルの「AI採点」「AIチェック」のタブ（docs/vlm-grading-design.md §3-5・§3-10）。
 * 問いかけ（決めたことの記録 → いまの問いと選択肢・自分で採点するボタン → 全部答えたら見直しと確定）。
 * 実行の入口は「採点指示」のタブにある。問いに入る答案は中央の一覧で見る（絞り込みのスイッチ・付く予定の点の斜線）。
 * **確定するまで教員の採点は何も変わらない**（決めたことは AI の層の下書き）
 */
export function AiQuestioningPanel({
  mode,
  questioning,
  cropRegion,
  statusNotice,
  emptyMessage,
  notes,
  onRegrade,
}: AiQuestioningPanelProps) {
  const { keyBindings } = useKeyBindings()
  const { states, flow, summary, partialScore } = questioning
  const { currentState } = flow

  const content = (() => {
    if (states.length === 0) {
      return <p className="text-muted-foreground">{emptyMessage}</p>
    }
    if (currentState) {
      return (
        <AiQuestioningCard
          state={currentState}
          position={states.indexOf(currentState) + 1}
          total={states.length}
          flow={flow}
          scaleLevels={questioning.scaleQuestion.scaleLevels}
        />
      )
    }
    if (summary.draftCount === 0 && summary.unansweredCount === 0) {
      const instructionMembers = questioning.committedInstructionMembers
      return (
        <section
          aria-label="反映済み"
          className="space-y-1 rounded border border-gray-200 p-2"
        >
          <p className="text-xs font-medium text-gray-800">
            {questioning.hasJustCommitted
              ? "採点に反映しました"
              : "すべて採点に反映しています"}
          </p>
          <p className="text-muted-foreground">
            上の記録を押すと選び直せます。
          </p>
          {onRegrade && instructionMembers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => onRegrade(instructionMembers)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              指示を添えて再採点する（{instructionMembers.length}件）
            </Button>
          )}
        </section>
      )
    }
    return (
      <AiQuestioningReview
        summary={summary}
        blockedReason={
          questioning.isMethodUnanswered
            ? "最初の問い（採点方式）に答えると採点に反映できます。"
            : null
        }
        isCommitting={questioning.isCommitting}
        onBack={flow.goToPrevious}
        onCommit={() => {
          flow.discardUnusedOtherTexts()
          questioning.commit(
            planQuestioningCommit(states, mode, questioning.ownScoreOf)
          )
        }}
      />
    )
  })()

  return (
    <div className="space-y-3 py-3 text-[11px]">
      {statusNotice}

      <AiQuestioningLog
        states={states}
        currentStepId={currentState?.step.id ?? null}
        onOpen={flow.openStep}
        adviceTextOf={flow.adviceTextOf}
        scaleLevels={questioning.scaleQuestion.scaleLevels}
      />
      {content}
      {currentState && (
        <AiManualScoringButtons
          isEnabled={questioning.isManualActive}
          onScore={questioning.scoreCursor}
          onOpenPartialScore={() => partialScore.openPartialScoreModal()}
          scaleQuestion={questioning.scaleQuestion}
          onScoreWithScaleLevel={questioning.scoreCursorWithScaleLevel}
        />
      )}

      {currentState && currentState.step.members.length > 0 && (
        <label className="flex items-center gap-2 text-gray-700">
          <Switch
            checked={questioning.isGridNarrowed}
            onCheckedChange={questioning.setIsGridNarrowed}
            aria-label="一覧を絞る"
          />
          この問いの答案に絞る
        </label>
      )}
      {states.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          斜線は反映すると付く点です。「採点に反映する」まで採点は変わりません。
        </p>
      )}

      {notes && (
        <section aria-label="気づいた点">
          <p className="font-medium text-gray-800">AI が気づいた点</p>
          <p className="whitespace-pre-wrap text-gray-600">{notes}</p>
        </section>
      )}

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
      <RubricRecalculationDialog
        pending={questioning.recalculation.pending}
        onCancel={questioning.recalculation.cancel}
      />
    </div>
  )
}
