import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { MAX_SCORE } from "./constants"
import type { DemoCell, DemoStatus, PartialInput } from "./types"

const CLOSED_PARTIAL: PartialInput = { active: false, value: "" }

interface UseDemoScoringOptions {
  initialCells: DemoCell[]
  markOrder: DemoStatus[]
  rawKeys: Record<DemoStatus, string>
  /** 数字キー・部分点キーで部分点モーダルを開くか */
  allowPartial: boolean
  isActive: boolean
  /**
   * 移動キーを処理する。処理したキーなら true を返す（本体へ漏らさない）。
   * 移動の仕方は表示ごとに違うため呼び出し側に任せる
   */
  onNavigationKey: (key: string, cursor: DemoCursor) => boolean
}

/** 移動キーの処理に渡す、その時点の選択位置 */
export interface DemoCursor {
  selectedIndex: number
  cellCount: number
  select: (index: number) => void
}

/** 採点体験デモの状態。一覧表示・個別表示のデモで共有する */
export interface DemoScoring {
  cells: DemoCell[]
  selected: number
  partial: PartialInput
  select: (index: number) => void
  applyStatus: (status: DemoStatus, score?: number) => void
  /** 採点ボタンを押したとき（部分点はモーダルを開く） */
  scoreByButton: (status: DemoStatus) => void
  editPartial: (char: string) => void
  setPartialValue: (value: string) => void
  confirmPartial: () => void
  confirmPending: () => void
  cancelPartial: () => void
  reset: () => void
}

/**
 * 採点体験デモの採点・部分点入力・キーボード横取りをまとめたフック。
 *
 * キーボードは window のキャプチャ段階で横取りし、stopImmediatePropagation で本体の
 * ショートカット（document のキャプチャリスナ）に届かせない。入力対象のステップ、
 * または部分点モーダル表示中だけ働き、アンマウントでリスナも外れる。
 */
export function useDemoScoring({
  initialCells,
  markOrder,
  rawKeys,
  allowPartial,
  isActive,
  onNavigationKey,
}: UseDemoScoringOptions): DemoScoring {
  const firstUnscored = Math.max(
    0,
    initialCells.findIndex((cell) => cell.status === "unscored")
  )
  const [cells, setCells] = useState<DemoCell[]>(initialCells)
  const [selected, setSelected] = useState(firstUnscored)
  const [partial, setPartial] = useState<PartialInput>(CLOSED_PARTIAL)

  const cellsRef = useRef(initialCells)
  const selectedRef = useRef(firstUnscored)
  const partialRef = useRef(partial)
  const isActiveRef = useRef(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const setCellsSynced = (next: DemoCell[]) => {
    cellsRef.current = next
    setCells(next)
  }
  const select = useCallback((index: number) => {
    selectedRef.current = index
    setSelected(index)
  }, [])
  const setPartialSynced = (partialInput: PartialInput) => {
    partialRef.current = partialInput
    setPartial(partialInput)
  }

  const applyStatus = useCallback(
    (status: DemoStatus, score?: number) => {
      const selectedIndex = selectedRef.current
      const updated = cellsRef.current.map((cell, i) =>
        i === selectedIndex ? { ...cell, status, score } : cell
      )
      setCellsSynced(updated)
      // 採点したら次の未採点の生徒へ自動で進む
      const after = updated.findIndex(
        (cell, i) => i > selectedIndex && cell.status === "unscored"
      )
      const wrap =
        after === -1
          ? updated.findIndex((cell) => cell.status === "unscored")
          : after
      if (wrap !== -1) select(wrap)
    },
    [select]
  )

  const openPartial = useCallback((initial: string) => {
    setPartialSynced({ active: true, value: initial })
  }, [])

  const editPartial = useCallback((char: string) => {
    const cur = partialRef.current.value
    if (char === "⌫") {
      setPartialSynced({ active: true, value: cur.slice(0, -1) })
      return
    }
    if (char === "." && cur.includes(".")) return
    const next = cur + char
    if (Number(next) > MAX_SCORE) return
    if (next.replace(".", "").length > 3) return
    setPartialSynced({ active: true, value: next })
  }, [])

  const setPartialValue = useCallback((value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return
    if (Number(value) > MAX_SCORE) return
    if (value.replace(".", "").length > 3) return
    setPartialSynced({ active: true, value: value })
  }, [])

  const confirmPartial = useCallback(() => {
    const value = partialRef.current.value
    if (value === "" || value === ".") {
      setPartialSynced(CLOSED_PARTIAL)
      return
    }
    const clampedScore = Math.min(MAX_SCORE, Math.max(0, Number(value)))
    setPartialSynced(CLOSED_PARTIAL)
    applyStatus("partial", clampedScore)
  }, [applyStatus])

  const confirmPending = useCallback(() => {
    setPartialSynced(CLOSED_PARTIAL)
    applyStatus("pending")
  }, [applyStatus])

  const cancelPartial = useCallback(() => {
    setPartialSynced(CLOSED_PARTIAL)
  }, [])

  const scoreByButton = useCallback(
    (status: DemoStatus) =>
      status === "partial" ? openPartial("") : applyStatus(status),
    [openPartial, applyStatus]
  )

  const keyToStatus = useMemo(() => {
    const map: Record<string, DemoStatus> = {}
    markOrder.forEach((status) => {
      const statusKey = rawKeys[status]
      if (statusKey) map[statusKey.toLowerCase()] = status
    })
    return map
  }, [markOrder, rawKeys])

  useEffect(() => {
    const partialKey = (rawKeys.partial || "").toLowerCase()
    const pendingKey = (rawKeys.pending || "").toLowerCase()
    const handler = (e: KeyboardEvent) => {
      // 入力対象のステップ、または部分点モーダル表示中だけ働く
      if (!isActiveRef.current && !partialRef.current.active) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      const block = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }

      if (partialRef.current.active) {
        if (/^[0-9.]$/.test(key)) {
          block()
          editPartial(key)
        } else if (key === "Backspace") {
          block()
          editPartial("⌫")
        } else if (key === partialKey || key === "Enter") {
          block()
          confirmPartial()
        } else if (key === pendingKey) {
          block()
          confirmPending()
        } else if (key === "Escape") {
          block()
          cancelPartial()
        } else if (keyToStatus[key]) {
          // 採点キーは本番に漏らさない（モーダル中は無視）
          block()
        }
        return
      }

      const cursor: DemoCursor = {
        selectedIndex: selectedRef.current,
        cellCount: cellsRef.current.length,
        select,
      }
      if (onNavigationKey(key, cursor)) {
        block()
        return
      }

      // 部分点（数字キー or 部分点キー）
      if (allowPartial && /^[0-9]$/.test(key)) {
        block()
        openPartial(key)
        return
      }
      if (allowPartial && key === partialKey) {
        block()
        openPartial("")
        return
      }

      const status = keyToStatus[key]
      if (status && status !== "partial") {
        block()
        applyStatus(status)
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [
    keyToStatus,
    allowPartial,
    rawKeys.partial,
    rawKeys.pending,
    onNavigationKey,
    select,
    applyStatus,
    openPartial,
    editPartial,
    confirmPartial,
    confirmPending,
    cancelPartial,
  ])

  const reset = () => {
    setCellsSynced(initialCells)
    select(firstUnscored)
    setPartialSynced(CLOSED_PARTIAL)
  }

  return {
    cells,
    selected,
    partial,
    select,
    applyStatus,
    scoreByButton,
    editPartial,
    setPartialValue,
    confirmPartial,
    confirmPending,
    cancelPartial,
    reset,
  }
}
