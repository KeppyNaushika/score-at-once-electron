"use client"

import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useMemo, useState } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import {
  aiAnswerInkQuery,
  aiGradingRunsQuery,
  aiPromptsQuery,
} from "@/queries/aiGrading"
import { aiGradingSettingsQuery } from "@/queries/aiProvider"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import { AiAdoptOverwriteDialog } from "./AiAdoptOverwriteDialog"
import { AiAdoptTabContent } from "./AiAdoptTabContent"
import { AiExamCostSection } from "./AiExamCostSection"
import { AiGradingGrid } from "./AiGradingGrid"
import { AiGradingRunDialog } from "./AiGradingRunDialog"
import { AiGradingRunProgress } from "./AiGradingRunProgress"
import { AiGradingSidePanel } from "./AiGradingSidePanel"
import { AiOwnScoringSection } from "./AiOwnScoringSection"
import { AiPromptPanel } from "./AiPromptPanel"
import { AiRunHistorySection } from "./AiRunHistorySection"
import { AiSelectedAnswerSection } from "./AiSelectedAnswerSection"
import { AiSelectedJudgementSection } from "./AiSelectedJudgementSection"
import { useAiAnnotationDrafts } from "./hooks/useAiAnnotationDrafts"
import { useAiAnswerReviewState } from "./hooks/useAiAnswerReviewState"
import { useAiAttemptNavigation } from "./hooks/useAiAttemptNavigation"
import { useAiGradingAnswers } from "./hooks/useAiGradingAnswers"
import { useAiGridSelection } from "./hooks/useAiGridSelection"
import { useAiOwnScoring } from "./hooks/useAiOwnScoring"
import {
  ADOPT_KINDS,
  type AdoptKind,
  useAiSelectionAdoption,
} from "./hooks/useAiSelectionAdoption"
import type {
  AiGradingRunRow,
  AiGridDisplaySettings,
  AiPromptRow,
} from "./types"
import { resolveDefaultPromptId } from "./utils/attemptSelection"
import {
  buildInkMeasurementSignature,
  indexInkMeasurements,
} from "./utils/inkMeasurement"

/** 左パネルのタブ（点と朱書きは別のタブで、別に反映する） */
const LEFT_TABS = ["prompt", ...ADOPT_KINDS] as const
type LeftTab = (typeof LEFT_TABS)[number]

const LEFT_TAB_LABELS: Record<LeftTab, string> = {
  prompt: "プロンプト",
  score: "採点反映",
  annotation: "アノテーション反映",
}

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
  /** 一覧の表示の設定（一覧表示と同じもの） */
  display: AiGridDisplaySettings
  /** 右パネルの先頭に置く設問ナビゲーター */
  questionNavigator: ReactNode
}

/**
 * 設問1つぶんの AI 採点の作業場。左にプロンプト・採点反映・アノテーション反映のタブ
 * （選んだ答案の AI の判定は採点反映のタブでも見え、朱書きを直す詳細はアノテーション反映のタブ）、
 * 中央に**一覧表示と同じ答案の一覧**
 * （色は自分の採点、斜線と札と朱書きで AI の提案）、右端に設問・絞り込み。
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
  display,
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
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false)

  const selectedPromptId = prompts.some(
    (prompt) => prompt.id === chosenPromptId
  )
    ? chosenPromptId
    : resolveDefaultPromptId(prompts, runs, currentUserId)
  const selectedPrompt =
    prompts.find((prompt) => prompt.id === selectedPromptId) ?? null

  // 送信先の初めの値（実行ダイアログで選び直せる）
  const provider =
    settings && unlockedProviders.includes(settings.defaultProvider)
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
    chooseAttempt,
    chosenRunId,
    chooseRun,
    answerOrder,
    setAnswerOrder,
  } = useAiAnswerReviewState({
    answers,
    selectedPromptId,
    points,
    runs,
    currentUserId,
  })
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers,
    layoutDirection: display.layoutDirection,
    itemsPerLine: display.itemsPerLine,
  })
  const { draftAnnotationsByAttemptId, updateDraft } = useAiAnnotationDrafts()
  const [leftTab, setLeftTab] = useState<LeftTab>("prompt")
  // I・詳細のボタンが反映するもの（最後に開いた反映のタブ。プロンプトを開いていても変えない）
  const [adoptKind, setAdoptKind] = useState<AdoptKind>("score")
  const adoption = useAiSelectionAdoption({
    examId,
    cropRegion,
    pageSize,
    selectedItems: grid.selectedItems,
    adoptKind,
    draftAnnotationsByAttemptId,
    onAdopted: grid.markAdopted,
  })
  const { showOlderAttempt, showNewerAttempt } = useAiAttemptNavigation({
    singleSelectedItem: grid.singleSelectedItem,
    onChooseAttempt: chooseAttempt,
    onAdopt: adoption.requestAdopt,
  })
  // 採点反映のタブでは、一覧表示と同じキーで自分の採点を直接書ける
  const { scoreSelected, partialScore } = useAiOwnScoring({
    examId,
    currentUserId,
    cropRegion,
    studentAnswerImages,
    questionScores,
    selectedItems: grid.selectedItems,
    isShortcutEnabled: leftTab === "score",
    onScored: grid.markScored,
  })
  if (!provider) return null

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* 左: 実行の進み具合と、プロンプト・採点反映・アノテーション反映のタブ */}
      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r px-3">
        <AiGradingRunProgress
          examId={examId}
          cropRegionId={cropRegion.id}
          runs={runs}
        />
        <Tabs
          value={leftTab}
          onValueChange={(value) => {
            const chosen = LEFT_TABS.find((tab) => tab === value)
            if (!chosen) return
            setLeftTab(chosen)
            const chosenAdoptKind = ADOPT_KINDS.find((kind) => kind === chosen)
            if (chosenAdoptKind) setAdoptKind(chosenAdoptKind)
          }}
          className="pt-2"
        >
          <TabsList className="w-full">
            {LEFT_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="px-1 text-xs">
                {LEFT_TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="prompt">
            <AiPromptPanel
              examId={examId}
              cropRegion={cropRegion}
              prompts={prompts}
              promptNumberById={promptNumberById}
              selectedPromptId={selectedPromptId}
              onSelectPrompt={setChosenPromptId}
              onRunWithPrompt={(promptId) => {
                setChosenPromptId(promptId)
                setIsRunDialogOpen(true)
              }}
              provider={provider}
              settings={settings}
              reviewedAnswers={reviewedAnswers}
              selectedExamStudentIds={grid.selectedIds}
            />
            <AiRunHistorySection
              runs={runs}
              questionScores={questionScores}
              cropRegionId={cropRegion.id}
              currentUserId={currentUserId}
              points={points}
              promptNumberById={promptNumberById}
              chosenRunId={chosenRunId}
              onChooseRun={chooseRun}
            />
            <AiExamCostSection examId={examId} />
          </TabsContent>
          {ADOPT_KINDS.map((kind) => (
            <TabsContent key={kind} value={kind}>
              <AiAdoptTabContent
                adoptKind={kind}
                examId={examId}
                cropRegion={cropRegion}
                pageSize={pageSize}
                reviewedAnswers={reviewedAnswers}
                draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
                selectedCount={grid.selectedItems.length}
                onAdoptSelected={adoption.requestAdopt}
                visibleItems={grid.visibleItems}
                onAdoptVisible={adoption.requestAdoptVisible}
                isAdopting={adoption.isAdopting}
              />
              {kind === "score" && (
                <>
                  <AiSelectedJudgementSection
                    singleSelectedItem={grid.singleSelectedItem}
                    promptNumberById={promptNumberById}
                    onPrevAttempt={showOlderAttempt}
                    onNextAttempt={showNewerAttempt}
                  />
                  <AiOwnScoringSection
                    cropRegion={cropRegion}
                    selectedCount={grid.selectedItems.length}
                    onScore={scoreSelected}
                    partialScore={partialScore}
                  />
                </>
              )}
              {kind === "annotation" && (
                <AiSelectedAnswerSection
                  singleSelectedItem={grid.singleSelectedItem}
                  cropRegion={cropRegion}
                  currentUserId={currentUserId}
                  studentAnswerImages={studentAnswerImages}
                  pageSize={pageSize}
                  draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
                  onDraftChange={updateDraft}
                  onAnnotationChanged={display.onAnnotationChanged}
                  promptNumberById={promptNumberById}
                  onPrevAttempt={showOlderAttempt}
                  onNextAttempt={showNewerAttempt}
                  onAdopt={adoption.requestAdopt}
                  adoptActionLabel={adoption.adoptActionLabel}
                  isAdopting={adoption.isAdopting}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </aside>

      {/* 中央: 一覧表示と同じ答案の一覧（答案の下に AI の提案） */}
      <section
        aria-label="答案と AI の判定"
        className="flex min-w-0 flex-1 flex-col"
      >
        {inkQuery.error && (
          <p className="border-b bg-amber-50 px-3 py-1 text-xs text-amber-800">
            答案のインクを測れませんでした。白紙の除外と注釈の自動配置は使えません
          </p>
        )}
        <div className="min-h-0 flex-1">
          <AiGradingGrid
            cropRegion={cropRegion}
            currentUserId={currentUserId}
            pageSize={pageSize}
            display={display}
            visibleItems={grid.visibleItems}
            visibleIds={grid.visibleIds}
            selectedIds={grid.selectedIds}
            onSelect={grid.handleSelectAnswer}
            onReplaceSelection={(ids) => grid.setSelection(new Set(ids))}
            totalCount={reviewedAnswers.length}
            draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
          />
        </div>
      </section>

      {/* 右端に固定: 設問・表示 */}
      <div className="w-96 shrink-0">
        <AiGradingSidePanel
          questionNavigator={questionNavigator}
          displaySection={{
            display,
            filterSettings: grid.filterSettings,
            onToggleFilter: grid.toggleFilter,
            onToggleConfidenceFilter: grid.toggleConfidenceFilter,
            selectedCount: grid.selectedIds.size,
            visibleCount: grid.visibleItems.length,
            answerOrder,
            onAnswerOrderChange: setAnswerOrder,
            totalCount: reviewedAnswers.length,
          }}
        />
      </div>

      <AiAdoptOverwriteDialog {...adoption.overwriteDialog} />

      {selectedPrompt && settings && (
        <AiGradingRunDialog
          open={isRunDialogOpen}
          onOpenChange={setIsRunDialogOpen}
          examId={examId}
          cropRegion={cropRegion}
          settings={settings}
          initialProvider={provider}
          unlockedProviders={unlockedProviders}
          prompt={selectedPrompt}
          reviewedAnswers={reviewedAnswers}
          questionScores={questionScores}
          currentUserId={currentUserId}
          selectedExamStudentIds={grid.selectedIds}
        />
      )}
    </div>
  )
}
