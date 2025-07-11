"use client"

import { ScoringStatus } from "@/components/projects/07-score-at-once/hooks"
import { getKeyboardShortcuts } from "@/components/projects/07-score-at-once/hooks/use-scoring-keyboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
  X,
} from "lucide-react"

interface ScoringToolbarProps {
  selectedAnswersCount: number
  currentQuestion?: {
    points: number
  }
  filterSettings: {
    ungraded: boolean
    correct: boolean
    incorrect: boolean
    partial: boolean
    pending: boolean
    no_answer: boolean
  }
  onScore: (status: ScoringStatus) => void
  onToggleFilter: (key: string) => void
  onRefreshFilter: () => void
  partialScoreInput: string
  modifierKeyLabel: string
}

// 採点ボタン設定
const SCORING_BUTTONS = [
  {
    status: "ungraded" as ScoringStatus,
    shortcutKey: "ungraded",
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
    key: "ungraded",
    filterKey: "ungraded",
    shortcutKey: "ungraded",
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
  currentQuestion,
  filterSettings,
  onScore,
  onToggleFilter,
  onRefreshFilter,
  partialScoreInput,
  modifierKeyLabel,
}: ScoringToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="mb-4 space-y-4 bg-white p-4">
        {/* 採点ボタン群 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-700">採点</h3>
            {selectedAnswersCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedAnswersCount}件
              </Badge>
            )}
            {partialScoreInput && (
              <Badge
                variant="outline"
                className="border-yellow-300 bg-yellow-50 text-xs"
              >
                入力中: {partialScoreInput}
                {partialScoreInput.endsWith(".") ? "●" : ""}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {SCORING_BUTTONS.map((button) => {
              const Icon = button.icon
              const shortcuts = getKeyboardShortcuts() // 動的に取得
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
                          {shortcuts[
                            button.shortcutKey as keyof typeof shortcuts
                          ]?.toUpperCase() || "キー"}
                        </kbd>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* フィルターボタン群 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-700">フィルター</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshFilter}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              更新
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {FILTER_BUTTONS.map((button) => {
              const Icon = button.icon
              const isActive =
                filterSettings[button.filterKey as keyof typeof filterSettings]
              const shortcuts = getKeyboardShortcuts() // 動的に取得
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
                          {modifierKeyLabel}+
                          {shortcuts[
                            button.shortcutKey as keyof typeof shortcuts
                          ]?.toUpperCase() || "キー"}
                        </kbd>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
