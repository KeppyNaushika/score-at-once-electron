import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

import type { ScoringShortcutHandlers } from "../useScoringShortcuts"

/**
 * 部分点の入力欄の中と、数字キーで部分点の入力を始めるショートカット。
 * 「8. 採点確定」も同じ入力欄で確定の点を入れるので、要る口だけを受け取る
 */
export function usePartialScoreShortcuts({
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
>): void {
  // ========================================
  // モーダル内ショートカット（採点キーと共通）
  // ========================================
  // 部分点/保留キーはモーダル内でも同じキーで確定動作
  useSceneCommand("scoring.partial", handlePartialScoreConfirmPartial, {
    scene: "partialInput",
    metadata: {
      title: "部分点として確定",
      category: "モーダル",
      description: "入力した部分点を確定します",
    },
  })

  useSceneCommand("scoring.pending", handlePartialScoreConfirmPending, {
    scene: "partialInput",
    metadata: {
      title: "保留として確定",
      category: "モーダル",
      description: "保留として確定します",
    },
  })

  useSceneCommand("modal.cancel", handlePartialScoreCancel, {
    metadata: {
      title: "モーダルを閉じる",
      category: "モーダル",
    },
  })

  useSceneCommand("modal.backspace", handlePartialScoreBackspace, {
    metadata: {
      title: "文字削除",
      category: "モーダル",
    },
  })

  // モーダル内数字入力
  useSceneCommand("modal.input0", () => handlePartialScoreInput("0"), {
    metadata: { title: "0を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input1", () => handlePartialScoreInput("1"), {
    metadata: { title: "1を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input2", () => handlePartialScoreInput("2"), {
    metadata: { title: "2を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input3", () => handlePartialScoreInput("3"), {
    metadata: { title: "3を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input4", () => handlePartialScoreInput("4"), {
    metadata: { title: "4を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input5", () => handlePartialScoreInput("5"), {
    metadata: { title: "5を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input6", () => handlePartialScoreInput("6"), {
    metadata: { title: "6を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input7", () => handlePartialScoreInput("7"), {
    metadata: { title: "7を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input8", () => handlePartialScoreInput("8"), {
    metadata: { title: "8を入力", category: "モーダル" },
  })

  useSceneCommand("modal.input9", () => handlePartialScoreInput("9"), {
    metadata: { title: "9を入力", category: "モーダル" },
  })

  useSceneCommand("modal.inputDot", () => handlePartialScoreInput("."), {
    metadata: { title: "小数点を入力", category: "モーダル" },
  })

  // ========================================
  // 部分点入力ショートカット（グリッド・個別共通）
  // ========================================
  useSceneCommand(
    "scoring.openPartialWith0",
    () => handlePartialScoreInput("0"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "0キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith1",
    () => handlePartialScoreInput("1"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "1キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith2",
    () => handlePartialScoreInput("2"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "2キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith3",
    () => handlePartialScoreInput("3"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "3キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith4",
    () => handlePartialScoreInput("4"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "4キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith5",
    () => handlePartialScoreInput("5"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "5キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith6",
    () => handlePartialScoreInput("6"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "6キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith7",
    () => handlePartialScoreInput("7"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "7キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith8",
    () => handlePartialScoreInput("8"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "8キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWith9",
    () => handlePartialScoreInput("9"),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "9キーで部分点入力", category: "採点" },
    }
  )

  useSceneCommand(
    "scoring.openPartialWithDot",
    () => handlePartialScoreInput("."),
    {
      condition: "hasSelectedAnswers",
      metadata: { title: ".キーで部分点入力", category: "採点" },
    }
  )
}
