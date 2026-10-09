"use client"

import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useMemo, useState } from "react"

import { useAnswerWhiteness } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { aiGradingRunsQuery, aiPromptsQuery } from "@/queries/aiGrading"
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
import { AiQuestioningPanel } from "./AiQuestioningPanel"
import { AiRunHistorySection } from "./AiRunHistorySection"
import { AiSelectedJudgementSection } from "./AiSelectedJudgementSection"
import { useAiAnswerReviewState } from "./hooks/useAiAnswerReviewState"
import { useAiAttemptNavigation } from "./hooks/useAiAttemptNavigation"
import { useAiGradingAnswers } from "./hooks/useAiGradingAnswers"
import { useAiGridSelection } from "./hooks/useAiGridSelection"
import { useAiOwnScoring } from "./hooks/useAiOwnScoring"
import { useAiQuestioningState } from "./hooks/useAiQuestioningState"
import { useAiSelectionAdoption } from "./hooks/useAiSelectionAdoption"
import type {
  AiGradingRunRow,
  AiGridDisplaySettings,
  AiGridViewSettings,
  AiPromptRow,
} from "./types"
import { resolveDefaultPromptId } from "./utils/attemptSelection"

/** 左パネルのタブ */
const LEFT_TABS = ["prompt", "question", "score"] as const
type LeftTab = (typeof LEFT_TABS)[number]

const LEFT_TAB_LABELS: Record<LeftTab, string> = {
  prompt: "プロンプト",
  question: "問いかけ",
  score: "採点反映",
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
  /** 一覧の絞り込みと並べ方（設問をまたいで残すので、AI採点モードの根が持つ） */
  viewSettings: AiGridViewSettings
  /** 右パネルの先頭に置く設問ナビゲーター */
  questionNavigator: ReactNode
  /** 助言の朱書きを書いた（一覧の注釈を取り直す合図） */
  onAnnotationsChanged?: () => void
}

/**
 * 設問1つぶんの AI 採点の作業場。左にプロンプト・採点反映のタブ
 * （選んだ答案の AI の判定は採点反映のタブで見る）、中央に**一覧表示と同じ答案の一覧**
 * （色は自分の採点、斜線と札で AI の提案）、右端に設問・絞り込み。
 *
 * AI が答案ごとに書く朱書きの文案は採用しない（朱書きはルーブリック項目の助言から作る。
 * docs/vlm-grading-design.md §4-7）。
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
  viewSettings,
  questionNavigator,
  onAnnotationsChanged,
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
  // 白さ順のため、一覧表示と同じ測定で枠の白さを測る（白紙はアプリが判定しない）
  const { whitenessByAnswerId, isWhitenessReady } = useAnswerWhiteness({
    studentAnswerImages,
    cropRegions: [cropRegion],
    currentExamPageId: cropRegion.examPageId,
    enabled: true,
  })

  const answers = useAiGradingAnswers({
    cropRegion,
    currentUserId,
    studentAnswerImages: pageAnswerImages,
    questionScores,
    runs,
    whitenessByAnswerImageId: whitenessByAnswerId,
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
  const { reviewedAnswers, chooseAttempt, chosenRunId, chooseRun } =
    useAiAnswerReviewState({
      answers,
      selectedPromptId,
      points,
      runs,
      currentUserId,
      answerOrder: viewSettings.answerOrder,
    })
  const questioning = useAiQuestioningState({
    examId,
    cropRegionId: cropRegion.id,
    runs,
    answers,
  })
  // タブを選んでいなければ、AI 採点を実行した設問（案がある・作っている）では問いかけを開く
  const [chosenLeftTab, setChosenLeftTab] = useState<LeftTab | null>(null)
  const leftTab: LeftTab =
    chosenLeftTab ??
    (questioning.proposalRun !== null || questioning.status.kind !== "idle"
      ? "question"
      : "prompt")
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers,
    layoutDirection: display.layoutDirection,
    itemsPerLine: display.itemsPerLine,
    viewSettings,
    // 問いかけている案の答案を、選ぶ前に目で確かめられるよう一覧に出す
    pinnedExamStudentIds:
      leftTab === "question" ? questioning.gridExamStudentIds : null,
  })
  const adoption = useAiSelectionAdoption({
    examId,
    cropRegion,
    selectedItems: grid.selectedItems,
    onAdopted: grid.markAdopted,
  })
  const { showOlderAttempt, showNewerAttempt } = useAiAttemptNavigation({
    singleSelectedItem: grid.singleSelectedItem,
    onChooseAttempt: chooseAttempt,
    onAdopt: adoption.requestAdopt,
  })
  // 採点反映・問いかけのタブでは、一覧表示と同じキーで自分の採点を直接書ける
  // （問いかけでは、案に答えずに例外の答案を直す。項目が当たっていれば手での上書きになる）
  const { scoreSelected, partialScore } = useAiOwnScoring({
    examId,
    currentUserId,
    cropRegion,
    studentAnswerImages,
    questionScores,
    selectedItems: grid.selectedItems,
    isShortcutEnabled: leftTab === "score" || leftTab === "question",
    onScored: grid.markScored,
  })
  if (!provider) return null

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* 左: 実行の進み具合と、プロンプト・採点反映のタブ */}
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
            if (chosen) setChosenLeftTab(chosen)
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
              settings={settings}
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
          <TabsContent value="question">
            <AiQuestioningPanel
              examId={examId}
              cropRegion={cropRegion}
              currentUserId={currentUserId}
              questionScores={questionScores}
              studentAnswerImages={studentAnswerImages}
              pageSize={pageSize}
              questioning={questioning}
              onScored={grid.markAdopted}
              onAnnotationsChanged={onAnnotationsChanged}
              onStartNextRound={() => setIsRunDialogOpen(true)}
              onShowAdoption={() => setChosenLeftTab("score")}
              selectedJudgement={
                <AiSelectedJudgementSection
                  singleSelectedItem={grid.singleSelectedItem}
                  promptNumberById={promptNumberById}
                  onPrevAttempt={showOlderAttempt}
                  onNextAttempt={showNewerAttempt}
                />
              }
            />
          </TabsContent>
          <TabsContent value="score">
            <AiAdoptTabContent
              examId={examId}
              cropRegion={cropRegion}
              reviewedAnswers={reviewedAnswers}
              selectedCount={grid.selectedItems.length}
              onAdoptSelected={adoption.requestAdopt}
              visibleItems={grid.visibleItems}
              onAdoptVisible={adoption.requestAdoptVisible}
              isAdopting={adoption.isAdopting}
            />
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
          </TabsContent>
        </Tabs>
      </aside>

      {/* 中央: 一覧表示と同じ答案の一覧（答案の下に AI の提案） */}
      <section
        aria-label="答案と AI の判定"
        className="flex min-w-0 flex-1 flex-col"
      >
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
            selectedCount: grid.selectedIds.size,
            visibleCount: grid.visibleItems.length,
            answerOrder: viewSettings.answerOrder,
            onAnswerOrderChange: viewSettings.setAnswerOrder,
            isWhitenessReady,
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
        />
      )}
    </div>
  )
}
