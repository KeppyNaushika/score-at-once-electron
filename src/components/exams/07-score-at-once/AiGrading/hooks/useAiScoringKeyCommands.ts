/**
 * AI採点モードの採点キーの登録。
 *
 * 採点反映のタブでは採点中の場面に（`useAiOwnScoring`。その場で確定）、問いかけの
 * 「1件ずつ自分で採点する」では選択の場面に（`useQuestioningManualKeys`。下書き）同じキーを登録する
 * （docs/vlm-grading-design.md §3-5・§11-4）。問いかけの選択肢は ↑↓ で選ぶので、選択の場面でも
 * 数字は部分点の入力を始める
 */

import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 採点状態ごとの採点キー（q e f j o p u）を、1つの場面に登録する */
export function useStatusScoringCommands(
  scoreSelected: (status: ScoringStatus) => void,
  scene: "scoring" | "choice",
  options: (title: string) => {
    condition: string
    metadata: { title: string; category: string }
  }
) {
  useSceneCommand("scoring.unscored", () => scoreSelected("unscored"), {
    scene,
    ...options("選んだ答案を自分の採点で未採点に"),
  })
  useSceneCommand("scoring.correct", () => scoreSelected("correct"), {
    scene,
    ...options("選んだ答案を自分の採点で正答に"),
  })
  useSceneCommand("scoring.partial", () => scoreSelected("partial"), {
    scene,
    ...options("選んだ答案を自分の採点で部分点に"),
  })
  useSceneCommand("scoring.pending", () => scoreSelected("pending"), {
    scene,
    ...options("選んだ答案を自分の採点で保留に"),
  })
  useSceneCommand("scoring.incorrect", () => scoreSelected("incorrect"), {
    scene,
    ...options("選んだ答案を自分の採点で誤答に"),
  })
  useSceneCommand("scoring.noAnswer", () => scoreSelected("no_answer"), {
    scene,
    ...options("選んだ答案を自分の採点で無答に"),
  })
  useSceneCommand("scoring.doubleMark", () => scoreSelected("double_mark"), {
    scene,
    ...options("選んだ答案を自分の採点で Wマークに"),
  })
}

/** 選択の場面の中で、数字・小数点で部分点の入力を始める（AI の問いかけ） */
export function useChoiceScenePartialStartCommands(
  handlePartialScoreInput: (key: string) => void,
  condition: string
) {
  const options = {
    scene: "choice" as const,
    condition,
    metadata: { title: "数字キーで部分点入力", category: "AI採点" },
  }
  useSceneCommand(
    "scoring.openPartialWith0",
    () => handlePartialScoreInput("0"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith1",
    () => handlePartialScoreInput("1"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith2",
    () => handlePartialScoreInput("2"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith3",
    () => handlePartialScoreInput("3"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith4",
    () => handlePartialScoreInput("4"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith5",
    () => handlePartialScoreInput("5"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith6",
    () => handlePartialScoreInput("6"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith7",
    () => handlePartialScoreInput("7"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith8",
    () => handlePartialScoreInput("8"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWith9",
    () => handlePartialScoreInput("9"),
    options
  )
  useSceneCommand(
    "scoring.openPartialWithDot",
    () => handlePartialScoreInput("."),
    options
  )
}
