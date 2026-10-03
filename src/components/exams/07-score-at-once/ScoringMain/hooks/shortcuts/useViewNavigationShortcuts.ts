import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

import type { ScoringShortcutHandlers } from "../useScoringShortcuts"
import { KEYBOARD_ONLY_CONDITION } from "./scoringShortcutConditions"

/** 表示・設問移動・答案移動・ズームのショートカット */
export function useViewNavigationShortcuts({
  handleToggleStudentNames,
  handleRefreshFilter,
  handleNextQuestion,
  handlePrevQuestion,
  handleGridNavigation,
  handleIndividualNavigation,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  handleToggleViewMode,
  handleToggleMasterAnswer,
}: ScoringShortcutHandlers): void {
  // ========================================
  // 表示関連ショートカット
  // ========================================
  useSceneCommand("view.toggleViewMode", handleToggleViewMode, {
    metadata: {
      title: "表示モード切り替え",
      category: "表示",
      description: "一覧表示と個別表示を切り替えます",
    },
  })

  useSceneCommand(
    "view.toggleMasterAnswer",
    () => handleToggleMasterAnswer?.(),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "模範解答表示切り替え",
        category: "表示",
        description: "模範解答の表示を切り替えます",
      },
    }
  )

  useSceneCommand("view.toggleStudentNames", handleToggleStudentNames, {
    metadata: {
      title: "生徒名表示切り替え",
      category: "表示",
      description: "グリッド内の生徒名表示を切り替えます",
    },
  })

  useSceneCommand("filter.refresh", handleRefreshFilter, {
    metadata: {
      title: "フィルタ更新",
      category: "フィルタ",
      description: "フィルタ条件を適用して表示を更新します",
    },
  })

  // ========================================
  // ナビゲーションショートカット
  // ========================================
  useSceneCommand("navigation.nextQuestionArrow", handleNextQuestion, {
    metadata: {
      title: "次の問題へ（→）",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.prevQuestionArrow", handlePrevQuestion, {
    metadata: {
      title: "前の問題へ（←）",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.nextQuestion", handleNextQuestion, {
    metadata: {
      title: "次の問題へ（Shift+D）",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.prevQuestion", handlePrevQuestion, {
    metadata: {
      title: "前の問題へ（Shift+A）",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.moveUp", () => handleGridNavigation("w"), {
    condition: `gradingMode == 'grid' && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "上に移動",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.moveDown", () => handleGridNavigation("s"), {
    condition: `gradingMode == 'grid' && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "下に移動",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.moveLeft", () => handleGridNavigation("a"), {
    condition: `gradingMode == 'grid' && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "左に移動",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.moveRight", () => handleGridNavigation("d"), {
    condition: `gradingMode == 'grid' && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "右に移動",
      category: "ナビゲーション",
    },
  })

  // ========================================
  // 個別モード用ナビゲーション（レイアウト方向対応）
  // ========================================
  useSceneCommand("navigation.moveUp", () => handleIndividualNavigation("w"), {
    condition: "gradingMode == 'individual'",
    metadata: {
      title: "前の生徒（上）",
      category: "ナビゲーション",
      description: "レイアウト方向に応じて前の生徒に移動します",
    },
  })

  useSceneCommand(
    "navigation.moveDown",
    () => handleIndividualNavigation("s"),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "次の生徒（下）",
        category: "ナビゲーション",
        description: "レイアウト方向に応じて次の生徒に移動します",
      },
    }
  )

  useSceneCommand(
    "navigation.moveLeft",
    () => handleIndividualNavigation("a"),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "前の生徒（左）",
        category: "ナビゲーション",
        description: "レイアウト方向に応じて前の生徒に移動します",
      },
    }
  )

  useSceneCommand(
    "navigation.moveRight",
    () => handleIndividualNavigation("d"),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "次の生徒（右）",
        category: "ナビゲーション",
        description: "レイアウト方向に応じて次の生徒に移動します",
      },
    }
  )

  // 矢印キーによる個別モードの生徒移動
  useSceneCommand(
    "navigation.nextStudentArrow",
    () => handleIndividualNavigation("ArrowDown"),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "次の生徒（↓）",
        category: "ナビゲーション",
      },
    }
  )

  useSceneCommand(
    "navigation.prevStudentArrow",
    () => handleIndividualNavigation("ArrowUp"),
    {
      condition: "gradingMode == 'individual'",
      metadata: {
        title: "前の生徒（↑）",
        category: "ナビゲーション",
      },
    }
  )

  useSceneCommand("navigation.zoomIn", handleZoomIn, {
    metadata: {
      title: "ズームイン",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.zoomOut", handleZoomOut, {
    metadata: {
      title: "ズームアウト",
      category: "ナビゲーション",
    },
  })

  useSceneCommand("navigation.resetZoom", handleResetZoom, {
    metadata: {
      title: "ズームリセット",
      category: "ナビゲーション",
    },
  })
}
