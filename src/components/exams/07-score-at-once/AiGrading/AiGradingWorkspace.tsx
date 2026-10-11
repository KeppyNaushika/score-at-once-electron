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
import type { AiGradingStage1Purpose } from "@/types/aiGrading.types"

import { useScoringKeysPausedWhile } from "../Rubric/hooks/useScoringKeysPausedWhile"
import { AiAdoptOverwriteDialog } from "./AiAdoptOverwriteDialog"
import { AiAdoptTabContent } from "./AiAdoptTabContent"
import { AiGradingGrid } from "./AiGradingGrid"
import { AiGradingRunDialog } from "./AiGradingRunDialog"
import { AiGradingRunProgress } from "./AiGradingRunProgress"
import { AiGradingSidePanel } from "./AiGradingSidePanel"
import { AiOwnScoringSection } from "./AiOwnScoringSection"
import { AiPromptPanel } from "./AiPromptPanel"
import { AiQuestioningPanel } from "./AiQuestioningPanel"
import { AiQuestioningStatusNotice } from "./AiQuestioningStatusNotice"
import { AiRunHistorySection } from "./AiRunHistorySection"
import { AiSelectedJudgementSection } from "./AiSelectedJudgementSection"
import { useAiAnswerReviewState } from "./hooks/useAiAnswerReviewState"
import { useAiAttemptNavigation } from "./hooks/useAiAttemptNavigation"
import { useAiCheckQuestions } from "./hooks/useAiCheckQuestions"
import { useAiGradingAnswers } from "./hooks/useAiGradingAnswers"
import { useAiGradingQuestions } from "./hooks/useAiGradingQuestions"
import { useAiGridSelection } from "./hooks/useAiGridSelection"
import { useAiOwnScoring } from "./hooks/useAiOwnScoring"
import { useAiQuestioning } from "./hooks/useAiQuestioning"
import { useAiSelectionAdoption } from "./hooks/useAiSelectionAdoption"
import type {
  AiGradingRunRow,
  AiGridDisplaySettings,
  AiGridViewSettings,
  AiPromptRow,
} from "./types"
import { resolveDefaultPromptId } from "./utils/attemptSelection"
import type { AiRubricProposalRow } from "./utils/rubricProposals"
import type { GradingTargetScope } from "./utils/selectGradingTargets"

/**
 * 左パネルのタブ。AI 採点と AI 採点チェックは、タブの中に問いかけ（問い・選択肢・記録・見直し）を出す
 * （中央はどのタブでも答案の一覧）。採点反映（直接採点のまま AI の判定を採用する）は2つの機能の後ろに残す
 */
const LEFT_TABS = ["prompt", "grade", "check", "score"] as const
type LeftTab = (typeof LEFT_TABS)[number]

const LEFT_TAB_LABELS: Record<LeftTab, string> = {
  prompt: "プロンプト",
  grade: "AI 採点",
  check: "AI 採点チェック",
  score: "採点反映",
}

/** 実行ダイアログを開くときの目的と、初めの送る答案の選び方 */
interface RunDialogRequest {
  purpose: AiGradingStage1Purpose
  initialScope?: GradingTargetScope
  /** 「選択した答案」で送る答案（省けば中央の一覧の選択） */
  selectedExamStudentIds?: ReadonlySet<string>
}

/** まだ届いていないときの空（毎回作り直さない） */
const NO_PROMPTS: AiPromptRow[] = []
const NO_RUNS: AiGradingRunRow[] = []
const NO_PROPOSALS: AiRubricProposalRow[] = []

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
 * 設問1つぶんの AI 採点の作業場。左にプロンプト・AI 採点・AI 採点チェック・採点反映のタブ
 * （問いかけはAI 採点・AI 採点チェックのタブの中、選んだ答案の AI の判定は採点反映のタブで見る）、
 * 中央はどのタブでも**一覧表示と同じ答案の一覧**（色は自分の採点、斜線と札で AI の提案。
 * 問いかけのタブでは、いまの問いの答案に絞り、確定すると付く点を斜線で重ねる）、右端に設問・絞り込み。
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
  const [runDialog, setRunDialog] = useState<RunDialogRequest | null>(null)
  // 実行ダイアログを開いている間は、採点のキーも問いかけの 次へ・戻る も止める
  useScoringKeysPausedWhile(runDialog !== null)

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
  const gradingQuestions = useAiGradingQuestions({ examId, cropRegion, runs })
  const checkQuestions = useAiCheckQuestions({
    examId,
    cropRegion,
    runs,
    answers,
  })
  // タブを選んでいなければ、AI 採点を実行した設問（案がある・作っている）では AI 採点を開く
  const [chosenLeftTab, setChosenLeftTab] = useState<LeftTab | null>(null)
  const leftTab: LeftTab =
    chosenLeftTab ??
    (gradingQuestions.proposalRun !== null ||
    gradingQuestions.status.kind !== "idle"
      ? "grade"
      : "prompt")
  const questioningMode =
    leftTab === "grade" || leftTab === "check" ? leftTab : null
  const proposals =
    gradingQuestions.proposalRun?.rubricProposals ?? NO_PROPOSALS
  const questioning = useAiQuestioning({
    mode: questioningMode,
    examId,
    cropRegion,
    currentUserId,
    pageSize,
    studentAnswerImages,
    states:
      questioningMode === "check"
        ? checkQuestions.states
        : gradingQuestions.states,
    persistDecision:
      questioningMode === "check"
        ? checkQuestions.persistDecision
        : gradingQuestions.persistDecision,
    ownScoreOf: checkQuestions.ownScoreOf,
    proposals: questioningMode === "grade" ? proposals : NO_PROPOSALS,
    onAnnotationsChanged,
  })
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers,
    layoutDirection: display.layoutDirection,
    itemsPerLine: display.itemsPerLine,
    viewSettings,
    // 問いかけている問いの答案を、選ぶ前に目で確かめられるよう一覧に出す
    pinnedExamStudentIds: questioning.pinnedExamStudentIds,
  })
  // 1件ずつ自分で採点している間は、一覧の選択の代わりに焦点の答案を出す
  const selectionOverride = questioning.gridSelectionOverride
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
  // 採点反映のタブでは、一覧表示と同じキーで自分の採点を直接書ける（その場で確定）。
  // 問いかけ（AI 採点・チェック）の中の採点キーは「1件ずつ自分で採点する」の下書きで、確定で入る
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

  const ownScoringSection = (
    <AiOwnScoringSection
      cropRegion={cropRegion}
      selectedCount={grid.selectedItems.length}
      onScore={scoreSelected}
      partialScore={partialScore}
    />
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* 左: 実行の進み具合と、プロンプト・AI 採点・AI 採点チェック・採点反映のタブ */}
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
          <TabsList className="grid h-auto w-full grid-cols-4">
            {LEFT_TABS.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-auto px-1 py-1 text-[11px] leading-tight whitespace-normal"
              >
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
                setRunDialog({ purpose: "grade" })
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
          </TabsContent>
          <TabsContent value="grade">
            <AiQuestioningPanel
              mode="grade"
              questioning={questioning}
              cropRegion={cropRegion}
              onRun={
                selectedPrompt ? () => setRunDialog({ purpose: "grade" }) : null
              }
              statusNotice={
                <AiQuestioningStatusNotice
                  examId={examId}
                  cropRegionId={cropRegion.id}
                  status={gradingQuestions.status}
                />
              }
              emptyMessage={
                gradingQuestions.status.kind === "ready"
                  ? "AI は項目の案を返しませんでした。"
                  : "答案を AI に送り、判定から作った項目の案を、ここで1問ずつ問いかけます。決めたことは下書きで、最後に見直して「確定する」を押すと採点に入ります。"
              }
              notes={gradingQuestions.proposalRun?.notes ?? ""}
              onRegrade={(examStudentIds) =>
                setRunDialog({
                  purpose: "grade",
                  initialScope: "selected",
                  selectedExamStudentIds: new Set(examStudentIds),
                })
              }
            />
          </TabsContent>
          <TabsContent value="check">
            <AiQuestioningPanel
              mode="check"
              questioning={questioning}
              cropRegion={cropRegion}
              onRun={
                selectedPrompt ? () => setRunDialog({ purpose: "check" }) : null
              }
              statusNotice={null}
              emptyMessage={
                checkQuestions.status === "running"
                  ? "採点済みの答案を AI が判定しています。終わると、ここで食い違いを問いかけます。"
                  : checkQuestions.status === "idle"
                    ? "採点済みの答案を AI に見せて、見落としや揺れを探します（あなたの点は送りません）。同じ答えに違う点が付いている組と、あなたと AI の判定が違う答案を、ここで1問ずつ問いかけます。"
                    : "食い違いは見つかりませんでした。同じ答えに違う点が付いた組も、AI と判定の違う答案もありません。"
              }
              notes=""
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
            {ownScoringSection}
          </TabsContent>
        </Tabs>
      </aside>

      {/* 中央: どのタブでも、一覧表示と同じ答案の一覧（答案の下に AI の提案） */}
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
            selectedIds={selectionOverride?.selectedIds ?? grid.selectedIds}
            onSelect={
              selectionOverride
                ? (id) => selectionOverride.select(id)
                : grid.handleSelectAnswer
            }
            onReplaceSelection={(ids) =>
              selectionOverride
                ? ids.forEach(selectionOverride.select)
                : grid.setSelection(new Set(ids))
            }
            totalCount={reviewedAnswers.length}
            draftStatusByExamStudentId={
              questioningMode !== null
                ? questioning.draftStatusByExamStudentId
                : undefined
            }
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
          purpose={runDialog?.purpose ?? "grade"}
          initialScope={runDialog?.initialScope}
          open={runDialog !== null}
          onOpenChange={(open) => {
            if (!open) setRunDialog(null)
          }}
          examId={examId}
          cropRegion={cropRegion}
          settings={settings}
          initialProvider={provider}
          unlockedProviders={unlockedProviders}
          prompt={selectedPrompt}
          reviewedAnswers={reviewedAnswers}
          questionScores={questionScores}
          currentUserId={currentUserId}
          selectedExamStudentIds={
            runDialog?.selectedExamStudentIds ?? grid.selectedIds
          }
        />
      )}
    </div>
  )
}
