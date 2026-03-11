/**
 * 採点画面のキーボードショートカット定義フック
 *
 * ScoringMainViewから抽出されたショートカット登録ロジック
 * useCommandを使用してショートカットを登録する
 */

import { useCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import type { ScoringStatus } from "@/components/exams/07-score-at-once/types"

/**
 * ショートカットハンドラーの型定義
 */
interface ScoringShortcutHandlers {
  /** 生徒名表示切り替え */
  handleToggleStudentNames: () => void
  /** フィルタ更新 */
  handleRefreshFilter: () => void
  /** 次の設問 */
  handleNextQuestion: () => void
  /** 前の設問 */
  handlePrevQuestion: () => void
  /** グリッドナビゲーション */
  handleGridNavigation: (key: string) => void
  /** 個別モードナビゲーション（レイアウト方向に応じた次/前の生徒移動） */
  handleIndividualNavigation: (key: string) => void
  /** ズームイン */
  handleZoomIn: () => void
  /** ズームアウト */
  handleZoomOut: () => void
  /** ズームリセット */
  handleResetZoom: () => void
  /** 部分点入力開始 */
  handlePartialScoreInput: (key: string) => void
  /** 部分点確定（部分点として） */
  handlePartialScoreConfirmPartial: () => void
  /** 部分点確定（保留として） */
  handlePartialScoreConfirmPending: () => void
  /** 部分点入力キャンセル */
  handlePartialScoreCancel: () => void
  /** 部分点入力バックスペース */
  handlePartialScoreBackspace: () => void
  /** 採点実行（サイドパネル非表示でも有効にするため） */
  handleScore: (status: ScoringStatus) => void
  /** フィルタトグル（サイドパネル非表示でも有効にするため） */
  handleToggleFilter: (key: string) => void
}

/**
 * 採点画面のショートカットを登録するフック
 *
 * @param handlers - 各ショートカットに対応するハンドラー関数
 */
export function useScoringShortcuts(handlers: ScoringShortcutHandlers): void {
  const {
    handleToggleStudentNames,
    handleRefreshFilter,
    handleNextQuestion,
    handlePrevQuestion,
    handleGridNavigation,
    handleIndividualNavigation,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handlePartialScoreInput,
    handlePartialScoreConfirmPartial,
    handlePartialScoreConfirmPending,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handleScore,
    handleToggleFilter,
  } = handlers

  // ========================================
  // 採点コマンド（サイドパネル非表示でも有効）
  // ========================================
  useCommand("scoring.unscored", () => handleScore("unscored"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "未採点として採点",
      category: "採点",
      description: "選択中の答案を未採点にします",
    },
  })

  useCommand("scoring.correct", () => handleScore("correct"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "正答として採点",
      category: "採点",
      description: "選択中の答案を正答として採点します",
    },
  })

  useCommand("scoring.partial", () => handleScore("partial"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "部分点として採点",
      category: "採点",
      description: "選択中の答案を部分点として採点します",
    },
  })

  useCommand("scoring.pending", () => handleScore("pending"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "保留として採点",
      category: "採点",
      description: "選択中の答案を保留として採点します",
    },
  })

  useCommand("scoring.incorrect", () => handleScore("incorrect"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "誤答として採点",
      category: "採点",
      description: "選択中の答案を誤答として採点します",
    },
  })

  useCommand("scoring.noAnswer", () => handleScore("no_answer"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "無答として採点",
      category: "採点",
      description: "選択中の答案を無答として採点します",
    },
  })

  // ========================================
  // フィルタトグルコマンド（サイドパネル非表示でも有効、グリッドモードのみ）
  // ========================================
  useCommand("filter.toggleUnscored", () => handleToggleFilter("unscored"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "未採点フィルタトグル",
      category: "フィルタ",
      description: "未採点の答案の表示を切り替えます",
    },
  })

  useCommand("filter.toggleCorrect", () => handleToggleFilter("correct"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "正答フィルタトグル",
      category: "フィルタ",
    },
  })

  useCommand("filter.togglePartial", () => handleToggleFilter("partial"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "部分点フィルタトグル",
      category: "フィルタ",
    },
  })

  useCommand("filter.togglePending", () => handleToggleFilter("pending"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "保留フィルタトグル",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggleIncorrect", () => handleToggleFilter("incorrect"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "誤答フィルタトグル",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggleNoAnswer", () => handleToggleFilter("no_answer"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "無答フィルタトグル",
      category: "フィルタ",
    },
  })

  // ========================================
  // 表示関連ショートカット
  // ========================================
  useCommand("view.toggleStudentNames", handleToggleStudentNames, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "生徒名表示切り替え",
      category: "表示",
      description: "グリッド内の生徒名表示を切り替えます",
    },
  })

  useCommand("filter.refresh", handleRefreshFilter, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "フィルタ更新",
      category: "フィルタ",
      description: "フィルタ条件を適用して表示を更新します",
    },
  })

  // ========================================
  // ナビゲーションショートカット
  // ========================================
  useCommand("navigation.nextQuestionArrow", handleNextQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "次の問題へ（→）",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.prevQuestionArrow", handlePrevQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "前の問題へ（←）",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.nextQuestion", handleNextQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "次の問題へ（Shift+D）",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.prevQuestion", handlePrevQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "前の問題へ（Shift+A）",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveUp", () => handleGridNavigation("w"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "上に移動",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveDown", () => handleGridNavigation("s"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "下に移動",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveLeft", () => handleGridNavigation("a"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "左に移動",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveRight", () => handleGridNavigation("d"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "右に移動",
      category: "ナビゲーション",
    },
  })

  // ========================================
  // 個別モード用ナビゲーション（レイアウト方向対応）
  // ========================================
  useCommand("navigation.moveUp", () => handleIndividualNavigation("w"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
    metadata: {
      title: "前の生徒（上）",
      category: "ナビゲーション",
      description: "レイアウト方向に応じて前の生徒に移動します",
    },
  })

  useCommand("navigation.moveDown", () => handleIndividualNavigation("s"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
    metadata: {
      title: "次の生徒（下）",
      category: "ナビゲーション",
      description: "レイアウト方向に応じて次の生徒に移動します",
    },
  })

  useCommand("navigation.moveLeft", () => handleIndividualNavigation("a"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
    metadata: {
      title: "前の生徒（左）",
      category: "ナビゲーション",
      description: "レイアウト方向に応じて前の生徒に移動します",
    },
  })

  useCommand("navigation.moveRight", () => handleIndividualNavigation("d"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
    metadata: {
      title: "次の生徒（右）",
      category: "ナビゲーション",
      description: "レイアウト方向に応じて次の生徒に移動します",
    },
  })

  // 矢印キーによる個別モードの生徒移動
  useCommand(
    "navigation.nextStudentArrow",
    () => handleIndividualNavigation("ArrowDown"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'individual'",
      metadata: {
        title: "次の生徒（↓）",
        category: "ナビゲーション",
      },
    }
  )

  useCommand(
    "navigation.prevStudentArrow",
    () => handleIndividualNavigation("ArrowUp"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'individual'",
      metadata: {
        title: "前の生徒（↑）",
        category: "ナビゲーション",
      },
    }
  )

  useCommand("navigation.zoomIn", handleZoomIn, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "ズームイン",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.zoomOut", handleZoomOut, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "ズームアウト",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.resetZoom", handleResetZoom, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "ズームリセット",
      category: "ナビゲーション",
    },
  })

  // ========================================
  // モーダル内ショートカット（採点キーと共通）
  // ========================================
  // 部分点/保留キーはモーダル内でも同じキーで確定動作
  useCommand("scoring.partial", handlePartialScoreConfirmPartial, {
    when: "partialScoreModalOpen",
    metadata: {
      title: "部分点として確定",
      category: "モーダル",
      description: "入力した部分点を確定します",
    },
  })

  useCommand("scoring.pending", handlePartialScoreConfirmPending, {
    when: "partialScoreModalOpen",
    metadata: {
      title: "保留として確定",
      category: "モーダル",
      description: "保留として確定します",
    },
  })

  useCommand("modal.cancel", handlePartialScoreCancel, {
    when: "modalOpen",
    metadata: {
      title: "モーダルを閉じる",
      category: "モーダル",
    },
  })

  useCommand("modal.backspace", handlePartialScoreBackspace, {
    when: "partialScoreModalOpen",
    metadata: {
      title: "文字削除",
      category: "モーダル",
    },
  })

  // モーダル内数字入力
  useCommand("modal.input0", () => handlePartialScoreInput("0"), {
    when: "partialScoreModalOpen",
    metadata: { title: "0を入力", category: "モーダル" },
  })

  useCommand("modal.input1", () => handlePartialScoreInput("1"), {
    when: "partialScoreModalOpen",
    metadata: { title: "1を入力", category: "モーダル" },
  })

  useCommand("modal.input2", () => handlePartialScoreInput("2"), {
    when: "partialScoreModalOpen",
    metadata: { title: "2を入力", category: "モーダル" },
  })

  useCommand("modal.input3", () => handlePartialScoreInput("3"), {
    when: "partialScoreModalOpen",
    metadata: { title: "3を入力", category: "モーダル" },
  })

  useCommand("modal.input4", () => handlePartialScoreInput("4"), {
    when: "partialScoreModalOpen",
    metadata: { title: "4を入力", category: "モーダル" },
  })

  useCommand("modal.input5", () => handlePartialScoreInput("5"), {
    when: "partialScoreModalOpen",
    metadata: { title: "5を入力", category: "モーダル" },
  })

  useCommand("modal.input6", () => handlePartialScoreInput("6"), {
    when: "partialScoreModalOpen",
    metadata: { title: "6を入力", category: "モーダル" },
  })

  useCommand("modal.input7", () => handlePartialScoreInput("7"), {
    when: "partialScoreModalOpen",
    metadata: { title: "7を入力", category: "モーダル" },
  })

  useCommand("modal.input8", () => handlePartialScoreInput("8"), {
    when: "partialScoreModalOpen",
    metadata: { title: "8を入力", category: "モーダル" },
  })

  useCommand("modal.input9", () => handlePartialScoreInput("9"), {
    when: "partialScoreModalOpen",
    metadata: { title: "9を入力", category: "モーダル" },
  })

  useCommand("modal.inputDot", () => handlePartialScoreInput("."), {
    when: "partialScoreModalOpen",
    metadata: { title: "小数点を入力", category: "モーダル" },
  })

  // ========================================
  // 部分点入力ショートカット（グリッド・個別共通）
  // ========================================
  useCommand("scoring.openPartialWith0", () => handlePartialScoreInput("0"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "0キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith1", () => handlePartialScoreInput("1"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "1キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith2", () => handlePartialScoreInput("2"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "2キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith3", () => handlePartialScoreInput("3"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "3キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith4", () => handlePartialScoreInput("4"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "4キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith5", () => handlePartialScoreInput("5"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "5キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith6", () => handlePartialScoreInput("6"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "6キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith7", () => handlePartialScoreInput("7"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "7キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith8", () => handlePartialScoreInput("8"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "8キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith9", () => handlePartialScoreInput("9"), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: "9キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWithDot", () => handlePartialScoreInput("."), {
    when: "!inputFocus && !modalOpen && !textEditorActive && hasSelectedAnswers",
    metadata: { title: ".キーで部分点入力", category: "採点" },
  })
}
