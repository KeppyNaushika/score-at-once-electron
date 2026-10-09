"use client"

import { CheckCircle2 } from "lucide-react"
import Head from "next/head"
import { useCallback, useMemo } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import { useShortcutContext } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"
import { FinalizeSidePanel } from "@/components/exams/08-finalize/FinalizeSidePanel"
import type { DecisionVerdict } from "@/components/exams/08-finalize/hooks/useFinalizeScreen"
import { useFinalizeScreen } from "@/components/exams/08-finalize/hooks/useFinalizeScreen"
import { useFinalizeShortcuts } from "@/components/exams/08-finalize/hooks/useFinalizeShortcuts"
import { ProposalChips } from "@/components/exams/08-finalize/ProposalChips"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useRouteParams } from "@/hooks/useRouteParams"

/**
 * 「8. 採点確定」の画面。**07 の採点と同じ手触りで、食い違いを裁く。**
 *
 * 中央に答案の一覧（07 と同じ部品・同じ表示の設定）、右に 07 と同じ並びのパネル。
 * 答案の下に採点者ごとの結果を色で並べ、判定キー（E/F/J/O/P/U）を押すとその場で
 * 確定を書いて次の答案へ進む。確定は上書きなので、確定済みの答案も選び直して確定できる。
 *
 * **担当の割り当ては 03（領域情報）の「採点担当」タブにある。** ここでは
 * 「誰の採点を突き合わせているか」と「その人がどこまで採点したか」を読むためだけに出す。
 */
function ScoreFinalizeContent() {
  const params = useRouteParams()
  const examId = params.examId ?? ""
  const currentUser = useCurrentUser()
  const { keyBindings } = useShortcutContext()
  const screen = useFinalizeScreen(examId)
  const {
    exam,
    summary,
    loading,
    error,
    currentCropRegion,
    currentQuestion,
    visibleItems,
    visibleIds,
    selectedIds,
    scoringSettings,
    partialScore,
  } = screen

  /** 部分点・保留はボタンからも点を入れる欄を開く（キーと同じ） */
  const handleVerdictButton = useCallback(
    (verdict: DecisionVerdict) => {
      if (verdict === "partial" || verdict === "pending") {
        partialScore.openPartialScoreModal()
        return
      }
      screen.decide(verdict)
    },
    [partialScore, screen]
  )

  useFinalizeShortcuts({
    decide: screen.decide,
    openPartialScoreModal: () => partialScore.openPartialScoreModal(),
    handlePartialScoreInput: partialScore.handlePartialScoreInput,
    handlePartialScoreConfirm: partialScore.handlePartialScoreConfirm,
    handlePartialScoreCancel: partialScore.handlePartialScoreCancel,
    handlePartialScoreBackspace: partialScore.handlePartialScoreBackspace,
    handleGridNavigation: screen.handleGridNavigation,
    handleNextQuestion: screen.handleNextQuestion,
    handlePrevQuestion: screen.handlePrevQuestion,
    handleZoomIn: screen.zoom.handleZoomIn,
    handleZoomOut: screen.zoom.handleZoomOut,
    handleResetZoom: screen.zoom.handleResetZoom,
    handleRefresh: screen.handleRefresh,
    handleSelectAll: screen.handleSelectAll,
  })

  const cellById = useMemo(
    () => new Map(visibleItems.map((item) => [item.id, item.cell])),
    [visibleItems]
  )

  const renderMain = () => {
    if (loading) {
      return <div className="p-6 text-sm text-gray-500">読み込み中...</div>
    }
    if (error) {
      return <div className="p-6 text-sm text-red-600">{error}</div>
    }
    if (!currentQuestion || !currentCropRegion) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-500">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <p>裁定が必要な採点はありません。</p>
          <p className="text-xs">
            採点者の結果が一致している答案は、確定しなくてもそのまま出力されます。
          </p>
        </div>
      )
    }
    if (visibleItems.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-500">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <p>この設問で表示する答案はありません。</p>
          <p className="text-xs">
            右の「表示」で絞り込みを変えると、ほかの答案を表示できます。
          </p>
        </div>
      )
    }
    return (
      <AnswerGridView
        allScoringData={visibleItems}
        masterAnswerData={screen.masterAnswerData}
        filteredScoringDataIds={visibleIds}
        selectedScoringDataIds={selectedIds}
        onScoringDataSelect={screen.handleSelectAnswer}
        onScoringDataReplace={(ids) => screen.setSelection(new Set(ids))}
        layoutDirection={scoringSettings.layoutDirection}
        itemsPerRow={scoringSettings.itemsPerLine}
        autoScroll={scoringSettings.autoScroll}
        showStudentNames
        expandMargin={scoringSettings.expandMargin}
        currentUserId={currentUser.id}
        renderCellDetail={(answer) => {
          const cell = cellById.get(answer.id)
          return cell ? <ProposalChips cell={cell} /> : null
        }}
        className="p-4"
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点確定 - ${exam?.examName ?? "試験"}`}</title>
      </Head>

      <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">{renderMain()}</div>

        <div className="w-96 shrink-0">
          <FinalizeSidePanel
            examId={examId}
            summary={summary}
            decisionCropRegions={screen.decisionCropRegions}
            decisionQuestions={screen.decisionQuestions}
            currentCropRegion={currentCropRegion}
            currentQuestion={currentQuestion}
            onQuestionChange={screen.changeQuestion}
            onPrevQuestion={screen.handlePrevQuestion}
            onNextQuestion={screen.handleNextQuestion}
            filterSettings={screen.filterSettings}
            onToggleFilter={screen.handleToggleFilter}
            onRefresh={screen.handleRefresh}
            layoutDirection={scoringSettings.layoutDirection}
            onLayoutDirectionChange={scoringSettings.setLayoutDirection}
            itemsPerLine={scoringSettings.itemsPerLine}
            onItemsPerLineChange={scoringSettings.setItemsPerLine}
            expandMargin={scoringSettings.expandMargin}
            onExpandMarginChange={scoringSettings.setExpandMargin}
            selectedCount={selectedIds.size}
            singleSelectedItem={screen.singleSelectedItem}
            readOnlyReason={screen.readOnlyReason}
            onDecide={handleVerdictButton}
            decisionComment={screen.decisionComment}
            onDecisionCommentChange={screen.changeDecisionComment}
            onDecisionCommentCommit={screen.saveDecisionComment}
          />
        </div>
      </div>

      {currentCropRegion && (
        <PartialScoreModal
          isOpen={partialScore.showPartialScoreModal}
          value={partialScore.partialScoreInput}
          maxPoints={currentCropRegion.points ?? 0}
          questionLabel={currentCropRegion.label}
          onClose={partialScore.handlePartialScoreCancel}
          onChange={partialScore.handlePartialScoreChange}
          onConfirmPartial={() =>
            partialScore.handlePartialScoreConfirm("partial")
          }
          onConfirmPending={() =>
            partialScore.handlePartialScoreConfirm("pending")
          }
          onBackspace={partialScore.handlePartialScoreBackspace}
          keyBindings={{
            partialKey: keyBindings["scoring.partial"],
            pendingKey: keyBindings["scoring.pending"],
            cancelKey: keyBindings["modal.cancel"],
          }}
        />
      )}
    </div>
  )
}

export default function ScoreFinalizeMainView() {
  // キー操作は 07 と同じ仕組み（割り当ても同じ設定を読む）
  return (
    <ShortcutProvider>
      <ScoreFinalizeContent />
    </ShortcutProvider>
  )
}
