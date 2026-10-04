"use client"

import { Gavel, Layout, RefreshCw, SquarePen } from "lucide-react"

import { GuardedLink } from "@/components/common/GuardedLink"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import { ShortcutTooltip } from "@/components/exams/07-score-at-once/ScoringSidePanel/ShortcutTooltip"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"
import { DecisionVerdictButtons } from "@/components/exams/08-finalize/DecisionVerdictButtons"
import type { DecisionGridItem } from "@/components/exams/08-finalize/hooks/useFinalizeData"
import type { DecisionVerdict } from "@/components/exams/08-finalize/hooks/useFinalizeScreen"
import { SelectedCellDetail } from "@/components/exams/08-finalize/SelectedCellDetail"
import type { DecisionFilterSettings } from "@/components/exams/08-finalize/types"
import { Button } from "@/components/ui/button"
import { examWorkflowSteps, workflowStepHref } from "@/lib/shared/workflowSteps"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  ExamDecisionSummary,
  ScoreDecisionQuestion,
} from "@/types/scoreDecision.types"

/** 絞り込みの並びと見た目（裁定理由ごと） */
const FILTER_BUTTONS: ReadonlyArray<{
  reason: keyof DecisionFilterSettings
  label: string
  activeClassName: string
}> = [
  {
    reason: "conflict",
    label: "食い違い",
    activeClassName: "border-purple-600 bg-purple-50 text-purple-800",
  },
  {
    reason: "stale",
    label: "要再確認",
    activeClassName: "border-yellow-600 bg-yellow-50 text-yellow-800",
  },
  {
    reason: "decided",
    label: "確定済み",
    activeClassName: "border-green-600 bg-green-50 text-green-800",
  },
]

interface FinalizeSidePanelProps {
  examId: string
  summary: ExamDecisionSummary | null
  decisionCropRegions: QuestionAnswerRegionRow[]
  decisionQuestions: ScoreDecisionQuestion[]
  currentCropRegion: QuestionAnswerRegionRow | null
  currentQuestion: ScoreDecisionQuestion | null
  onQuestionChange: (cropRegionId: string | null) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  filterSettings: DecisionFilterSettings
  onToggleFilter: (reason: keyof DecisionFilterSettings) => void
  onRefresh: () => void
  layoutDirection: LayoutDirection
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  itemsPerLine: number[]
  onItemsPerLineChange: (value: number[]) => void
  expandMargin: number
  onExpandMarginChange: (value: number) => void
  selectedCount: number
  singleSelectedItem: DecisionGridItem | null
  readOnlyReason: string | null
  onDecide: (verdict: DecisionVerdict) => void
  decisionComment: string
  onDecisionCommentChange: (comment: string) => void
  onDecisionCommentCommit: () => void
}

/**
 * 「8. 採点確定」の右パネル。07 の右パネルと同じ並び（状況 → 設問 → 表示 → 判定）で、
 * 中身を確定のものに差し替える。
 */
export function FinalizeSidePanel({
  examId,
  summary,
  decisionCropRegions,
  decisionQuestions,
  currentCropRegion,
  currentQuestion,
  onQuestionChange,
  onPrevQuestion,
  onNextQuestion,
  filterSettings,
  onToggleFilter,
  onRefresh,
  layoutDirection,
  onLayoutDirectionChange,
  itemsPerLine,
  onItemsPerLineChange,
  expandMargin,
  onExpandMarginChange,
  selectedCount,
  singleSelectedItem,
  readOnlyReason,
  onDecide,
  decisionComment,
  onDecisionCommentChange,
  onDecisionCommentCommit,
}: FinalizeSidePanelProps) {
  const pendingCount =
    (summary?.conflictCount ?? 0) + (summary?.staleCount ?? 0)

  // 設問ごとの進み具合は「一覧に載っている答案のうち確定済み」（07 の採点済みにあたる）
  const questionProgress = Object.fromEntries(
    decisionQuestions.map((question) => {
      const decidedCount = question.cells.filter(
        (cell) => cell.reason === "decided"
      ).length
      return [
        question.cropRegionId,
        {
          totalAnswers: question.cells.length,
          gradedAnswers: decidedCount,
          percentage: Math.round((decidedCount / question.cells.length) * 100),
        },
      ]
    })
  )

  const countOf = (reason: keyof DecisionFilterSettings) =>
    currentQuestion?.cells.filter((cell) => cell.reason === reason).length ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-gray-200 bg-white px-3">
      {/* 状況（警告はここ1か所だけに出す） */}
      <SidePanelSection
        icon={Gavel}
        title="裁定"
        rightElement={
          <ShortcutTooltip description="一覧を更新" keys={["R"]}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1"
              onClick={onRefresh}
              aria-label="一覧を更新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </ShortcutTooltip>
        }
      >
        <p className="text-sm">
          要裁定 <span className="font-semibold">{pendingCount}</span>件 ／
          確定済み {summary?.decidedCount ?? 0}件
        </p>
        {summary && summary.conflictCount > 0 && (
          <p className="mt-1 text-[11px] text-purple-700">
            食い違いは確定するまで未採点として出力されます（合計点が最大{" "}
            {summary.totalScoreImpact} 点低く出ます）
          </p>
        )}
        {readOnlyReason && (
          <p className="mt-1 text-[11px] text-gray-500">{readOnlyReason}</p>
        )}
      </SidePanelSection>

      {/* 設問（07 と同じ部品。一覧に載る答案がある設問だけを巡る） */}
      <QuestionNavigator
        questionRegions={decisionCropRegions}
        currentCropRegion={currentCropRegion}
        onCropRegionChange={(cropRegion) =>
          onQuestionChange(cropRegion?.id ?? null)
        }
        onPrevQuestion={onPrevQuestion}
        onNextQuestion={onNextQuestion}
        questionProgress={questionProgress}
      />

      {/* 担当と進み具合（裁定を始めてよいかの目安。直す口は 03） */}
      {currentQuestion && (
        <div className="border-b border-gray-100 py-2 text-[11px] text-gray-600">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-gray-500">担当</span>
            {currentQuestion.assignees.length === 0 ? (
              <span>
                全員（採点 {currentQuestion.scoredCount}/
                {currentQuestion.totalStudents}）
              </span>
            ) : (
              currentQuestion.assignees.map((assignee) => (
                <span
                  key={assignee.userId}
                  className={
                    assignee.scoredCount < currentQuestion.totalStudents
                      ? "font-medium text-amber-700"
                      : ""
                  }
                >
                  {assignee.userName} {assignee.scoredCount}/
                  {currentQuestion.totalStudents}
                </span>
              ))
            )}
            <GuardedLink
              href={workflowStepHref(
                `/exams/${examId}`,
                examWorkflowSteps,
                "03-region-info"
              )}
              className="ml-auto inline-flex items-center gap-0.5 text-blue-600 hover:underline"
            >
              <SquarePen className="h-3 w-3" />
              割り当て
            </GuardedLink>
          </div>
        </div>
      )}

      {/* 表示（絞り込み・並べ方・件数） */}
      <SidePanelSection icon={Layout} title="表示">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1">
            {FILTER_BUTTONS.map((button) => (
              <Button
                key={button.reason}
                variant="outline"
                size="sm"
                className={`h-8 border-2 px-1 text-[11px] ${
                  filterSettings[button.reason]
                    ? button.activeClassName
                    : "text-gray-500"
                }`}
                onClick={() => onToggleFilter(button.reason)}
              >
                {button.label} {countOf(button.reason)}
              </Button>
            ))}
          </div>
          <NavigationControls
            layoutDirection={layoutDirection}
            onLayoutDirectionChange={onLayoutDirectionChange}
            itemsPerRow={itemsPerLine}
            onItemsPerRowChange={onItemsPerLineChange}
            expandMargin={expandMargin}
            onExpandMarginChange={onExpandMarginChange}
          />
        </div>
      </SidePanelSection>

      {/* 判定（07 の採点ボタンと同じ色・キー） */}
      <SidePanelSection
        icon={Gavel}
        title="確定"
        rightElement={
          selectedCount > 0 ? (
            <span className="text-[10px] text-gray-500">
              選択{" "}
              <span className="font-medium text-blue-600">{selectedCount}</span>
            </span>
          ) : undefined
        }
      >
        <DecisionVerdictButtons
          disabled={readOnlyReason !== null || selectedCount === 0}
          onDecide={onDecide}
        />
      </SidePanelSection>

      <SelectedCellDetail
        key={singleSelectedItem?.id ?? "none"}
        item={singleSelectedItem}
        selectedCount={selectedCount}
        maxScore={currentQuestion?.maxScore ?? 0}
        comment={decisionComment}
        onCommentChange={onDecisionCommentChange}
        onCommentCommit={onDecisionCommentCommit}
        editable={readOnlyReason === null}
      />
    </div>
  )
}
