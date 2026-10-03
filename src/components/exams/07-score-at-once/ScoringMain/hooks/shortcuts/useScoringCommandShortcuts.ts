import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

import type { ScoringShortcutHandlers } from "../useScoringShortcuts"
import { KEYBOARD_ONLY_CONDITION } from "./scoringShortcutConditions"

/** 選択・採点・フィルタのショートカット */
export function useScoringCommandShortcuts({
  handleScore,
  handleToggleFilter,
  handleSelectAll,
}: ScoringShortcutHandlers): void {
  // ========================================
  // 選択コマンド
  // ========================================
  useSceneCommand("selection.selectAll", handleSelectAll, {
    condition: `gradingMode == 'grid' && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "全選択",
      category: "選択",
      description: "表示中の答案をすべて選択します",
    },
  })

  // ========================================
  // 採点コマンド（サイドパネル非表示でも有効）
  // ========================================
  useSceneCommand("scoring.unscored", () => handleScore("unscored"), {
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "未採点として採点",
      category: "採点",
      description: "選択中の答案を未採点にします",
    },
  })

  useSceneCommand("scoring.correct", () => handleScore("correct"), {
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "正答として採点",
      category: "採点",
      description: "選択中の答案を正答として採点します",
    },
  })

  useSceneCommand("scoring.partial", () => handleScore("partial"), {
    scene: "scoring",
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "部分点として採点",
      category: "採点",
      description: "選択中の答案を部分点として採点します",
    },
  })

  useSceneCommand("scoring.pending", () => handleScore("pending"), {
    scene: "scoring",
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "保留として採点",
      category: "採点",
      description: "選択中の答案を保留として採点します",
    },
  })

  useSceneCommand("scoring.incorrect", () => handleScore("incorrect"), {
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "誤答として採点",
      category: "採点",
      description: "選択中の答案を誤答として採点します",
    },
  })

  useSceneCommand("scoring.noAnswer", () => handleScore("no_answer"), {
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "無答として採点",
      category: "採点",
      description: "選択中の答案を無答として採点します",
    },
  })

  useSceneCommand("scoring.doubleMark", () => handleScore("double_mark"), {
    condition: `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
    metadata: {
      title: "Wマークとして採点",
      category: "採点",
      description: "選択中の答案をダブルマークとして採点します",
    },
  })

  // ========================================
  // フィルタトグルコマンド（サイドパネル非表示でも有効、グリッドモードのみ）
  // ========================================
  useSceneCommand(
    "filter.toggleUnscored",
    () => handleToggleFilter("unscored"),
    {
      condition: "gradingMode == 'grid'",
      metadata: {
        title: "未採点フィルタトグル",
        category: "フィルタ",
        description: "未採点の答案の表示を切り替えます",
      },
    }
  )

  useSceneCommand("filter.toggleCorrect", () => handleToggleFilter("correct"), {
    condition: "gradingMode == 'grid'",
    metadata: {
      title: "正答フィルタトグル",
      category: "フィルタ",
    },
  })

  useSceneCommand("filter.togglePartial", () => handleToggleFilter("partial"), {
    condition: "gradingMode == 'grid'",
    metadata: {
      title: "部分点フィルタトグル",
      category: "フィルタ",
    },
  })

  useSceneCommand("filter.togglePending", () => handleToggleFilter("pending"), {
    condition: "gradingMode == 'grid'",
    metadata: {
      title: "保留フィルタトグル",
      category: "フィルタ",
    },
  })

  useSceneCommand(
    "filter.toggleIncorrect",
    () => handleToggleFilter("incorrect"),
    {
      condition: "gradingMode == 'grid'",
      metadata: {
        title: "誤答フィルタトグル",
        category: "フィルタ",
      },
    }
  )

  useSceneCommand(
    "filter.toggleNoAnswer",
    () => handleToggleFilter("no_answer"),
    {
      condition: "gradingMode == 'grid'",
      metadata: {
        title: "無答フィルタトグル",
        category: "フィルタ",
      },
    }
  )

  useSceneCommand(
    "filter.toggleDoubleMark",
    () => handleToggleFilter("double_mark"),
    {
      condition: "gradingMode == 'grid'",
      metadata: {
        title: "Wマークフィルタトグル",
        category: "フィルタ",
      },
    }
  )
}
