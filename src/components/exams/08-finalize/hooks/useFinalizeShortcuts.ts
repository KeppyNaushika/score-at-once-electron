import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { usePartialScoreShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/usePartialScoreShortcuts"

import type { DecisionVerdict } from "./useFinalizeScreen"

interface FinalizeShortcutHandlers {
  decide: (verdict: DecisionVerdict) => void
  openPartialScoreModal: () => void
  handlePartialScoreInput: (key: string) => void
  handlePartialScoreConfirm: (confirmType: "partial" | "pending") => void
  handlePartialScoreCancel: () => void
  handlePartialScoreBackspace: () => void
  handleGridNavigation: (key: string) => void
  handleNextQuestion: () => void
  handlePrevQuestion: () => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleResetZoom: () => void
  handleRefresh: () => void
  handleSelectAll: () => void
}

/**
 * 「8. 採点確定」のキー操作。**07 と同じキーで同じことが起きる**ようにする
 * （E で正答、WASD で移動、Shift+A/D で設問、数字で部分点…）。
 * 違いは、書く先が自分の採点ではなく確定であることだけ。
 */
export function useFinalizeShortcuts(handlers: FinalizeShortcutHandlers) {
  const {
    decide,
    openPartialScoreModal,
    handleGridNavigation,
    handleNextQuestion,
    handlePrevQuestion,
  } = handlers

  // 判定キー（割り当ては 07 の採点キーと同じものを使う）
  useSceneCommand("scoring.correct", () => decide("correct"), {
    condition: "hasSelectedAnswers",
    metadata: { title: "正答で確定", category: "確定" },
  })
  useSceneCommand("scoring.incorrect", () => decide("incorrect"), {
    condition: "hasSelectedAnswers",
    metadata: { title: "誤答で確定", category: "確定" },
  })
  useSceneCommand("scoring.noAnswer", () => decide("no_answer"), {
    condition: "hasSelectedAnswers",
    metadata: { title: "無答で確定", category: "確定" },
  })
  useSceneCommand("scoring.doubleMark", () => decide("double_mark"), {
    condition: "hasSelectedAnswers",
    metadata: { title: "Wマークで確定", category: "確定" },
  })

  // 部分点・保留は点を入れる欄を開く（欄の中では同じキーが確定になる）
  useSceneCommand("scoring.partial", openPartialScoreModal, {
    scene: "scoring",
    condition: "hasSelectedAnswers",
    metadata: { title: "部分点で確定", category: "確定" },
  })
  useSceneCommand("scoring.pending", openPartialScoreModal, {
    scene: "scoring",
    condition: "hasSelectedAnswers",
    metadata: { title: "保留で確定", category: "確定" },
  })
  usePartialScoreShortcuts({
    handlePartialScoreInput: handlers.handlePartialScoreInput,
    handlePartialScoreConfirmPartial: () =>
      handlers.handlePartialScoreConfirm("partial"),
    handlePartialScoreConfirmPending: () =>
      handlers.handlePartialScoreConfirm("pending"),
    handlePartialScoreCancel: handlers.handlePartialScoreCancel,
    handlePartialScoreBackspace: handlers.handlePartialScoreBackspace,
  })

  // 覚え書き（K）は欄を持つ SelectedCellDetail が登録する

  // 移動（07 の一覧と同じ）
  useSceneCommand("navigation.moveUp", () => handleGridNavigation("w"), {
    metadata: { title: "上の答案へ", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.moveDown", () => handleGridNavigation("s"), {
    metadata: { title: "下の答案へ", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.moveLeft", () => handleGridNavigation("a"), {
    metadata: { title: "左の答案へ", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.moveRight", () => handleGridNavigation("d"), {
    metadata: { title: "右の答案へ", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.nextQuestion", handleNextQuestion, {
    metadata: { title: "次の設問", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.prevQuestion", handlePrevQuestion, {
    metadata: { title: "前の設問", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.nextQuestionArrow", handleNextQuestion, {
    metadata: { title: "次の設問", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.prevQuestionArrow", handlePrevQuestion, {
    metadata: { title: "前の設問", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.zoomIn", handlers.handleZoomIn, {
    metadata: { title: "表示件数を増やす", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.zoomOut", handlers.handleZoomOut, {
    metadata: { title: "表示件数を減らす", category: "ナビゲーション" },
  })
  useSceneCommand("navigation.resetZoom", handlers.handleResetZoom, {
    metadata: { title: "表示件数を戻す", category: "ナビゲーション" },
  })

  useSceneCommand("filter.refresh", handlers.handleRefresh, {
    metadata: { title: "一覧を更新", category: "フィルタ" },
  })
  useSceneCommand("selection.selectAll", handlers.handleSelectAll, {
    metadata: { title: "全選択", category: "選択" },
  })
}
