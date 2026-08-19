"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import type { AnswerSheetEditAction } from "@/types/answerSheetDefinition.types"

/**
 * 編集を書き込みへ渡す関所。**ジェスチャの途中は待たせる。**
 *
 * つまみを動かす・プレビューをドラッグする、といった操作は指を離したときに1つの意図に
 * なる（docs/coding-style.md「ジェスチャは終わったときに1回書く」）。ただしこの画面は
 * 途中の値もプレビューへ映すので、編集状態そのものは動かし続ける必要がある。
 * **動かすのは状態、待たせるのは保存**という切り分けをここが持つ。
 *
 * 打鍵・クリック・選択は1回で値が確定するので、待たずにそのまま書く。
 */

/**
 * ジェスチャの途中で溜めてよい編集の鍵。**同じ対象への繰り返しは最後の1つだけを書く。**
 *
 * 鍵に値（`attributes` など）を入れない — 入れると動かしている途中の値ごとに別の鍵に
 * なり、溜める意味が無くなる。
 *
 * `null` は「溜めずにそのまま書く」。足す・消す・並べ替えるはジェスチャの途中で繰り返す
 * ものではないので、**知らない action は溜めない側に倒す**（溜め損ねても書き込みが増える
 * だけで済み、取りこぼしにはならない）。
 */
function collapsibleKey(action: AnswerSheetEditAction): string | null {
  switch (action.type) {
    case "UPDATE_DEFINITION":
      return "UPDATE_DEFINITION"
    case "UPDATE_HEADER_FIELD":
      return `UPDATE_HEADER_FIELD:${action.payload.headerFieldId}`
    case "UPDATE_MAJOR_QUESTION":
      return `UPDATE_MAJOR_QUESTION:${action.payload.majorQuestionId}`
    case "UPDATE_SUB_QUESTION":
      return `UPDATE_SUB_QUESTION:${action.payload.subQuestionId}`
    case "UPDATE_BRANCH_QUESTION":
      return `UPDATE_BRANCH_QUESTION:${action.payload.branchQuestionId}`
    case "UPDATE_TEXT_ELEMENT":
      return `UPDATE_TEXT_ELEMENT:${action.payload.textElementId}`
    case "UPDATE_IMAGE_ELEMENT":
      return `UPDATE_IMAGE_ELEMENT:${action.payload.imageElementId}`
    case "UPDATE_CHAR_GUIDE":
      return `UPDATE_CHAR_GUIDE:${action.payload.charGuideId}`
    case "UPSERT_OMR_CONFIG":
      return `UPSERT_OMR_CONFIG:${JSON.stringify(action.payload.parent)}`
    default:
      return null
  }
}

/**
 * 書き込みの関所を作る。
 *
 * @param write 実際に DB へ書く（呼び出し側＝画面が渡す。フックは DB を触らない）
 */
export function useAsbWriteGate(
  write: (action: AnswerSheetEditAction) => void
) {
  const writeRef = useRef(write)
  useEffect(() => {
    writeRef.current = write
  })

  /**
   * ジェスチャの最中か。**state ではなく ref。**
   *
   * これで描き直すものは無いので、指を動かすたびに画面全体を描き直す理由が無い。
   */
  const isGesturing = useRef(false)
  /** 待たせている編集（対象ごとに最後の1つ）。挿入した順で書く */
  const pending = useRef(new Map<string, AnswerSheetEditAction>())

  const flush = useCallback(() => {
    if (pending.current.size === 0) return
    const waiting = [...pending.current.values()]
    pending.current.clear()
    for (const action of waiting) writeRef.current(action)
  }, [])

  const begin = useCallback(() => {
    isGesturing.current = true
  }, [])

  /**
   * ジェスチャが終わった。待たせていた分をここで書く。
   *
   * 中断（`pointercancel`）でも書く。**途中の値は既に編集状態になっている**ので、
   * 書かずに済ませると画面だけが DB の先へ行ったまま戻らない。
   */
  const end = useCallback(() => {
    isGesturing.current = false
    flush()
  }, [flush])

  const onEdit = useCallback((action: AnswerSheetEditAction) => {
    if (!isGesturing.current) {
      writeRef.current(action)
      return
    }
    const key = collapsibleKey(action)
    if (key === null) {
      writeRef.current(action)
      return
    }
    pending.current.set(key, action)
  }, [])

  // ページの外で指を離したときに、待たせたまま残らないようにする最後の砦。
  // 残ると以後の編集がすべて溜まり続け、保存されなくなる
  useEffect(() => {
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
    return () => {
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
    }
  }, [end])

  const gestureHandlers = useMemo(() => ({ begin, end }), [begin, end])

  return { onEdit, gestureHandlers }
}
