/**
 * 採点操作モード管理フック
 * キーボード/マウスモードの切替と、利用者の設定への永続化を提供
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useState } from "react"

import type {
  MouseBrushAction,
  ScoringOperationMode,
} from "@/components/exams/07-score-at-once/types"
import { parsePreference } from "@/lib/userPreferences"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"

interface UseScoringModeReturn {
  /** 現在の操作モード */
  scoringOperationMode: ScoringOperationMode
  /** モード選択モーダルを表示するか */
  showModeSelectionModal: boolean
  /** モーダルからモードを選択 */
  selectMode: (mode: ScoringOperationMode, remember: boolean) => void
  /** モードを直接設定（トグル用） */
  setScoringOperationMode: (mode: ScoringOperationMode) => void
  /** モーダルを閉じる */
  closeModeSelectionModal: () => void
  /** モーダルを開く */
  /** 現在のマウスブラシ */
  mouseBrush: MouseBrushAction
  /** マウスブラシを設定 */
  setMouseBrush: (brush: MouseBrushAction) => void
}

/**
 * 保存先は利用者の設定（`UserPreference`）。**端末ではなく利用者に付く**ので、
 * 別の端末で入り直しても憶えたモードで始まる（段階55 で `localStorage` から寄せた）。
 *
 * **「憶えない」は既定へ戻す**。`scoringOperationModeRemembered` が false の間は
 * 憶えたモードを見ないので、採点画面へ入るたびに選択が出る（`localStorage` の頃に
 * 鍵を消していたのと同じ意味）。
 *
 * 取得は非同期なので、**読み終わるまで選択は出さない**。出してしまうと、憶えている
 * 人にも一瞬モーダルが見えて勝手に閉じる。
 */
export function useScoringMode(userId: string): UseScoringModeReturn {
  const rememberedQuery = useQuery(
    userPreferenceQuery(userId, "scoringOperationModeRemembered")
  )
  const storedModeQuery = useQuery(
    userPreferenceQuery(userId, "scoringOperationMode")
  )
  const setPreference = useMutation(setUserPreferenceMutation(userId))

  // この画面を開いている間だけのモード。憶えない選択も、憶えた値の上書きもここに乗る
  const [chosenMode, setChosenMode] = useState<ScoringOperationMode | null>(
    null
  )
  const [modeSelectionClosed, setModeSelectionClosed] = useState(false)
  const [mouseBrush, setMouseBrush] = useState<MouseBrushAction>("correct")

  const remembered = parsePreference(
    "scoringOperationModeRemembered",
    rememberedQuery.data ?? null
  )
  const storedMode = parsePreference(
    "scoringOperationMode",
    storedModeQuery.data ?? null
  )
  // 読めなかったとき（取得が失敗）も「憶えていない」として選択を出す。**待ち続けない**
  const settled = !rememberedQuery.isPending && !storedModeQuery.isPending

  const scoringOperationMode =
    chosenMode ?? (remembered ? storedMode : "keyboard")
  const showModeSelectionModal =
    settled && !remembered && chosenMode === null && !modeSelectionClosed

  const selectMode = useCallback(
    (mode: ScoringOperationMode, remember: boolean) => {
      setChosenMode(mode)
      setModeSelectionClosed(true)
      // 憶えるなら値と旗の両方を、憶えないなら両方を既定へ。**塊では書かない**
      // （キーごとに1行なので、続けて書いても先の1つが消えない）
      setPreference.mutate({
        key: "scoringOperationMode",
        value: remember ? mode : "keyboard",
      })
      setPreference.mutate({
        key: "scoringOperationModeRemembered",
        value: remember,
      })
    },
    [setPreference]
  )

  const setScoringOperationMode = useCallback(
    (mode: ScoringOperationMode) => {
      setChosenMode(mode)
      // 憶えている人の切り替えだけが残る（憶えていない人は今回の採点の間だけ）
      if (remembered) {
        setPreference.mutate({ key: "scoringOperationMode", value: mode })
      }
    },
    [remembered, setPreference]
  )

  const closeModeSelectionModal = useCallback(() => {
    setModeSelectionClosed(true)
  }, [])

  return {
    scoringOperationMode,
    showModeSelectionModal,
    selectMode,
    setScoringOperationMode,
    closeModeSelectionModal,
    mouseBrush,
    setMouseBrush,
  }
}
