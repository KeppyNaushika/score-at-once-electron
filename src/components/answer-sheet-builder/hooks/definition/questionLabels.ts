/**
 * 番号の既定（ラベルのプリセット）から、設問のラベルを決める。
 */

import type {
  AnswerSheetDefinition,
  LabelAssignment,
  LabelCategory,
} from "@/types/answerSheetDefinition.types"

import { parsePresetLabels } from "../../constants"
import { allSubQuestions } from "./definitionLookup"

/** 番号の既定から、次に足す実体のラベルを引く */
export function presetLabel(
  preset: string | undefined,
  index: number,
  fallback: string
): string {
  if (!preset) return fallback
  return parsePresetLabels(preset)[index] ?? fallback
}

/** 番号の既定が無いときの枝問ラベル */
export const DEFAULT_BRANCH_LABELS = [
  "(ア)",
  "(イ)",
  "(ウ)",
  "(エ)",
  "(オ)",
  "(カ)",
  "(キ)",
  "(ク)",
  "(ケ)",
  "(コ)",
]

/**
 * 番号の既定を、いまの木のどの実体へ当てるかを決める。
 *
 * 大問と小問は通し、枝問は小問ごとに1から振り直す（従来の見え方をそのまま保つ）。
 * **計算は renderer に置く**。IPC が運ぶのは結果だけ。
 */
export function labelAssignments(
  definition: AnswerSheetDefinition,
  category: LabelCategory,
  labels: string[]
): LabelAssignment[] {
  if (category === "major") {
    return definition.majorQuestions.map((majorQuestion, index) => ({
      id: majorQuestion.id,
      label: labels[index] ?? majorQuestion.label,
    }))
  }
  if (category === "sub") {
    return definition.majorQuestions.flatMap((majorQuestion) =>
      majorQuestion.subQuestions.map((subQuestion, index) => ({
        id: subQuestion.id,
        label: labels[index] ?? subQuestion.label,
      }))
    )
  }
  return allSubQuestions(definition).flatMap((subQuestion) =>
    subQuestion.branchQuestions.map((branchQuestion, index) => ({
      id: branchQuestion.id,
      label: labels[index] ?? branchQuestion.label,
    }))
  )
}
