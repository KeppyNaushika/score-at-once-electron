"use client"

import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"
import { KeyCap } from "@/components/help/common/DocComponents"
import { Button } from "@/components/ui/button"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"

import { MAX_SCORE } from "./constants"
import { IndividualSheet } from "./IndividualSheet"
import { ScoringButtonRow } from "./ScoringButtonRow"
import type { DemoCell, DemoStatus, NavKeys, PartialInput } from "./types"
import { formatKey, scoreText } from "./utils"

/** 個別表示の体験用：3人の答案を1人ずつ大きく表示して採点する */
const INDIV_CELLS: DemoCell[] = [
  { name: "佐藤", answer: "希望", status: "unscored" },
  { name: "鈴木", answer: "希棒", status: "unscored" },
  { name: "高橋", answer: "希望", status: "unscored" },
]

/** 採点の基準となる模範解答（答え合わせ用に常に並べて表示する） */
const INDIV_MASTER = "希望"

const INDIV_MARK_ORDER: DemoStatus[] = [
  "correct",
  "incorrect",
  "partial",
  "no_answer",
  "pending",
]

/** 答案に重ねる採点マーク（採点状態ごと） */
const SHEET_MARKS: Record<DemoStatus, string> = {
  unscored: "",
  correct: "◯",
  incorrect: "✕",
  partial: "△",
  no_answer: "／",
  pending: "?",
}

/**
 * 個別表示の採点体験デモ。1人の答案を大きく表示し、採点（キー/ボタン）すると
 * 次の未採点の生徒へ。前後の生徒へは W/S（設定キー）で移動。部分点は数字キー。
 * キーボードの横取りは ScoringGridDemo と同じく window キャプチャ＋停止で、
 * このセクションが入力対象のときだけ働き、本番には影響しない。
 */
export function IndividualScoringDemo({
  rawKeys,
  navKeys,
  isActive,
}: {
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
  isActive: boolean
}) {
  const colors = useScoringStatusColors()
  const [cells, setCells] = useState<DemoCell[]>(INDIV_CELLS)
  const [selected, setSelected] = useState(0)
  const [partial, setPartial] = useState<PartialInput>({
    active: false,
    value: "",
  })

  const cellsRef = useRef(INDIV_CELLS)
  const selectedRef = useRef(0)
  const partialRef = useRef(partial)
  const isActiveRef = useRef(isActive)
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
    // 採点したら次の未採点の生徒へ自動で進む
    const after = updated.findIndex(
      (cell, i) => i > selectedIndex && cell.status === "unscored"
    )
    const wrap =
      after === -1
        ? updated.findIndex((cell) => cell.status === "unscored")
        : after
    if (wrap !== -1) setSelectedSynced(wrap)
  }, [])

  const moveStudent = useCallback((dir: "prev" | "next") => {
    const n = cellsRef.current.length
    const i =
      dir === "next"
        ? Math.min(n - 1, selectedRef.current + 1)
        : Math.max(0, selectedRef.current - 1)
    setSelectedSynced(i)
  }, [])

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
    INDIV_MARK_ORDER.forEach((status) => {
      const k = rawKeys[status]
      if (k) map[k.toLowerCase()] = status
    })
    return map
  }, [rawKeys])

  useEffect(() => {
    const partialKey = (rawKeys.partial || "").toLowerCase()
    const pendingKey = (rawKeys.pending || "").toLowerCase()
    const handler = (e: KeyboardEvent) => {
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
          block()
        }
        return
      }

      // 前後の生徒へ移動（W/A=前、S/D=次）
      if (key === navKeys.up || key === navKeys.left) {
        block()
        moveStudent("prev")
        return
      }
      if (key === navKeys.down || key === navKeys.right) {
        block()
        moveStudent("next")
        return
      }

      // 部分点（数字キー or 部分点キー）
      if (/^[0-9]$/.test(key)) {
        block()
        openPartial(key)
        return
      }
      if (key === partialKey) {
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
    rawKeys.partial,
    rawKeys.pending,
    navKeys,
    moveStudent,
    applyStatus,
    openPartial,
    editPartial,
    confirmPartial,
    confirmPending,
    cancelPartial,
  ])

  const reset = () => {
    setCellsSynced(INDIV_CELLS)
    setSelectedSynced(0)
    setPartialSynced({ active: false, value: "" })
  }

  const cell = cells[selected]
  const scoreDisplay = scoreText(cell)
  const mark = SHEET_MARKS[cell.status]
  const scoredCount = cells.filter((cell) => cell.status !== "unscored").length

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">設問例「『きぼう』を漢字で」</p>
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

      {/* 本番の「左右分割」と同じく、生徒の答案用紙（左）と模範解答の答案用紙（右）を
          同じサイズ・同じレイアウトで並べて見くらべる。 */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        {/* 生徒の答案用紙（左）— 採点マーク・点数を重ねる */}
        <IndividualSheet
          headerRight={
            <>
              {"氏名　"}
              {cell.name}
            </>
          }
          answer={cell.answer}
          answerClassName="text-blue-900/80"
          mark={mark}
          markColor={colors[cell.status].icon}
          score={scoreDisplay}
        />

        {/* 模範解答の答案用紙（右）— 同じサイズで、領域に正答を表示 */}
        <IndividualSheet
          headerRight={
            <span className="font-bold text-rose-600">模範解答</span>
          }
          answer={INDIV_MASTER}
          answerClassName="text-rose-700"
        />
      </div>

      <ScoringButtonRow
        markOrder={INDIV_MARK_ORDER}
        rawKeys={rawKeys}
        onScore={(status) =>
          status === "partial" ? openPartial("") : applyStatus(status)
        }
      />

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          前後の生徒へは <KeyCap>{formatKey(navKeys.up)}</KeyCap>
          <KeyCap>{formatKey(navKeys.down)}</KeyCap> で移動できます。
        </span>
        <span>
          {cells.length}人のうち {scoredCount}人を採点しました。
          {scoredCount === cells.length && " 全員の採点が終わりました。"}
        </span>
      </p>

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
    </div>
  )
}
