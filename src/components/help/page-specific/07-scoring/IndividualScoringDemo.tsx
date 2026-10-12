"use client"

import { useCallback } from "react"

import { KeyCap } from "@/components/help/common/DocComponents"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"

import { DemoPartialScoreModal } from "./DemoPartialScoreModal"
import { DemoScoringHeader } from "./DemoScoringHeader"
import { IndividualSheet } from "./IndividualSheet"
import { ScoringButtonRow } from "./ScoringButtonRow"
import type { DemoCell, DemoStatus, NavKeys } from "./types"
import type { DemoCursor } from "./useDemoScoring"
import { useDemoScoring } from "./useDemoScoring"
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

  // 前後の生徒へ移動（W/A=前、S/D=次）
  const handleNavigationKey = useCallback(
    (key: string, cursor: DemoCursor) => {
      if (key === navKeys.up || key === navKeys.left) {
        cursor.select(Math.max(0, cursor.selectedIndex - 1))
        return true
      }
      if (key === navKeys.down || key === navKeys.right) {
        cursor.select(Math.min(cursor.cellCount - 1, cursor.selectedIndex + 1))
        return true
      }
      return false
    },
    [navKeys]
  )

  const scoring = useDemoScoring({
    initialCells: INDIV_CELLS,
    markOrder: INDIV_MARK_ORDER,
    rawKeys,
    allowPartial: true,
    isActive,
    onNavigationKey: handleNavigationKey,
  })
  const { cells, selected } = scoring

  const cell = cells[selected]
  const scoreDisplay = scoreText(cell)
  const mark = SHEET_MARKS[cell.status]
  const scoredCount = cells.filter((cell) => cell.status !== "unscored").length

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <DemoScoringHeader
        questionExample="『きぼう』を漢字で"
        onReset={scoring.reset}
      />

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
        onScore={scoring.scoreByButton}
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

      <DemoPartialScoreModal scoring={scoring} rawKeys={rawKeys} />
    </div>
  )
}
