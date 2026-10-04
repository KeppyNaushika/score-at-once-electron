"use client"

import type { ComponentProps } from "react"

import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import { AiGradingWorkspace } from "./AiGradingWorkspace"

/** 採点画面の設問ナビゲーターに渡すものと同じ */
type QuestionNavigatorProps = ComponentProps<typeof QuestionNavigator>

interface AiGradingModeProps {
  examId: string
  currentUserId: string
  /** 選べる設問（採点担当で絞ったもの） */
  cropRegions: QuestionAnswerRegionRow[]
  currentCropRegion: QuestionAnswerRegionRow | undefined
  onCropRegionChange: QuestionNavigatorProps["onCropRegionChange"]
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress: QuestionNavigatorProps["questionProgress"]
  isQuestionSetFiltered: boolean
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
  /** 試験の用紙サイズ（注釈の大きさを mm から換算する基準） */
  pageSize: string
  /** 同意して API キーを保存した事業者 */
  unlockedProviders: GradingProviderId[]
}

/** 採点行がまだ届いていない設問の空の配列（毎回作り直さない） */
const NO_QUESTION_SCORES: QuestionScoreRow[] = []

/**
 * 07 の「AI採点」モード（実験的機能。docs/vlm-grading-design.md §10）。
 *
 * 左に設問（採点画面と同じナビゲーター）、右に設問ごとの作業場。設問を変えたら
 * 作業場を作り直す（選んでいるプロンプト・答案・試行は設問ごとのもの）。
 */
export function AiGradingMode({
  examId,
  currentUserId,
  cropRegions,
  currentCropRegion,
  onCropRegionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
  isQuestionSetFiltered,
  studentAnswerImages,
  questionScoresByCropRegionId,
  pageSize,
  unlockedProviders,
}: AiGradingModeProps) {
  return (
    <div className="flex h-full min-h-0">
      {currentCropRegion ? (
        <AiGradingWorkspace
          key={currentCropRegion.id}
          examId={examId}
          currentUserId={currentUserId}
          cropRegion={currentCropRegion}
          studentAnswerImages={studentAnswerImages}
          questionScores={
            questionScoresByCropRegionId.get(currentCropRegion.id) ??
            NO_QUESTION_SCORES
          }
          pageSize={pageSize}
          unlockedProviders={unlockedProviders}
          questionNavigator={
            <QuestionNavigator
              questionRegions={cropRegions}
              currentCropRegion={currentCropRegion}
              onCropRegionChange={onCropRegionChange}
              onPrevQuestion={onPrevQuestion}
              onNextQuestion={onNextQuestion}
              questionProgress={questionProgress}
              isFilteredByAssignment={isQuestionSetFiltered}
            />
          }
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          設問を選んでください
        </div>
      )}
    </div>
  )
}
