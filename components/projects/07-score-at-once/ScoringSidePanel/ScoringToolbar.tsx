"use client"

import { useCommand } from "@/components/projects/07-score-at-once/hooks/useCommand"
import { useKeyBindings } from "@/components/projects/07-score-at-once/hooks/useKeyBindings"
import type { ScoringStatus } from "@/components/projects/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  Minus,
  RefreshCw,
  Target,
  X,
} from "lucide-react"
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
  modifierKeyLabel: string
  gradingMode?: "grid" | "individual" // 採点モード
}

// 採点ボタン設定
const SCORING_BUTTONS = [
  {
    status: "unscored" as ScoringStatus,
    shortcutKey: "unscored",
    label: "未採点",
    icon: Circle,
    color: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    description: "未採点にする",
  },
  {
    status: "correct" as ScoringStatus,
    shortcutKey: "correct",
    label: "正答",
    icon: CheckCircle,
    color: "bg-green-100 text-green-700 hover:bg-green-200",
    description: "正答にする",
  },
  {
    status: "partial" as ScoringStatus,
    shortcutKey: "partial",
    label: "部分点",
    icon: AlertTriangle,
    color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    description: "部分点にする",
  },
  {
    status: "pending" as ScoringStatus,
    shortcutKey: "pending",
    label: "保留",
    icon: Clock,
    color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    description: "保留にする",
  },
  {
    status: "incorrect" as ScoringStatus,
    shortcutKey: "incorrect",
    label: "誤答",
    icon: X,
    color: "bg-red-100 text-red-700 hover:bg-red-200",
    description: "誤答にする",
  },
  {
    status: "no_answer" as ScoringStatus,
    shortcutKey: "no_answer",
    label: "無答",
    icon: Minus,
    color: "bg-purple-100 text-purple-700 hover:bg-purple-200",
    description: "無答にする",
  },
] as const

// フィルターボタン設定
const FILTER_BUTTONS = [
  {
    key: "unscored",
    filterKey: "unscored",
    shortcutKey: "unscored",
    label: "未採点",
    icon: Circle,
    color: "border-gray-400 text-gray-600",
    activeColor: "bg-gray-300 border-gray-700 text-gray-900",
  },
  {
    key: "correct",
    filterKey: "correct",
    shortcutKey: "correct",
    label: "正答",
    icon: CheckCircle,
    color: "border-green-400 text-green-600",
    activeColor: "bg-green-300 border-green-700 text-green-900",
  },
  {
    key: "incorrect",
    filterKey: "incorrect",
    shortcutKey: "incorrect",
    label: "誤答",
    icon: X,
    color: "border-red-400 text-red-600",
    activeColor: "bg-red-300 border-red-700 text-red-900",
  },
  {
    key: "partial",
    filterKey: "partial",
    shortcutKey: "partial",
    label: "部分点",
    icon: AlertTriangle,
    color: "border-yellow-400 text-yellow-600",
    activeColor: "bg-yellow-300 border-yellow-700 text-yellow-900",
  },
  {
    key: "pending",
    filterKey: "pending",
    shortcutKey: "pending",
    label: "保留",
    icon: Clock,
    color: "border-blue-400 text-blue-600",
    activeColor: "bg-blue-300 border-blue-700 text-blue-900",
  },
  {
    key: "no_answer",
    filterKey: "no_answer",
    shortcutKey: "no_answer",
    label: "無答",
    icon: Minus,
    color: "border-purple-400 text-purple-600",
    activeColor: "bg-purple-300 border-purple-700 text-purple-900",
  },
] as const

export default function ScoringToolbar({
  selectedAnswersCount,
  filterSettings,
  onScore,
  onToggleFilter,
  onRefreshFilter,
  partialScoreInput,
  modifierKeyLabel: _modifierKeyLabel,
  gradingMode = "grid",
}: ScoringToolbarProps) {
  // 新しいショートカットシステム: キーバインディング取得
  const { keyBindings } = useKeyBindings()

  // コンテキスト値の設定（不要だがサンプルとして残す）
  // hasSelectedAnswers は ScoringMainView で設定済み

  // ============================================
  // 採点コマンドの登録
  // ============================================
  useCommand("scoring.unscored", () => onScore("unscored"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "未採点として採点",
      category: "採点",
      description: "選択中の答案を未採点にします",
    },
  })

  useCommand("scoring.correct", () => onScore("correct"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "正答として採点",
      category: "採点",
      description: "選択中の答案を正答として採点します",
    },
  })

  useCommand("scoring.partial", () => onScore("partial"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "部分点として採点",
      category: "採点",
      description: "選択中の答案を部分点として採点します",
    },
  })

  useCommand("scoring.pending", () => onScore("pending"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "保留として採点",
      category: "採点",
      description: "選択中の答案を保留として採点します",
    },
  })

  useCommand("scoring.incorrect", () => onScore("incorrect"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "誤答として採点",
      category: "採点",
      description: "選択中の答案を誤答として採点します",
    },
  })

  useCommand("scoring.noAnswer", () => onScore("no_answer"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
    metadata: {
      title: "無答として採点",
      category: "採点",
      description: "選択中の答案を無答として採点します",
    },
  })

  // ============================================
  // フィルタトグルコマンドの登録（グリッドモードのみ）
  // ============================================
  useCommand(
    "filter.toggleUnscored",
    () => onToggleFilter && onToggleFilter("unscored"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
      metadata: {
        title: "未採点フィルタトグル",
        category: "フィルタ",
        description: "未採点の答案の表示を切り替えます",
      },
    },
  )

  useCommand(
    "filter.toggleCorrect",
    () => onToggleFilter && onToggleFilter("correct"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
      metadata: {
        title: "正答フィルタトグル",
        category: "フィルタ",
      },
    },
  )

  useCommand(
    "filter.togglePartial",
    () => onToggleFilter && onToggleFilter("partial"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
      metadata: {
        title: "部分点フィルタトグル",
        category: "フィルタ",
      },
    },
  )

  useCommand(
    "filter.togglePending",
    () => onToggleFilter && onToggleFilter("pending"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
      metadata: {
        title: "保留フィルタトグル",
        category: "フィルタ",
      },
    },
  )

  useCommand(
    "filter.toggleIncorrect",
    () => onToggleFilter && onToggleFilter("incorrect"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
      metadata: {
        title: "誤答フィルタトグル",
        category: "フィルタ",
      },
    },
  )

  useCommand(
    "filter.toggleNoAnswer",
    () => onToggleFilter && onToggleFilter("no_answer"),
    {
      when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
      metadata: {
        title: "無答フィルタトグル",
        category: "フィルタ",
      },
    },
  )

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
            return (
              <Tooltip key={button.status}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${button.color} flex h-12 flex-col gap-1 border-2 ${
                      selectedAnswersCount === 0
                        ? "cursor-not-allowed opacity-50"
                        : ""
                    }`}
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
                return (
                  <Tooltip key={button.key}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`flex h-10 items-center gap-2 border-2 ${
                          isActive ? button.activeColor : button.color
                        }`}
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
