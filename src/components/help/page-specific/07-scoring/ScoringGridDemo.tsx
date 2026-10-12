"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"

import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { parsePreference } from "@/lib/userPreferences"
import { userPreferenceQuery } from "@/queries/settings"

import { MAX_SCORE } from "./constants"
import { DemoPartialScoreModal } from "./DemoPartialScoreModal"
import { DemoScoringHeader } from "./DemoScoringHeader"
import { ScoringButtonRow } from "./ScoringButtonRow"
import type { DemoCell, DemoStatus, NavKeys } from "./types"
import type { DemoCursor } from "./useDemoScoring"
import { useDemoScoring } from "./useDemoScoring"
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
  const notifiedRef = useRef(false)
  // 模範解答＋生徒答案を inline で並べる折り返しグリッド（列数の実測に使う）
  const gridRef = useRef<HTMLDivElement>(null)

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
    (dir: "up" | "down" | "left" | "right", cursor: DemoCursor) => {
      const total = cursor.cellCount + 1 // 模範解答 + 生徒答案
      const cols = measureColumns()
      const cur = cursor.selectedIndex + 1 // 結合配列での現在位置
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
      cursor.select(next - 1)
    },
    [measureColumns]
  )

  // WASD で選択を移動
  const handleNavigationKey = useCallback(
    (key: string, cursor: DemoCursor) => {
      if (key === navKeys.left) {
        moveSelection("left", cursor)
        return true
      }
      if (key === navKeys.right) {
        moveSelection("right", cursor)
        return true
      }
      if (key === navKeys.up) {
        moveSelection("up", cursor)
        return true
      }
      if (key === navKeys.down) {
        moveSelection("down", cursor)
        return true
      }
      return false
    },
    [navKeys, moveSelection]
  )

  const scoring = useDemoScoring({
    initialCells,
    markOrder,
    rawKeys,
    allowPartial,
    isActive,
    onNavigationKey: handleNavigationKey,
  })
  const { cells, selected, partial } = scoring

  const allScored = cells.every((cell) => cell.status !== "unscored")

  useEffect(() => {
    if (allScored && !notifiedRef.current) {
      notifiedRef.current = true
      onAllScored?.()
    }
  }, [allScored, onAllScored])

  const reset = () => {
    notifiedRef.current = false
    scoring.reset()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <DemoScoringHeader questionExample={questionExample} onReset={reset} />

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
              onClick={() => scoring.select(i)}
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
        onScore={scoring.scoreByButton}
      />

      {/* 部分点の入力は本番のモーダルをそのまま再利用 */}
      <DemoPartialScoreModal scoring={scoring} rawKeys={rawKeys} />

      {allScored && !partial.active && completion}
    </div>
  )
}
