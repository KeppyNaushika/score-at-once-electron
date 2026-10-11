import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { FilterSource } from "../utils/aiGridFilter"

/** AI採点モードでだけ効かせる条件 */
export const AI_GRADING_MODE_CONDITION = "gradingMode == 'ai'"

interface UseAiGridShortcutsOptions {
  /** 一覧の移動（WASD。一覧表示と同じ向きの読み替えをする） */
  onGridNavigation: (key: "w" | "a" | "s" | "d") => void
  onSelectAll: () => void
  /** 絞り込みの切り替え（自分の採点は一覧表示と同じキー、AI の採点は Opt+Shift） */
  onToggleFilter: (source: FilterSource, status: ScoringStatus) => void
}

/**
 * AI採点モードの一覧の操作。**一覧表示と同じキー**で同じことが起きる
 * （WASD で移動、全選択、絞り込みの切り替え）。
 * 設問の移動（← → と Shift+A/D）と表示件数（= - 0）は採点画面のものがそのまま効く
 */
export function useAiGridShortcuts({
  onGridNavigation,
  onSelectAll,
  onToggleFilter,
}: UseAiGridShortcutsOptions): void {
  const options = (title: string, category = "AI採点") => ({
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title, category },
  })

  useSceneCommand(
    "navigation.moveUp",
    () => onGridNavigation("w"),
    options("上の答案へ")
  )
  useSceneCommand(
    "navigation.moveDown",
    () => onGridNavigation("s"),
    options("下の答案へ")
  )
  useSceneCommand(
    "navigation.moveLeft",
    () => onGridNavigation("a"),
    options("左の答案へ")
  )
  useSceneCommand(
    "navigation.moveRight",
    () => onGridNavigation("d"),
    options("右の答案へ")
  )
  useSceneCommand(
    "navigation.prevStudentArrow",
    () => onGridNavigation("w"),
    options("前の答案（↑）")
  )
  useSceneCommand(
    "navigation.nextStudentArrow",
    () => onGridNavigation("s"),
    options("次の答案（↓）")
  )
  useSceneCommand("selection.selectAll", onSelectAll, options("全選択"))

  useSceneCommand(
    "filter.toggleUnscored",
    () => onToggleFilter("mine", "unscored"),
    options("自分の採点: 未採点の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterUnscored",
    () => onToggleFilter("ai", "unscored"),
    options("AI の採点: 未採点の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "filter.toggleCorrect",
    () => onToggleFilter("mine", "correct"),
    options("自分の採点: 正答の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterCorrect",
    () => onToggleFilter("ai", "correct"),
    options("AI の採点: 正答の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "filter.togglePartial",
    () => onToggleFilter("mine", "partial"),
    options("自分の採点: 部分点の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterPartial",
    () => onToggleFilter("ai", "partial"),
    options("AI の採点: 部分点の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "filter.togglePending",
    () => onToggleFilter("mine", "pending"),
    options("自分の採点: 保留の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterPending",
    () => onToggleFilter("ai", "pending"),
    options("AI の採点: 保留の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "filter.toggleIncorrect",
    () => onToggleFilter("mine", "incorrect"),
    options("自分の採点: 誤答の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterIncorrect",
    () => onToggleFilter("ai", "incorrect"),
    options("AI の採点: 誤答の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "filter.toggleNoAnswer",
    () => onToggleFilter("mine", "no_answer"),
    options("自分の採点: 無答の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterNoAnswer",
    () => onToggleFilter("ai", "no_answer"),
    options("AI の採点: 無答の表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "filter.toggleDoubleMark",
    () => onToggleFilter("mine", "double_mark"),
    options("自分の採点: Wマークの表示を切り替え", "フィルタ")
  )
  useSceneCommand(
    "aiGrading.filterDoubleMark",
    () => onToggleFilter("ai", "double_mark"),
    options("AI の採点: Wマークの表示を切り替え", "フィルタ")
  )
}
