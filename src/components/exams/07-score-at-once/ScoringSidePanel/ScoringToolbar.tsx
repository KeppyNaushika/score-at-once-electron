"use client"

import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Minus,
  RefreshCw,
  Target,
  X,
} from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import type { ScoringStatus } from "@/components/exams/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import type { ScoringStatusType } from "@/lib/scoringStatusColors"

import { SidePanelSection } from "./SidePanelSection"

interface ScoringToolbarProps {
  selectedAnswersCount: number
  currentCropRegion?: {
    points: number | null
  } | null
  filterSettings?: {
    unscored: boolean
    correct: boolean
    incorrect: boolean
    partial: boolean
    pending: boolean
    no_answer: boolean
  }
  onScore: (status: ScoringStatus) => void
  onToggleFilter?: (key: string) => void
  onRefreshFilter?: () => void
  partialScoreInput: string
  gradingMode?: "grid" | "individual" // 採点モード
}

// ScoringStatus -> ScoringStatusType へのマッピング（統一済み）
const STATUS_MAP: Record<ScoringStatus, ScoringStatusType> = {
  unscored: "unscored",
  correct: "correct",
  partial: "partial",
  pending: "pending",
  incorrect: "incorrect",
  no_answer: "no_answer",
  double_mark: "double_mark",
}

// 採点ボタン設定（色はuseScoringStatusColorsから動的取得）
const SCORING_BUTTONS = [
  {
    status: "unscored" as ScoringStatus,
    label: "未採点",
    icon: Circle,
    description: "未採点にする",
  },
  {
    status: "correct" as ScoringStatus,
    label: "正答",
    icon: CheckCircle,
    description: "正答にする",
  },
  {
    status: "partial" as ScoringStatus,
    label: "部分点",
    icon: AlertTriangle,
    description: "部分点にする",
  },
  {
    status: "pending" as ScoringStatus,
    label: "保留",
    icon: Clock,
    description: "保留にする",
  },
  {
    status: "incorrect" as ScoringStatus,
    label: "誤答",
    icon: X,
    description: "誤答にする",
  },
  {
    status: "no_answer" as ScoringStatus,
    label: "無答",
    icon: Minus,
    description: "無答にする",
  },
  {
    status: "double_mark" as ScoringStatus,
    label: "Wマーク",
    icon: CopyX,
    description: "ダブルマークにする",
  },
] as const

// フィルターボタン設定（色はuseScoringStatusColorsから動的取得）
const FILTER_BUTTONS = [
  { key: "unscored", filterKey: "unscored", label: "未採点", icon: Circle },
  { key: "correct", filterKey: "correct", label: "正答", icon: CheckCircle },
  {
    key: "partial",
    filterKey: "partial",
    label: "部分点",
    icon: AlertTriangle,
  },
  { key: "pending", filterKey: "pending", label: "保留", icon: Clock },
  { key: "incorrect", filterKey: "incorrect", label: "誤答", icon: X },
  { key: "no_answer", filterKey: "no_answer", label: "無答", icon: Minus },
  {
    key: "double_mark",
    filterKey: "double_mark",
    label: "Wマーク",
    icon: CopyX,
  },
] as const

export default function ScoringToolbar({
  selectedAnswersCount,
  filterSettings,
  onScore,
  onToggleFilter,
  onRefreshFilter,
  partialScoreInput,
  gradingMode = "grid",
}: ScoringToolbarProps) {
  // 新しいショートカットシステム: キーバインディング取得
  const { keyBindings } = useKeyBindings()
  // 動的採点状態色を取得
  const scoringColors = useScoringStatusColors()

  return (
    <TooltipProvider delayDuration={300}>
      {/* 採点セクション */}
      <SidePanelSection
        icon={Target}
        title="採点"
        badge={
          selectedAnswersCount > 0 ? `${selectedAnswersCount}件` : undefined
        }
        rightElement={
          partialScoreInput ? (
            <Badge
              variant="outline"
              className="border-yellow-300 bg-yellow-50 text-xs"
            >
              入力中: {partialScoreInput}
              {partialScoreInput.endsWith(".") ? "●" : ""}
            </Badge>
          ) : undefined
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {SCORING_BUTTONS.map((button) => {
            const Icon = button.icon
            // コマンドIDからキーバインディングを取得
            const commandId = `scoring.${button.status === "no_answer" ? "noAnswer" : button.status}`
            const keyBinding = keyBindings[commandId] || "?"
            // 動的色を取得
            const statusType = STATUS_MAP[button.status]
            const colors = scoringColors[statusType]
            return (
              <Tooltip key={button.status}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex h-12 flex-col gap-1 border-2 ${
                      selectedAnswersCount === 0
                        ? "cursor-not-allowed opacity-50"
                        : "hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      borderColor: colors.bg,
                    }}
                    onClick={() => onScore(button.status)}
                    disabled={selectedAnswersCount === 0}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="text-xs">{button.label}</div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-medium">{button.description}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      キー:{" "}
                      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                        {keyBinding.toUpperCase()}
                      </kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </SidePanelSection>

      {/* フィルターセクション - グリッド表示時のみ */}
      {gradingMode === "grid" &&
        filterSettings &&
        onToggleFilter &&
        onRefreshFilter && (
          <SidePanelSection
            icon={RefreshCw}
            title="フィルター"
            rightElement={
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshFilter}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                更新
              </Button>
            }
          >
            <div className="grid grid-cols-3 gap-2">
              {FILTER_BUTTONS.map((button) => {
                const Icon = button.icon
                const isActive =
                  filterSettings[
                    button.filterKey as keyof typeof filterSettings
                  ]
                // コマンドIDからキーバインディングを取得
                const statusKey =
                  button.key === "no_answer"
                    ? "NoAnswer"
                    : button.key.charAt(0).toUpperCase() + button.key.slice(1)
                const commandId = `filter.toggle${statusKey}`
                const keyBinding = keyBindings[commandId] || "?"
                // 動的色を取得
                const statusType = STATUS_MAP[button.key as ScoringStatus]
                const colors = scoringColors[statusType]
                return (
                  <Tooltip key={button.key}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex h-10 items-center gap-2 border-2"
                        style={
                          isActive
                            ? {
                                backgroundColor: colors.bg,
                                color: colors.text,
                                borderColor: colors.icon,
                              }
                            : {
                                backgroundColor: "transparent",
                                color: colors.icon,
                                borderColor: colors.icon,
                              }
                        }
                        onClick={() => onToggleFilter(button.key)}
                      >
                        <Icon className="h-3 w-3" />
                        <div className="text-xs">{button.label}</div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <div className="font-medium">
                          {button.label}を{isActive ? "非表示" : "表示"}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          キー:{" "}
                          <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                            {keyBinding.toUpperCase()}
                          </kbd>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </SidePanelSection>
        )}
    </TooltipProvider>
  )
}
