"use client"

import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useMemo, useState } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import {
  aiAnswerInkQuery,
  aiGradingRunsQuery,
  aiPromptsQuery,
} from "@/queries/aiGrading"
import { aiGradingSettingsQuery } from "@/queries/aiProvider"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import { AiAnswerDetailPanel } from "./AiAnswerDetailPanel"
import { AiAnswerList } from "./AiAnswerList"
import { AiBulkActionsBar } from "./AiBulkActionsBar"
import { AiGradingToolbar } from "./AiGradingToolbar"
import { AiPromptPanel } from "./AiPromptPanel"
import { AiSettingsComparisonTable } from "./AiSettingsComparisonTable"
import { useAiAnswerReviewState } from "./hooks/useAiAnswerReviewState"
import { useAiGradingAnswers } from "./hooks/useAiGradingAnswers"
import type { AiGradingRunRow, AiPromptRow } from "./types"
import { resolveDefaultPromptId } from "./utils/attemptSelection"
import {
  buildInkMeasurementSignature,
  indexInkMeasurements,
} from "./utils/inkMeasurement"

/** まだ届いていないときの空（毎回作り直さない） */
const NO_PROMPTS: AiPromptRow[] = []
const NO_RUNS: AiGradingRunRow[] = []

interface AiGradingWorkspaceProps {
  examId: string
  currentUserId: string
  cropRegion: QuestionAnswerRegionRow
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** この設問の採点行（誰の分も） */
  questionScores: QuestionScoreRow[]
  pageSize: string
  unlockedProviders: GradingProviderId[]
  /** 左の列の上に置く設問ナビゲーター */
  questionNavigator: ReactNode
}

/**
 * 設問1つぶんの AI 採点の作業場。左にプロンプト、中央に答案の一覧、右に詳細。
 *
 * 表示する試行・選んでいるプロンプト・答案の選択は、ここが持つ利用者の選択だけで、
 * 表示はそこから毎回導く（消えた選択を状態へ書き戻さない）。
 */
export function AiGradingWorkspace({
  examId,
  currentUserId,
  cropRegion,
  studentAnswerImages,
  questionScores,
  pageSize,
  unlockedProviders,
  questionNavigator,
}: AiGradingWorkspaceProps) {
  const promptsQuery = useQuery(aiPromptsQuery(examId, cropRegion.id))
  const runsQuery = useQuery(aiGradingRunsQuery(examId, cropRegion.id, false))
  const { data: settings } = useQuery(aiGradingSettingsQuery())
  const prompts = promptsQuery.data ?? NO_PROMPTS
  const runs = runsQuery.data ?? NO_RUNS

  const pageAnswerImages = useMemo(
    () =>
      studentAnswerImages.filter(
        (studentAnswerImage) =>
          studentAnswerImage.examPageId === cropRegion.examPageId
      ),
    [studentAnswerImages, cropRegion.examPageId]
  )
  const inkQuery = useQuery(
    aiAnswerInkQuery(
      cropRegion.id,
      buildInkMeasurementSignature(cropRegion, pageAnswerImages)
    )
  )
  const inkMeasurementByAnswerImageId = useMemo(
    () => indexInkMeasurements(inkQuery.data ?? [], cropRegion.id),
    [inkQuery.data, cropRegion.id]
  )

  const answers = useAiGradingAnswers({
    cropRegion,
    currentUserId,
    studentAnswerImages: pageAnswerImages,
    questionScores,
    runs,
    inkMeasurementByAnswerImageId,
  })

  // ── 利用者の選択（表示はここから導く） ───────────────────────
  const [chosenPromptId, setChosenPromptId] = useState<string | null>(null)
  const [chosenProvider, setChosenProvider] =
    useState<GradingProviderId | null>(null)

  const selectedPromptId = prompts.some(
    (prompt) => prompt.id === chosenPromptId
  )
    ? chosenPromptId
    : resolveDefaultPromptId(prompts, runs, currentUserId)
  const selectedPrompt =
    prompts.find((prompt) => prompt.id === selectedPromptId) ?? null

  const provider =
    chosenProvider && unlockedProviders.includes(chosenProvider)
      ? chosenProvider
      : settings && unlockedProviders.includes(settings.defaultProvider)
        ? settings.defaultProvider
        : unlockedProviders[0]

  const points = cropRegion.points
  /** プロンプトの版の番号（古い順に 1 から。表示のためだけのもの） */
  const promptNumberById = useMemo(
    () =>
      new Map(
        prompts.map((prompt, promptIndex) => [prompt.id, promptIndex + 1])
      ),
    [prompts]
  )
  const {
    reviewedAnswers,
    focusedAnswer,
    setFocusedExamStudentId,
    selectedExamStudentIds,
    toggleSelected,
    chooseAttempt,
    answerOrder,
    setAnswerOrder,
  } = useAiAnswerReviewState({ answers, selectedPromptId, points })

  if (!provider) return null

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* 左: 設問・プロンプト・設定の比較 */}
      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r px-3">
        {questionNavigator}
        <AiPromptPanel
          examId={examId}
          cropRegion={cropRegion}
          prompts={prompts}
          promptNumberById={promptNumberById}
          selectedPromptId={selectedPromptId}
          onSelectPrompt={setChosenPromptId}
          provider={provider}
          settings={settings}
          reviewedAnswers={reviewedAnswers}
          selectedExamStudentIds={selectedExamStudentIds}
        />
        <AiSettingsComparisonTable
          runs={runs}
          questionScores={questionScores}
          cropRegionId={cropRegion.id}
          currentUserId={currentUserId}
          points={points}
        />
      </aside>

      {/* 中央: 答案の一覧 */}
      <section
        aria-label="答案と AI の判定"
        className="flex min-w-0 flex-1 flex-col"
      >
        <AiGradingToolbar
          examId={examId}
          cropRegion={cropRegion}
          runs={runs}
          provider={provider}
          unlockedProviders={unlockedProviders}
          onProviderChange={setChosenProvider}
          settings={settings}
          selectedPrompt={selectedPrompt}
          reviewedAnswers={reviewedAnswers}
          questionScores={questionScores}
          currentUserId={currentUserId}
          selectedExamStudentIds={selectedExamStudentIds}
          answerOrder={answerOrder}
          onAnswerOrderChange={setAnswerOrder}
        />
        <AiBulkActionsBar
          examId={examId}
          cropRegion={cropRegion}
          pageSize={pageSize}
          reviewedAnswers={reviewedAnswers}
        />
        {inkQuery.error && (
          <p className="border-b bg-amber-50 px-3 py-1 text-xs text-amber-800">
            答案のインクを測れませんでした。白紙の除外と注釈の自動配置は使えません
          </p>
        )}
        <AiAnswerList
          cropRegion={cropRegion}
          reviewedAnswers={reviewedAnswers}
          focusedExamStudentId={
            focusedAnswer?.answer.studentAnswerImage.examStudentId ?? null
          }
          onFocus={setFocusedExamStudentId}
          selectedExamStudentIds={selectedExamStudentIds}
          onToggleSelected={toggleSelected}
        />
      </section>

      {/* 右: 詳細 */}
      <aside className="flex w-md shrink-0 flex-col overflow-y-auto border-l">
        {focusedAnswer ? (
          <AiAnswerDetailPanel
            key={focusedAnswer.answer.studentAnswerImage.examStudentId}
            examId={examId}
            cropRegion={cropRegion}
            pageSize={pageSize}
            reviewedAnswer={focusedAnswer}
            promptNumberById={promptNumberById}
            onChooseAttempt={(attemptId) =>
              chooseAttempt(
                focusedAnswer.answer.studentAnswerImage.examStudentId,
                attemptId
              )
            }
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            この設問の答案がありません
          </p>
        )}
      </aside>
    </div>
  )
}
