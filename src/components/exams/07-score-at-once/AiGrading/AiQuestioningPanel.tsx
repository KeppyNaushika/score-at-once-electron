"use client"

import { RotateCcw, Send } from "lucide-react"
import type { ReactNode } from "react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { RubricRecalculationDialog } from "../Rubric/RubricRecalculationDialog"
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
  /** 実行ダイアログを開く（プロンプトが無ければ null で、押せない） */
  onRun: (() => void) | null
  /** 実行の状態（走っている・失敗した）。無ければ null */
  statusNotice: ReactNode
  /** 問いが無いときの案内 */
  emptyMessage: string
  /** 2段目が返した気づいた点（AI 採点だけ） */
  notes: string
  /** 指示を添えて再採点する（AI 採点だけ。答案を選んで実行ダイアログを開く） */
  onRegrade?: (examStudentIds: string[]) => void
}

/**
 * 左パネルの「AI 採点」「AI 採点チェック」のタブ（docs/vlm-grading-design.md §3-5・§3-10）。
 * 実行の入口と、問いかけ（決めたことの記録 → いまの問いと選択肢 → 全部答えたら見直しと確定）。
 * 問いに入る答案は中央の一覧で見る（絞り込みのスイッチ・付く予定の点の斜線）。
 * **確定するまで教員の採点は何も変わらない**（決めたことは AI の層の下書き）
 */
export function AiQuestioningPanel({
  mode,
  questioning,
  cropRegion,
  onRun,
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
        />
      )
    }
    if (summary.draftCount === 0 && summary.unansweredCount === 0) {
      const instructionMembers = questioning.committedInstructionMembers
      return (
        <section
          aria-label="確定済み"
          className="space-y-1 rounded border border-gray-200 p-2"
        >
          <p className="text-xs font-medium text-gray-800">
            {questioning.hasJustCommitted
              ? "確定しました"
              : "すべて確定しています"}
          </p>
          <p className="text-muted-foreground">
            決めたことは採点に入っています。上の一覧の行を押すと選び直せます（選び直しも確定で入ります）。
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
            ? "最初の問い（採点方式）に答えると確定できます。"
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
      <Button
        size="sm"
        className="w-full text-xs"
        onClick={onRun ?? undefined}
        disabled={onRun === null}
      >
        <Send className="h-3.5 w-3.5" />
        {mode === "grade" ? "AI 採点を実行…" : "AI 採点チェックを実行…"}
      </Button>
      {onRun === null && (
        <p className="text-muted-foreground">
          先に「プロンプト」のタブでプロンプトを作ってください。
        </p>
      )}
      {statusNotice}

      <AiQuestioningLog
        states={states}
        currentStepId={currentState?.step.id ?? null}
        onOpen={flow.openStep}
      />
      {content}

      {currentState && currentState.step.members.length > 0 && (
        <label className="flex items-center gap-2 text-gray-700">
          <Switch
            checked={questioning.isGridNarrowed}
            onCheckedChange={questioning.setIsGridNarrowed}
            aria-label="一覧を絞る"
          />
          一覧を、この問いの答案に絞る（確信度の低い順）
        </label>
      )}
      {states.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {mode === "grade"
            ? "一覧の斜線は、確定すると付く点です。最後に見直して「確定する」を押すまで、採点は何も変わりません。採点済みの答案を送っていても、ここで決めた点に置き換えます。"
            : "AI には先生の採点を見せずに判定させ、手元で比べています。一覧の斜線は、確定すると付く点です。最後に見直して「確定する」を押すまで、採点は何も変わりません。"}
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
