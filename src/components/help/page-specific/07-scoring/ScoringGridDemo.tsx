"use client"

import { useQuery } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { parsePreference } from "@/lib/userPreferences"
import { userPreferenceQuery } from "@/queries/settings"

import { MAX_SCORE } from "./constants"
import { ScoringButtonRow } from "./ScoringButtonRow"
import type { DemoCell, DemoStatus, NavKeys, PartialInput } from "./types"
import { scoreText } from "./utils"

/** デモ各セルの幅（模範解答・生徒答案で共通） */
const DEMO_CELL_W = "w-36"

/**
 * 採点グリッドの体験デモ。本体の色設定・枠色・ステータス設定・UIコンポーネントを
 * 再利用し、本番と同じ見た目で、クリックまたはキーボードで採点を試せる。
 *
 * キーボードは、このデモが表示されている間（＝ヘルプを開いている間）つねに
 * window のキャプチャ段階で横取りし、stopImmediatePropagation で本体のショート
 * カット（document のキャプチャリスナ）に届かせない。ヘルプを閉じるとアンマウント
 * されてリスナも外れるため、本番のキー操作には影響しない。
 */
export function ScoringGridDemo({
  initialCells,
  markOrder,
  allowPartial,
  rawKeys,
  navKeys,
  questionExample,
  masterAnswer,
  isActive,
  completion,
  onAllScored,
}: {
  initialCells: DemoCell[]
  markOrder: DemoStatus[]
  allowPartial: boolean
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
  questionExample: string
  masterAnswer: string
  isActive: boolean
  completion?: React.ReactNode
  onAllScored?: () => void
}) {
  const colors = useScoringStatusColors()
  const currentUser = useCurrentUser()
  const { data: storedSelectionColor } = useQuery(
    userPreferenceQuery(currentUser.id, "selectionBorderColor")
  )
  const selectionColor =
    parsePreference("selectionBorderColor", storedSelectionColor ?? null) ??
    "#F97316"
  const statusConfigMap = getDynamicScoreStatusConfig(colors)
  const firstUnscored = Math.max(
    0,
    initialCells.findIndex((cell) => cell.status === "unscored")
  )
  const [cells, setCells] = useState<DemoCell[]>(initialCells)
  const [selected, setSelected] = useState(firstUnscored)
  const [partial, setPartial] = useState<PartialInput>({
    active: false,
    value: "",
  })

  const cellsRef = useRef(initialCells)
  const selectedRef = useRef(firstUnscored)
  const partialRef = useRef(partial)
  const notifiedRef = useRef(false)
  const isActiveRef = useRef(isActive)
  // 模範解答＋生徒答案を inline で並べる折り返しグリッド（列数の実測に使う）
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const setCellsSynced = (next: DemoCell[]) => {
    cellsRef.current = next
    setCells(next)
  }
  const setSelectedSynced = (n: number) => {
    selectedRef.current = n
    setSelected(n)
  }
  const setPartialSynced = (partialInput: PartialInput) => {
    partialRef.current = partialInput
    setPartial(partialInput)
  }

  const applyStatus = useCallback((status: DemoStatus, score?: number) => {
    const selectedIndex = selectedRef.current
    const updated = cellsRef.current.map((cell, i) =>
      i === selectedIndex ? { ...cell, status, score } : cell
    )
    setCellsSynced(updated)
    const after = updated.findIndex(
      (cell, i) => i > selectedIndex && cell.status === "unscored"
    )
    const wrap =
      after === -1
        ? updated.findIndex((cell) => cell.status === "unscored")
        : after
    if (wrap !== -1) setSelectedSynced(wrap)
  }, [])

  /** 折り返しグリッドの先頭行に並ぶセル数（模範解答含む）を DOM から実測 */
  const measureColumns = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return 1
    const items = Array.from(grid.children).filter(
      (child) => child instanceof HTMLElement
    )
    if (items.length === 0) return 1
    const top0 = items[0].offsetTop
    let cols = 0
    for (const child of items) {
      if (child.offsetTop === top0) cols++
      else break
    }
    return Math.max(1, cols)
  }, [])

  /**
   * 本番（right-down レイアウト）と同じ移動仕様。
   * 模範解答を index 0 に含む結合配列で考え、W/S は ∓cols（行をまたぐ）、
   * 端では ∓1 にフォールバック、A/D は ±1。模範解答（0）には止まらない。
   */
  const moveSelection = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      const n = cellsRef.current.length
      const total = n + 1 // 模範解答 + 生徒答案
      const cols = measureColumns()
      const cur = selectedRef.current + 1 // 結合配列での現在位置
      let next = cur
      if (dir === "left") next = cur - 1
      else if (dir === "right") next = cur + 1
      else if (dir === "up") {
        next = cur - cols
        if (next < 0) next = Math.max(0, cur - 1)
      } else if (dir === "down") {
        next = cur + cols
        if (next >= total) next = Math.min(total - 1, cur + 1)
      }
      next = Math.max(0, Math.min(total - 1, next))
      // 模範解答（結合 index 0）には選択を止めない
      if (next === 0) return
      setSelectedSynced(next - 1)
    },
    [measureColumns]
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
      setPartialSynced({ active: false, value: "" })
      return
    }
    const clampedScore = Math.min(MAX_SCORE, Math.max(0, Number(value)))
    setPartialSynced({ active: false, value: "" })
    applyStatus("partial", clampedScore)
  }, [applyStatus])

  const confirmPending = useCallback(() => {
    setPartialSynced({ active: false, value: "" })
    applyStatus("pending")
  }, [applyStatus])

  const cancelPartial = useCallback(() => {
    setPartialSynced({ active: false, value: "" })
  }, [])

  const keyToStatus = useMemo(() => {
    const map: Record<string, DemoStatus> = {}
    markOrder.forEach((status) => {
      const k = rawKeys[status]
      if (k) map[k.toLowerCase()] = status
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

      // WASD で選択を移動
      if (key === navKeys.left) {
        block()
        moveSelection("left")
        return
      }
      if (key === navKeys.right) {
        block()
        moveSelection("right")
        return
      }
      if (key === navKeys.up) {
        block()
        moveSelection("up")
        return
      }
      if (key === navKeys.down) {
        block()
        moveSelection("down")
        return
      }

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
    navKeys,
    moveSelection,
    applyStatus,
    openPartial,
    editPartial,
    confirmPartial,
    confirmPending,
    cancelPartial,
  ])

  const allScored = cells.every((cell) => cell.status !== "unscored")

  useEffect(() => {
    if (allScored && !notifiedRef.current) {
      notifiedRef.current = true
      onAllScored?.()
    }
  }, [allScored, onAllScored])

  const reset = () => {
    notifiedRef.current = false
    setCellsSynced(initialCells)
    setSelectedSynced(firstUnscored)
    setPartialSynced({ active: false, value: "" })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">設問例「{questionExample}」</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reset}
          className="h-7 gap-1 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          やり直す
        </Button>
      </div>

      {/* 採点グリッド（本番と同じセル表示）。模範解答＋生徒答案を inline で並べ、
          幅に応じて折り返す。模範解答は先頭セル（結合 index 0）。 */}
      <div ref={gridRef} className="flex flex-wrap gap-2">
        <div
          className={`${DEMO_CELL_W} flex shrink-0 flex-col gap-1 border-2 border-black bg-white p-2`}
        >
          <div className="flex h-14 items-center justify-center bg-white">
            <span
              className={`font-semibold text-gray-800 ${
                masterAnswer.length > 4 ? "text-lg" : "text-3xl"
              }`}
            >
              {masterAnswer}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-bold text-black">
              模範解答
            </span>
            <Badge
              variant="outline"
              className="h-4 border-black bg-white px-1 text-xs text-black"
            >
              {MAX_SCORE}点満点
            </Badge>
          </div>
        </div>

        {cells.map((cell, i) => {
          const isSelected = i === selected
          const statusConfig = statusConfigMap[cell.status]
          const Icon = statusConfig.icon
          const bg = isSelected
            ? statusConfig.selectedBgStyle
            : statusConfig.bgStyle
          const scoreDisplay = scoreText(cell)
          return (
            <button
              type="button"
              key={cell.name}
              onClick={() => setSelectedSynced(i)}
              className={`${DEMO_CELL_W} flex shrink-0 flex-col gap-1 border-2 p-2 text-left outline-none focus:outline-none focus-visible:outline-none`}
              style={{
                ...bg,
                borderColor: isSelected ? selectionColor : "transparent",
              }}
            >
              <div className="flex h-14 items-center justify-center bg-white">
                <span
                  className={
                    cell.answer === "（空欄）"
                      ? "text-sm text-gray-400"
                      : `text-blue-900/80 ${
                          cell.answer.length > 4 ? "text-base" : "text-3xl"
                        }`
                  }
                  style={
                    cell.answer === "（空欄）"
                      ? undefined
                      : { fontFamily: "cursive" }
                  }
                >
                  {cell.answer}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="truncate text-xs font-medium"
                  style={statusConfig.textStyle}
                >
                  {cell.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {scoreDisplay && (
                    <Badge variant="outline" className="h-4 px-1 text-xs">
                      {scoreDisplay}
                    </Badge>
                  )}
                  <Icon className="h-3 w-3" style={statusConfig.iconStyle} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 印（採点ボタン）。本番 ScoringToolbar と完全に同一（ツールチップ含む） */}
      <ScoringButtonRow
        markOrder={markOrder}
        rawKeys={rawKeys}
        onScore={(status) =>
          status === "partial" ? openPartial("") : applyStatus(status)
        }
      />

      {/* 部分点の入力は本番のモーダルをそのまま再利用 */}
      <PartialScoreModal
        isOpen={partial.active}
        value={partial.value}
        maxPoints={MAX_SCORE}
        questionLabel="1"
        onClose={cancelPartial}
        onChange={setPartialValue}
        onConfirmPartial={confirmPartial}
        onConfirmPending={confirmPending}
        onDigit={(k) => editPartial(k)}
        onBackspace={() => editPartial("⌫")}
        keyBindings={{
          partialKey: rawKeys.partial,
          pendingKey: rawKeys.pending,
          cancelKey: "Escape",
        }}
      />

      {allScored && !partial.active && completion}
    </div>
  )
}
