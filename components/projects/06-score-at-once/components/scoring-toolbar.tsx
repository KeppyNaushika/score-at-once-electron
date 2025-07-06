"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  X,
  Minus,
  RefreshCw,
} from "lucide-react"
import { ScoringStatus } from "../hooks"

interface ScoringToolbarProps {
  selectedAnswersCount: number
  currentQuestion?: {
    questionNumber: string
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
    label: "未採点",
    icon: Circle,
    color: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    shortcut: "Q",
    description: "採点を取り消し"
  },
  {
    status: "correct" as ScoringStatus,
    label: "正答",
    icon: CheckCircle,
    color: "bg-green-100 text-green-700 hover:bg-green-200",
    shortcut: "E",
    description: "満点を付与"
  },
  {
    status: "partial" as ScoringStatus,
    label: "部分点",
    icon: AlertTriangle,
    color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    shortcut: "F",
    description: "部分点を付与"
  },
  {
    status: "pending" as ScoringStatus,
    label: "保留",
    icon: Clock,
    color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    shortcut: "J",
    description: "採点を保留"
  },
  {
    status: "incorrect" as ScoringStatus,
    label: "誤答",
    icon: X,
    color: "bg-red-100 text-red-700 hover:bg-red-200",
    shortcut: "O",
    description: "0点を付与"
  },
  {
    status: "no_answer" as ScoringStatus,
    label: "無答",
    icon: Minus,
    color: "bg-purple-100 text-purple-700 hover:bg-purple-200",
    shortcut: "P",
    description: "無答として記録"
  },
]

// フィルターボタン設定
const FILTER_BUTTONS = [
  {
    key: "ungraded",
    filterKey: "ungraded",
    label: "未採点",
    icon: Circle,
    color: "border-gray-400 text-gray-600",
    activeColor: "bg-gray-100 border-gray-600 text-gray-800"
  },
  {
    key: "correct", 
    filterKey: "correct",
    label: "正答",
    icon: CheckCircle,
    color: "border-green-400 text-green-600",
    activeColor: "bg-green-100 border-green-600 text-green-800"
  },
  {
    key: "incorrect",
    filterKey: "incorrect", 
    label: "誤答",
    icon: X,
    color: "border-red-400 text-red-600",
    activeColor: "bg-red-100 border-red-600 text-red-800"
  },
  {
    key: "partial",
    filterKey: "partial",
    label: "部分点",
    icon: AlertTriangle,
    color: "border-yellow-400 text-yellow-600", 
    activeColor: "bg-yellow-100 border-yellow-600 text-yellow-800"
  },
  {
    key: "pending",
    filterKey: "pending",
    label: "保留",
    icon: Clock,
    color: "border-blue-400 text-blue-600",
    activeColor: "bg-blue-100 border-blue-600 text-blue-800"
  },
  {
    key: "no_answer",
    filterKey: "no_answer",
    label: "無答", 
    icon: Minus,
    color: "border-purple-400 text-purple-600",
    activeColor: "bg-purple-100 border-purple-600 text-purple-800"
  },
]

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
      <Card className="mb-4">
        <CardContent className="p-4 space-y-4">
          
          {/* 採点ボタン群 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-700">採点</h3>
              {selectedAnswersCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedAnswersCount}件
                </Badge>
              )}
              {partialScoreInput && (
                <Badge variant="outline" className="text-xs bg-yellow-50">
                  {partialScoreInput}
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {SCORING_BUTTONS.map((button) => {
                const Icon = button.icon
                return (
                  <Tooltip key={button.status}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`${button.color} border-2 h-12 flex flex-col gap-1 ${
                          selectedAnswersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
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
                        <div className="text-xs text-gray-400 mt-1">
                          キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">{button.shortcut}</kbd>
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
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-700">フィルター</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshFilter}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                更新
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {FILTER_BUTTONS.map((button) => {
                const Icon = button.icon
                const isActive = filterSettings[button.filterKey as keyof typeof filterSettings]
                return (
                  <Tooltip key={button.key}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`border-2 h-10 flex items-center gap-2 ${
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
                          {button.label}を{isActive ? '非表示' : '表示'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">{button.key}</kbd> または
                          <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs ml-1">{modifierKeyLabel}+採点キー</kbd>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>


        </CardContent>
      </Card>
    </TooltipProvider>
  )
}