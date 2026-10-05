import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

import type { ScoringShortcutHandlers } from "../useScoringShortcuts"

/** 部分点のキーを効かせる条件（場面の土台に `&&` でつなぐ） */
interface PartialScoreShortcutConditions {
  /** 数字キーで入力欄を開く条件（既定は答案を選んでいること） */
  openCondition?: string
  /**
   * 入力欄の中のキーに加える条件（既定は無し）。
   *
   * 07 の一覧表示・個別表示の登録はいつも載っているので、同じ画面の別の入力欄
   * （AI採点モードの「自分で採点」）は条件を足して、より具体的な登録として先に効かせる
   */
  inputCondition?: string
}

/**
 * 部分点の入力欄の中と、数字キーで部分点の入力を始めるショートカット。
 * 「8. 採点確定」と、07 の AI採点モードの「自分で採点」も同じ入力欄で点を入れるので、
 * 要る口だけを受け取る
 */
export function usePartialScoreShortcuts(
  {
    handlePartialScoreInput,
    handlePartialScoreConfirmPartial,
    handlePartialScoreConfirmPending,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
  }: Pick<
    ScoringShortcutHandlers,
    | "handlePartialScoreInput"
    | "handlePartialScoreConfirmPartial"
    | "handlePartialScoreConfirmPending"
    | "handlePartialScoreCancel"
    | "handlePartialScoreBackspace"
  >,
  {
    openCondition = "hasSelectedAnswers",
    inputCondition,
  }: PartialScoreShortcutConditions = {}
): void {
  // ========================================
  // モーダル内ショートカット（採点キーと共通）
  // ========================================
  // 部分点/保留キーはモーダル内でも同じキーで確定動作
  useSceneCommand("scoring.partial", handlePartialScoreConfirmPartial, {
    scene: "partialInput",
    condition: inputCondition,
    metadata: {
      title: "部分点として確定",
      category: "モーダル",
      description: "入力した部分点を確定します",
    },
  })

  useSceneCommand("scoring.pending", handlePartialScoreConfirmPending, {
    scene: "partialInput",
    condition: inputCondition,
    metadata: {
      title: "保留として確定",
      category: "モーダル",
      description: "保留として確定します",
    },
  })

  useSceneCommand("modal.cancel", handlePartialScoreCancel, {
    condition: inputCondition,
    metadata: {
      title: "モーダルを閉じる",
      category: "モーダル",
    },
  })

  useSceneCommand("modal.backspace", handlePartialScoreBackspace, {
    condition: inputCondition,
    metadata: {
      title: "文字削除",
      category: "モーダル",
    },
  })

  // モーダル内数字入力
  useSceneCommand("modal.input0", () => handlePartialScoreInput("0"), {
    condition: inputCondition,
    metadata: { title: "0を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input1", () => handlePartialScoreInput("1"), {
    condition: inputCondition,
    metadata: { title: "1を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input2", () => handlePartialScoreInput("2"), {
    condition: inputCondition,
    metadata: { title: "2を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input3", () => handlePartialScoreInput("3"), {
    condition: inputCondition,
    metadata: { title: "3を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input4", () => handlePartialScoreInput("4"), {
    condition: inputCondition,
    metadata: { title: "4を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input5", () => handlePartialScoreInput("5"), {
    condition: inputCondition,
    metadata: { title: "5を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input6", () => handlePartialScoreInput("6"), {
    condition: inputCondition,
    metadata: { title: "6を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input7", () => handlePartialScoreInput("7"), {
    condition: inputCondition,
    metadata: { title: "7を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input8", () => handlePartialScoreInput("8"), {
    condition: inputCondition,
    metadata: { title: "8を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input9", () => handlePartialScoreInput("9"), {
    condition: inputCondition,
    metadata: { title: "9を入力", category: "モーダル" },
  })

  useSceneCommand("modal.inputDot", () => handlePartialScoreInput("."), {
    condition: inputCondition,
    metadata: { title: "小数点を入力", category: "モーダル" },
  })

  // ========================================
  // 部分点入力ショートカット（グリッド・個別共通）
  // ========================================
  useSceneCommand(
    "scoring.openPartialWith0",
    () => handlePartialScoreInput("0"),
    {
      condition: openCondition,
      metadata: { title: "0キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith1",
    () => handlePartialScoreInput("1"),
    {
      condition: openCondition,
      metadata: { title: "1キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith2",
    () => handlePartialScoreInput("2"),
    {
      condition: openCondition,
      metadata: { title: "2キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith3",
    () => handlePartialScoreInput("3"),
    {
      condition: openCondition,
      metadata: { title: "3キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith4",
    () => handlePartialScoreInput("4"),
    {
      condition: openCondition,
      metadata: { title: "4キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith5",
    () => handlePartialScoreInput("5"),
    {
      condition: openCondition,
      metadata: { title: "5キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith6",
    () => handlePartialScoreInput("6"),
    {
      condition: openCondition,
      metadata: { title: "6キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith7",
    () => handlePartialScoreInput("7"),
    {
      condition: openCondition,
      metadata: { title: "7キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith8",
    () => handlePartialScoreInput("8"),
    {
      condition: openCondition,
      metadata: { title: "8キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith9",
    () => handlePartialScoreInput("9"),
    {
      condition: openCondition,
      metadata: { title: "9キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWithDot",
    () => handlePartialScoreInput("."),
    {
      condition: openCondition,
      metadata: { title: ".キーで部分点入力", category: "採点" },
    }
  )
}
