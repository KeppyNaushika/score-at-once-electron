import { cn } from "@/lib/utils"

import type { EntityOverviewStat, EntityOverviewStatTone } from "./types"

/**
 * 見出しと数の色。
 *
 * **控えめに置く。** 濃く塗って白抜きにすると、画面の中でいちばん強い面が
 * 「いくつあるか」になる。ここは現在地の見取り図で、読ませたいのは下の手順である。
 * 淡く敷いて濃い文字を載せれば、色の違いは残したまま主張が下がる。
 *
 * **同系色にはしない。** 項目どうしを見分けるための印なので、色相は離す。
 */
interface StatToneClasses {
  /** 札の外枠 */
  frame: string
  /** 見出し側（淡く敷いて濃い文字） */
  label: string
  /** 数側（敷かずに色文字） */
  value: string
}

const STAT_TONE_CLASSES: Record<EntityOverviewStatTone, StatToneClasses> = {
  blue: {
    frame: "border-blue-200",
    label: "bg-blue-100 text-blue-800",
    value: "text-blue-700",
  },
  green: {
    frame: "border-emerald-200",
    label: "bg-emerald-100 text-emerald-800",
    value: "text-emerald-700",
  },
  purple: {
    frame: "border-purple-200",
    label: "bg-purple-100 text-purple-800",
    value: "text-purple-700",
  },
  indigo: {
    frame: "border-indigo-200",
    label: "bg-indigo-100 text-indigo-800",
    value: "text-indigo-700",
  },
  orange: {
    frame: "border-orange-200",
    label: "bg-orange-100 text-orange-800",
    value: "text-orange-700",
  },
  teal: {
    frame: "border-teal-200",
    label: "bg-teal-100 text-teal-800",
    value: "text-teal-700",
  },
  rose: {
    frame: "border-rose-200",
    label: "bg-rose-100 text-rose-800",
    value: "text-rose-700",
  },
}

/** まだ1件も無い項目は灰へ落とす（色が付いているのは「在る」の合図） */
const STAT_EMPTY_CLASSES: StatToneClasses = {
  frame: "border-gray-200",
  label: "bg-gray-100 text-gray-600",
  value: "text-gray-500",
}

function statToneClasses(stat: EntityOverviewStat): StatToneClasses {
  if (typeof stat.value === "number" && stat.value === 0)
    return STAT_EMPTY_CLASSES
  if (!stat.tone) return STAT_EMPTY_CLASSES
  return STAT_TONE_CLASSES[stat.tone]
}

interface EntityOverviewStatStripProps {
  stats: EntityOverviewStat[]
}

/**
 * 現在地の見取り図。**1項目が1枚の札**で、左が見出し（色で塗って白抜き）、
 * 右が数（塗らずに色文字）。高さも文字も詰める——ここで足を止めさせたい
 * わけではないので、面積を取らせない。基本情報と同じ枠へ入れる——どちらも
 * 「この実体が何か」の話で、下の手順とは別である
 */
export function EntityOverviewStatStrip({
  stats,
}: EntityOverviewStatStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t pt-4">
      {stats.map((stat) => {
        const tone = statToneClasses(stat)
        return (
          <span
            key={stat.label}
            className={cn(
              "inline-flex overflow-hidden rounded border text-[11px] leading-none",
              tone.frame
            )}
          >
            <span className={cn("px-1.5 py-1", tone.label)}>{stat.label}</span>
            <span className={cn("px-1.5 py-1 font-semibold", tone.value)}>
              {stat.value}
            </span>
          </span>
        )
      })}
    </div>
  )
}
