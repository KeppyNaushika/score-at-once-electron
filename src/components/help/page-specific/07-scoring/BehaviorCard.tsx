import type { CSSProperties } from "react"

import type { ScoringBehavior } from "@/components/exams/07-score-at-once/types"

import { REGION_GREEN } from "./constants"

const BEHAVIOR_NAMES = ["佐藤", "鈴木", "高橋"]
const BEHAVIOR_ROW_TOPS = [24, 48, 72]

/**
 * 採点時の動作のアニメ（CSS）。1枚の答案＋緑枠で表す。
 * - next-question: 同じ答案のまま、緑枠が次の設問へ下がっていく
 * - next-student : 緑枠は同じ位置のまま、答案（生徒）が次々と変わる
 */
function BehaviorAnimation({ mode }: { mode: ScoringBehavior }) {
  const cycle = mode === "next-student"
  const frameStyle: CSSProperties = cycle
    ? { top: BEHAVIOR_ROW_TOPS[1] - 1 }
    : {
        top: BEHAVIOR_ROW_TOPS[0] - 1,
        animation: "help07FrameDown 3s infinite",
      }
  return (
    <div className="relative h-28 w-28 rounded-sm border border-gray-300 bg-white">
      {/* 氏名 */}
      <div className="absolute top-1.5 left-2 h-3 text-[8px] font-medium text-gray-500">
        {cycle ? (
          <div className="relative h-3 w-20">
            {BEHAVIOR_NAMES.map((name, i) => (
              <span
                key={name}
                className="absolute inset-0"
                style={{ animation: `help07Show3 3s ${i}s infinite` }}
              >
                氏名 {name}
              </span>
            ))}
          </div>
        ) : (
          <span>氏名 佐藤</span>
        )}
      </div>

      {/* 設問の行（手書きを模した薄い線） */}
      {BEHAVIOR_ROW_TOPS.map((rowTop) => (
        <span
          key={rowTop}
          className="absolute left-2 block h-2 rounded-sm bg-gray-200"
          style={{ top: rowTop + 6, width: "72%" }}
        />
      ))}

      {/* いま採点する領域＝緑枠 */}
      <div
        className="absolute left-1 rounded-sm border-2"
        style={{
          width: "calc(100% - 8px)",
          height: 22,
          borderColor: REGION_GREEN,
          ...frameStyle,
        }}
      />
    </div>
  )
}

/** 採点時の動作カード：アニメ＋名前＋ひとこと説明 */
export function BehaviorCard({
  mode,
  title,
  desc,
}: {
  mode: ScoringBehavior
  title: string
  desc: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <BehaviorAnimation mode={mode} />
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs leading-snug text-gray-500">{desc}</div>
      </div>
    </div>
  )
}
