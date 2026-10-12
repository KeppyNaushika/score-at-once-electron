import type { Dispatch, SetStateAction } from "react"
import { useCallback } from "react"

import { useGridZoom } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useGridZoom"
import { useIndividualNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useIndividualNavigation"
import { useScoringScreenBindings } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringScreenBindings"
import type { ScoringShortcutHandlers } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import type {
  GradingMode,
  LayoutDirection,
} from "@/components/exams/07-score-at-once/types"

/** このフックの中で組み立てるショートカット（呼び出し側からは受け取らない） */
type DerivedShortcutName =
  | "handleZoomIn"
  | "handleZoomOut"
  | "handleResetZoom"
  | "handleIndividualNavigation"
  | "handleToggleViewMode"
  | "handlePartialScoreConfirmPartial"
  | "handlePartialScoreConfirmPending"

type UseScoringScreenKeyboardOptions = Omit<
  Parameters<typeof useScoringScreenBindings>[0],
  "shortcuts"
> & {
  itemsPerLine: number[]
  setItemsPerLine: (itemsPerLine: number[]) => void
  layoutDirection: LayoutDirection
  setGradingMode: Dispatch<SetStateAction<GradingMode>>
  handleIndividualNextStudent: () => void
  handleIndividualPrevStudent: () => void
  handlePartialScoreConfirm: (confirmType: "partial" | "pending") => void
  shortcuts: Omit<ScoringShortcutHandlers, DerivedShortcutName>
}

/**
 * 採点画面（07）のキー操作。表示件数の増減・個別表示の前後移動・表示モードの
 * 切り替えをここで組み立て、ほかの口と合わせてキー操作の文脈とショートカットへつなぐ。
 */
export function useScoringScreenKeyboard({
  itemsPerLine,
  setItemsPerLine,
  layoutDirection,
  setGradingMode,
  handleIndividualNextStudent,
  handleIndividualPrevStudent,
  handlePartialScoreConfirm,
  shortcuts,
  ...bindings
}: UseScoringScreenKeyboardOptions) {
  /** 1行あたりの表示件数を増減（ショートカットキー =/-） */
  const { handleZoomIn, handleZoomOut, handleResetZoom } = useGridZoom(
    itemsPerLine,
    setItemsPerLine
  )

  /** 個別モード用ナビゲーション（レイアウト方向に応じて次/前の生徒へ） */
  const handleIndividualNavigation = useIndividualNavigation({
    layoutDirection,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
  })

  /** 表示モード切り替え（グリッド⇔個別） */
  const handleToggleViewMode = useCallback(
    () => setGradingMode((prev) => (prev === "grid" ? "individual" : "grid")),
    [setGradingMode]
  )

  /** キー操作の文脈・ショートカット・担当外の設問からの退避 */
  useScoringScreenBindings({
    ...bindings,
    shortcuts: {
      ...shortcuts,
      handleIndividualNavigation,
      handleZoomIn,
      handleZoomOut,
      handleResetZoom,
      handlePartialScoreConfirmPartial: () =>
        handlePartialScoreConfirm("partial"),
      handlePartialScoreConfirmPending: () =>
        handlePartialScoreConfirm("pending"),
      handleToggleViewMode,
    },
  })
}
