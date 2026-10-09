"use client"

import type { ReactNode } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import { RubricRecalculationDialog } from "../Rubric/RubricRecalculationDialog"
import { AiProposalList } from "./AiProposalList"
import { AiProposalQuestion } from "./AiProposalQuestion"
import { AiQuestioningStatusNotice } from "./AiQuestioningStatusNotice"
import { AiQuestioningSummary } from "./AiQuestioningSummary"
import { AiScoringMethodQuestion } from "./AiScoringMethodQuestion"
import { useAiQuestioningPanel } from "./hooks/useAiQuestioningPanel"
import type { AiQuestioningState } from "./hooks/useAiQuestioningState"
import {
  describeMemberNames,
  hasPendingInstructions,
} from "./utils/questioningFlow"

interface AiQuestioningPanelProps {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  questionScores: readonly QuestionScoreRow[]
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  pageSize: string
  questioning: AiQuestioningState
  onScored: (examStudentIds: string[]) => void
  onAnnotationsChanged?: () => void
  /** 次の往復（実行ダイアログを開く） */
  onStartNextRound: () => void
  /** 直接採点のまま判定を採用する（採点反映のタブへ） */
  onShowAdoption: () => void
  /** 選んだ答案の AI の判定（所見を見ながら選ぶ） */
  selectedJudgement: ReactNode
}

/**
 * 左パネルの「問いかけ」のタブ（docs/vlm-grading-design.md §3-5・§11）。
 *
 * 2段目の項目の案を1つずつ、選択肢として問いかける。答えると項目ができて案の答案に当たり、
 * 項目から点を計算して書く。答えた案は一覧に畳んで残り、開き直して選び直せる。
 * AI の判定をそのまま点にする「採用」は、直接採点の設問のための別の流れ（採点反映のタブ）
 */
export function AiQuestioningPanel({
  examId,
  cropRegion,
  currentUserId,
  questionScores,
  studentAnswerImages,
  pageSize,
  questioning,
  onScored,
  onAnnotationsChanged,
  onStartNextRound,
  onShowAdoption,
  selectedJudgement,
}: AiQuestioningPanelProps) {
  const panel = useAiQuestioningPanel({
    examId,
    cropRegion,
    currentUserId,
    questionScores,
    studentAnswerImages,
    pageSize,
    questioning,
    onScored,
    onAnnotationsChanged,
  })
  const { choiceScene } = panel
  const {
    status,
    proposalRun,
    orderedProposals,
    currentProposal,
    outsideAttempts,
    outsideExamStudentIds,
    nameOf,
  } = questioning
  const position = currentProposal
    ? orderedProposals.indexOf(currentProposal) + 1
    : 0

  return (
    <div className="space-y-3 py-3" aria-label="AI の問いかけ">
      <p className="text-[11px] text-gray-500">
        答えると項目ができ、案の答案に当てて項目から点を計算します。AI
        の判定をそのまま点にするときは「採点反映」のタブで採用します。
      </p>
      <p
        className={`text-[11px] ${choiceScene.isOpen ? "text-amber-700" : "text-gray-500"}`}
      >
        {choiceScene.isOpen
          ? "数字で選ぶ／Enter で答えて次へ／0 でその他／↑↓ で移る／Esc で戻る"
          : "Space で選択の場面に入り、数字で選択肢を選びます。採点キーで答案を直接直すこともできます"}
      </p>

      <AiQuestioningStatusNotice
        examId={examId}
        cropRegionId={cropRegion.id}
        status={status}
      />

      {panel.asksScoringMethod ? (
        <AiScoringMethodQuestion
          recommendedMethod={panel.recommendedMethod}
          focusedIndex={choiceScene.focusedIndex}
          numberOf={choiceScene.numberOf}
          isChoiceSceneOpen={choiceScene.isOpen}
          onFocus={choiceScene.setFocusedIndex}
          onDecide={(method) => void panel.changeScoringMethod(method)}
          onKeepDirectScoring={onShowAdoption}
        />
      ) : currentProposal ? (
        <AiProposalQuestion
          key={currentProposal.id}
          proposal={currentProposal}
          position={position}
          proposalCount={orderedProposals.length}
          rubricItems={panel.rubricItems}
          nameOf={nameOf}
          focusedIndex={choiceScene.focusedIndex}
          numberOf={choiceScene.numberOf}
          isChoiceSceneOpen={choiceScene.isOpen}
          onFocusOption={choiceScene.setFocusedIndex}
          onAnswerOption={(optionIndex) =>
            panel.answerOption(currentProposal, optionIndex)
          }
          createsRubricItem={panel.createsRubricItem}
          adviceText={panel.adviceText}
          onAdviceTextChange={panel.setAdviceText}
          otherText={panel.otherText}
          onOtherTextChange={panel.setOtherText}
          otherTextRef={panel.otherTextRef}
          onAnswerOther={() => panel.answerOther(currentProposal)}
        />
      ) : (
        <AiQuestioningSummary
          hasProposalRun={proposalRun !== null}
          proposalCount={orderedProposals.length}
          unansweredCount={questioning.unansweredCount}
          hasInstructions={hasPendingInstructions(orderedProposals)}
          onStartNextRound={onStartNextRound}
        />
      )}

      {(currentProposal || outsideAttempts.length > 0) && (
        <label className="flex items-center gap-2 text-[11px] text-gray-700">
          <Switch
            checked={questioning.isGridNarrowed}
            onCheckedChange={questioning.setIsGridNarrowed}
            aria-label="一覧を絞る"
          />
          {questioning.gridTarget === "outside"
            ? "一覧を、どの案にも入らない答案に絞る"
            : "一覧を、この案の答案に絞る"}
          （確信度の低い順）
        </label>
      )}

      <AiProposalList
        orderedProposals={orderedProposals}
        currentProposalId={currentProposal?.id ?? null}
        onOpen={questioning.openProposal}
      />

      {outsideAttempts.length > 0 && (
        <section
          aria-label="どの案にも入らない答案"
          className="rounded border border-gray-200 p-2 text-[11px]"
        >
          <p className="font-medium text-gray-800">
            判断できない答案 {outsideExamStudentIds.length}件
          </p>
          <p className="text-gray-600">
            どの案にも入らず、既存の項目にも当たりませんでした。採点キーか項目で手で採点します：
            {describeMemberNames(outsideExamStudentIds.map(nameOf), 3)}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-6 w-full text-[11px]"
            onClick={() => {
              questioning.setGridTarget("outside")
              questioning.setIsGridNarrowed(true)
            }}
          >
            一覧に出す
          </Button>
        </section>
      )}

      {proposalRun?.notes && (
        <section aria-label="気づいた点" className="text-[11px]">
          <p className="font-medium text-gray-800">AI が気づいた点</p>
          <p className="whitespace-pre-wrap text-gray-600">
            {proposalRun.notes}
          </p>
        </section>
      )}

      {selectedJudgement}

      <RubricRecalculationDialog
        pending={panel.recalculation.pending}
        onCancel={panel.recalculation.cancel}
      />
    </div>
  )
}
