"use client"

import { Layout } from "lucide-react"

import {
  hatchedFill,
  PROPOSAL_FILL_LEGEND,
} from "@/components/exams/07-score-at-once/ScoringGrid/constants/proposalFill"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import { ScoringStatusFilterButtons } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringStatusFilterButtons"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { Button } from "@/components/ui/button"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { AiGridDisplaySettings } from "./types"
import {
  FILTER_BASES,
  FILTER_BASIS_LABELS,
  type FilterBasis,
  type StatusFilterSettings,
} from "./utils/aiGridFilter"

interface AiGridDisplaySectionProps {
  display: AiGridDisplaySettings
  filterBasis: FilterBasis
  onFilterBasisChange: (basis: FilterBasis) => void
  filterSettings: StatusFilterSettings
  onToggleFilter: (status: ScoringStatus) => void
  selectedCount: number
  visibleCount: number
  totalCount: number
}

/**
 * 右パネルの「表示」節。絞り込みのボタンは一覧表示と同じ7色で、何の状態で絞るか
 * （AI の提案か自分の採点か）を選べる。並べ方・件数の設定も一覧表示と同じもの
 */
export function AiGridDisplaySection({
  display,
  filterBasis,
  onFilterBasisChange,
  filterSettings,
  onToggleFilter,
  selectedCount,
  visibleCount,
  totalCount,
}: AiGridDisplaySectionProps) {
  return (
    <SidePanelSection
      icon={Layout}
      title="表示"
      rightElement={
        <span className="text-[10px] text-gray-500">
          選択{" "}
          <span className="font-medium text-blue-600">{selectedCount}</span>{" "}
          <span className="text-gray-300">|</span> 表示{" "}
          <span className="font-medium">{visibleCount}</span>{" "}
          <span className="text-gray-300">|</span> 全体{" "}
          <span className="font-medium">{totalCount}</span>
        </span>
      }
    >
      <div className="space-y-3">
        <div
          role="radiogroup"
          aria-label="絞り込みの基準"
          className="flex items-center gap-1 text-xs"
        >
          <span className="text-muted-foreground">絞り込みの基準</span>
          {FILTER_BASES.map((basis) => (
            <Button
              key={basis}
              role="radio"
              aria-checked={filterBasis === basis}
              variant={filterBasis === basis ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onFilterBasisChange(basis)}
            >
              {FILTER_BASIS_LABELS[basis]}
            </Button>
          ))}
        </div>
        <ScoringStatusFilterButtons
          filterSettings={filterSettings}
          onToggleFilter={onToggleFilter}
        />
        <ProposalFillLegend />
        {filterBasis === "ai" && (
          <p className="text-[11px] text-muted-foreground">
            AI の提案の状態で絞り込みます（成功した判定が無い答案は「未採点」）
          </p>
        )}
        <NavigationControls
          layoutDirection={display.layoutDirection}
          onLayoutDirectionChange={display.onLayoutDirectionChange}
          itemsPerRow={display.itemsPerLine}
          onItemsPerRowChange={display.onItemsPerLineChange}
          expandMargin={display.expandMargin}
          onExpandMarginChange={display.onExpandMarginChange}
        />
      </div>
    </SidePanelSection>
  )
}

/** マスの塗りの見方（斜線 = AI提案（未確定）、塗り = 確定） */
function ProposalFillLegend() {
  const correctColors = useScoringStatusColors().correct
  const swatchStyle = { borderColor: correctColors.icon }
  return (
    <div
      className="flex items-center gap-3 text-[11px] text-gray-700"
      aria-label={PROPOSAL_FILL_LEGEND}
    >
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-3 w-5 rounded-sm border"
          style={{
            ...swatchStyle,
            backgroundImage: hatchedFill(correctColors.icon),
          }}
        />
        斜線 = AI提案（未確定）
      </span>
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-3 w-5 rounded-sm border"
          style={{ ...swatchStyle, backgroundColor: correctColors.bg }}
        />
        塗り = 確定
      </span>
    </div>
  )
}
