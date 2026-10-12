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
import { AiGradingGrid } from "./AiGradingGrid"
import { AiGradingRunDialog } from "./AiGradingRunDialog"
import { AiGradingRunProgress } from "./AiGradingRunProgress"
import { AiGradingSidePanel } from "./AiGradingSidePanel"
import { AiPromptPanel } from "./AiPromptPanel"
import { AiQuestioningPanel } from "./AiQuestioningPanel"
import { AiQuestioningStatusNotice } from "./AiQuestioningStatusNotice"
import { AiRunHistorySection } from "./AiRunHistorySection"
import { useAiAnswerReviewState } from "./hooks/useAiAnswerReviewState"
import { useAiCheckQuestions } from "./hooks/useAiCheckQuestions"
import { useAiGradingAnswers } from "./hooks/useAiGradingAnswers"
import { useAiGradingQuestions } from "./hooks/useAiGradingQuestions"
import { useAiGridSelection } from "./hooks/useAiGridSelection"
import { useAiQuestioning } from "./hooks/useAiQuestioning"
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
 * 左パネルのタブ。AI採点と AIチェックは、タブの中に問いかけ（問い・選択肢・記録・見直し）を出す
 * （中央はどのタブでも答案の一覧）
 */
const LEFT_TABS = ["prompt", "grade", "check"] as const
type LeftTab = (typeof LEFT_TABS)[number]

const LEFT_TAB_LABELS: Record<LeftTab, string> = {
  prompt: "採点指示",
  grade: "AI採点",
  check: "AIチェック",
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
 * 設問1つぶんの AI採点の作業場。左に採点指示・AI採点・AIチェックのタブ
 * （実行の入口は採点指示のタブ。問いかけ・自分で採点するボタン・その目的の実行の履歴は
 * AI採点・AIチェックのタブの中）、
 * 中央はどのタブでも**一覧表示と同じ答案の一覧**（色は自分の採点、斜線と札で AI の提案。
 * 問いかけのタブでは、いまの問いの答案に絞り、確定すると付く点を斜線で重ねる）、右端に設問・絞り込み。
 *
 * 朱書きはルーブリック項目の助言から作る（AI が答案ごとに文案を書くことはない。
 * docs/vlm-grading-design.md §4-7）。
 *
 * 表示する実行・選んでいる採点指示・答案の選択は、ここが持つ利用者の選択だけで、
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
  /** 採点指示の番号（古い順に 1 から。表示のためだけのもの） */
  const promptNumberById = useMemo(
    () =>
      new Map(
        prompts.map((prompt, promptIndex) => [prompt.id, promptIndex + 1])
      ),
    [prompts]
  )
  const gradingQuestions = useAiGradingQuestions({ examId, cropRegion, runs })
  const checkQuestions = useAiCheckQuestions({
    examId,
    cropRegion,
    runs,
    answers,
  })
  // タブを選んでいなければ、AI採点を実行した設問（案がある・作っている）では AI採点を開く
  const [chosenLeftTab, setChosenLeftTab] = useState<LeftTab | null>(null)
  const leftTab: LeftTab =
    chosenLeftTab ??
    (gradingQuestions.proposalRun !== null ||
    gradingQuestions.status.kind !== "idle"
      ? "grade"
      : "prompt")
  const questioningMode =
    leftTab === "grade" || leftTab === "check" ? leftTab : null
  // 履歴はタブごとに目的を分けて出すので、効く実行もいまのタブの目的のものだけ
  const { reviewedAnswers, chosenRunId, chooseRun } = useAiAnswerReviewState({
    answers,
    selectedPromptId,
    points,
    runs,
    currentUserId,
    purpose: questioningMode,
    answerOrder: viewSettings.answerOrder,
  })
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
    persistAdviceText: gradingQuestions.persistAdviceText,
    persistInstructionText: gradingQuestions.persistInstructionText,
    discardInstructionTexts: gradingQuestions.discardInstructionTexts,
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
  // 自分で採点している間は、一覧の選択の代わりに焦点の答案を出す
  const selectionOverride = questioning.gridSelectionOverride
  if (!provider) return null

  /** AI採点・AIチェックのタブの下に、そのタブの目的の実行の履歴 */
  const runHistorySection = (purpose: AiGradingStage1Purpose) => (
    <AiRunHistorySection
      purpose={purpose}
      runs={runs}
      questionScores={questionScores}
      cropRegion={cropRegion}
      currentUserId={currentUserId}
      points={points}
      promptNumberById={promptNumberById}
      chosenRunId={chosenRunId}
      onChooseRun={chooseRun}
    />
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* 左: 実行の進み具合と、採点指示・AI採点・AIチェックのタブ */}
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
          <TabsList className="grid h-auto w-full grid-cols-3">
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
              onRunWithPrompt={(promptId, purpose) => {
                setChosenPromptId(promptId)
                setRunDialog({ purpose })
              }}
              settings={settings}
            />
          </TabsContent>
          <TabsContent value="grade">
            <AiQuestioningPanel
              mode="grade"
              questioning={questioning}
              cropRegion={cropRegion}
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
                  : gradingQuestions.status.kind === "idle"
                    ? "「採点指示」のタブから AI採点を実行してください。"
                    : "AI の判定から作った項目の案を、ここで1問ずつ問いかけます。"
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
            {runHistorySection("grade")}
          </TabsContent>
          <TabsContent value="check">
            <AiQuestioningPanel
              mode="check"
              questioning={questioning}
              cropRegion={cropRegion}
              statusNotice={null}
              emptyMessage={
                checkQuestions.status === "running"
                  ? "AI が判定しています…"
                  : checkQuestions.status === "idle"
                    ? "「採点指示」のタブから AIチェックを実行してください。"
                    : "不一致は見つかりませんでした。"
              }
              notes=""
            />
            {runHistorySection("check")}
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
            pageAnswerImages={pageAnswerImages}
            advicePreview={questioning.advicePreview}
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

      {selectedPrompt && settings && (
        <AiGradingRunDialog
          purpose={runDialog?.purpose ?? "grade"}
          initialScope={runDialog?.initialScope}
          open={runDialog !== null}
          onOpenChange={(open) => {
            if (!open) setRunDialog(null)
          }}
          // 送ったら、進み具合と問いかけが出るタブへ移る
          onSent={setChosenLeftTab}
          examId={examId}
          cropRegion={cropRegion}
          settings={settings}
          initialProvider={provider}
          unlockedProviders={unlockedProviders}
          prompt={selectedPrompt}
          promptNumber={promptNumberById.get(selectedPrompt.id)}
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
