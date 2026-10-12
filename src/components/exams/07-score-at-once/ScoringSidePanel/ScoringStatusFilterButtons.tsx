"use client"

import {
  CircleCheckBig,
  CircleDashed,
  Clock,
  CopyX,
  Layers,
  Minus,
  Triangle,
  X,
} from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { filterCommandIdOf } from "@/lib/scoringKeybindings"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { FilterToggleButton } from "./FilterToggleButton"
import { GRID_4_3_STYLE } from "./scoringToolbarButtons"
import { ShortcutTooltip } from "./ShortcutTooltip"

const FILTER_BUTTONS = [
  { status: "unscored", label: "未採点", icon: CircleDashed },
  { status: "correct", label: "正答", icon: CircleCheckBig },
  { status: "partial", label: "部分点", icon: Triangle },
  { status: "pending", label: "保留", icon: Clock },
  { status: "incorrect", label: "誤答", icon: X },
  { status: "no_answer", label: "無答", icon: Minus },
  { status: "double_mark", label: "Wマーク", icon: CopyX },
] as const

/** 類型評価の設問でだけ足す、評価済み（類型を付けた答案）の絞り込み */
const EVALUATED_FILTER_BUTTON = {
  status: "evaluated",
  label: "類型評価",
  icon: Layers,
} as const

interface ScoringStatusFilterButtonsProps {
  /** 状態ごとの表示の有無（無い状態は非表示として扱う） */
  filterSettings: Partial<Record<ScoringStatus, boolean>>
  onToggleFilter: (status: ScoringStatus) => void
  /** ツールチップに出すキーのコマンド（既定は一覧表示の絞り込み `filter.toggle*`） */
  commandIdOf?: (status: ScoringStatus) => string
  /** ボタンの組の名前（同じ画面に2組並べるときに読み上げで区別する） */
  "aria-label"?: string
  /** 評価済み（類型評価）の絞り込みも並べるか（類型評価の設問だけ） */
  showEvaluated?: boolean
}

/**
 * 採点状態の絞り込みボタン（7色）。一覧表示の「表示」節と AI採点モードで同じものを使う。
 * 色は採点状態の色、ツールチップには絞り込みのキー（`filter.toggle*`）を出す
 */
export function ScoringStatusFilterButtons({
  filterSettings,
  onToggleFilter,
  commandIdOf = filterCommandIdOf,
  "aria-label": groupLabel,
  showEvaluated = false,
}: ScoringStatusFilterButtonsProps) {
  const filterButtons = showEvaluated
    ? [...FILTER_BUTTONS, EVALUATED_FILTER_BUTTON]
    : FILTER_BUTTONS
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()

  return (
    <TooltipProvider delayDuration={300}>
      <div style={GRID_4_3_STYLE} role="group" aria-label={groupLabel}>
        {filterButtons.map((button) => {
          const isActive = filterSettings[button.status] ?? false
          // 評価済みの絞り込みには既定のキーが無い（無ければ「?」でなく「なし」と出す）
          const keyBinding =
            keyBindings[commandIdOf(button.status)] ||
            (button.status === "evaluated" ? "なし" : "?")
          const colors = scoringColors[button.status]
          return (
            <ShortcutTooltip
              key={button.status}
              description={`${button.label}を${isActive ? "非表示" : "表示"}`}
              keys={[formatKeyForDisplay(keyBinding)]}
            >
              <FilterToggleButton
                label={button.label}
                icon={button.icon}
                colors={colors}
                isActive={isActive}
                onToggle={() => onToggleFilter(button.status)}
              />
            </ShortcutTooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
