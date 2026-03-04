/**
 * レイアウト計算hook
 *
 * AnswerSheetDefinition → ComputedLayout / ComputedMultiPageLayout をuseMemoで計算。
 * レイアウト計算ロジックは layout/ ディレクトリに分割されている。
 */

import { useMemo } from "react"

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type {
  ComputedLayout,
  ComputedMultiPageLayout,
} from "@/types/answerSheetLayout.types"

import { computeLayoutFromDefinition } from "./layout/computeLayout"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

/** 単一ページレイアウト */
export function useAnswerSheetLayout(
  definition: AnswerSheetDefinition
): ComputedLayout {
  return useMemo(() => computeLayoutFromDefinition(definition), [definition])
}

/** 複数ページレイアウト */
export function useMultiPageLayout(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  return useMemo(
    () => computeMultiPageLayoutFromDefinition(definition),
    [definition]
  )
}
