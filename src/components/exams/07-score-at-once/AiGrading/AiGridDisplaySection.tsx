"use client"

import { Layout } from "lucide-react"

import {
  hatchedFill,
  PROPOSAL_FILL_LEGEND,
} from "@/components/exams/07-score-at-once/ScoringGrid/constants/proposalFill"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import { ScoringStatusFilterButtons } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringStatusFilterButtons"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { aiFilterCommandIdOf } from "@/lib/scoringKeybindings"
import { ignoreDeselect } from "@/lib/toggleSelection"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { AiConfidenceFilterButtons } from "./AiConfidenceFilterButtons"
import type { AiGridDisplaySettings } from "./types"
import {
  type AiGridFilterSettings,
  type ConfidenceFilterLevel,
  FILTER_SOURCE_LABELS,
  FILTER_SOURCES,
  type FilterSource,
} from "./utils/aiGridFilter"
import {
  ANSWER_ORDER_LABELS,
  ANSWER_ORDERS,
  type AnswerOrder,
} from "./utils/answerReview"

interface AiGridDisplaySectionProps {
  display: AiGridDisplaySettings
  filterSettings: AiGridFilterSettings
  onToggleFilter: (source: FilterSource, status: ScoringStatus) => void
  onToggleConfidenceFilter: (level: ConfidenceFilterLevel) => void
  answerOrder: AnswerOrder
  onAnswerOrderChange: (answerOrder: AnswerOrder) => void
  selectedCount: number
  visibleCount: number
  totalCount: number
}

/**
 * 右パネルの「表示」節。絞り込みのボタンは一覧表示と同じ7色を「自分の採点」と
 * 「AI の採点」の2組並べ、AI の判定の「確信度」の組を足す（組の中は OR、組どうしは AND）。
 * キーは自分の採点が一覧表示と同じもの、AI の採点はそれに Opt+Shift（確信度には無い）。
 * 並べ方・件数の設定も一覧表示と同じもの
 */
export function AiGridDisplaySection({
  display,
  filterSettings,
  onToggleFilter,
  onToggleConfidenceFilter,
  answerOrder,
  onAnswerOrderChange,
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
        {FILTER_SOURCES.map((source) => (
          <div key={source} className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {FILTER_SOURCE_LABELS[source]}
            </p>
            <ScoringStatusFilterButtons
              aria-label={`${FILTER_SOURCE_LABELS[source]}の絞り込み`}
              filterSettings={filterSettings[source]}
              onToggleFilter={(status) => onToggleFilter(source, status)}
              commandIdOf={source === "ai" ? aiFilterCommandIdOf : undefined}
            />
          </div>
        ))}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">確信度</p>
          <AiConfidenceFilterButtons
            confidenceSettings={filterSettings.confidence}
            onToggle={onToggleConfidenceFilter}
          />
        </div>
        <ProposalFillLegend />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">並べ方</p>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={answerOrder}
            aria-label="並べ方"
            onValueChange={ignoreDeselect(ANSWER_ORDERS, onAnswerOrderChange)}
            className="w-full"
          >
            {ANSWER_ORDERS.map((orderOption) => (
              <ToggleGroupItem key={orderOption} value={orderOption}>
                {ANSWER_ORDER_LABELS[orderOption]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
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
