"use client"

import type { CropRegionWithProjectPage } from "@/components/projects/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react"
import { SidePanelSection } from "./SidePanelSection"

interface QuestionNavigatorProps {
  questionRegions: CropRegionWithProjectPage[]
  currentCropRegion?: CropRegionWithProjectPage | null
  onCropRegionChange: (cropRegion: CropRegionWithProjectPage | null) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress?: {
    [questionId: string]: {
      totalAnswers: number
      gradedAnswers: number
      percentage: number
    }
  }
}

export default function QuestionNavigator({
  questionRegions,
  currentCropRegion,
  onCropRegionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
}: QuestionNavigatorProps) {
  const currentIndex = currentCropRegion
    ? questionRegions.findIndex((q) => q.id === currentCropRegion.id)
    : -1

  // 0/0の設問を特定
  const zeroProgressQuestions = Object.entries(questionProgress || {}).filter(
    ([_, progress]) =>
      progress.totalAnswers === 0 && progress.gradedAnswers === 0,
  )

  if (zeroProgressQuestions.length > 0) {
    console.warn(
      "🚨 QuestionNavigator: 0/0 progress questions:",
      zeroProgressQuestions.map(([id, progress]) => {
        const region = questionRegions.find((r) => r.id === id)
        return {
          questionId: id,
          questionLabel: region?.label || "Unknown",
          ...progress,
        }
      }),
    )
  }
  return (
    <TooltipProvider delayDuration={300}>
      <SidePanelSection icon={FileText} title="設問">
        {/* ナビゲーション: [前] [設問プルダウン] [次] */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevQuestion}
                disabled={currentIndex === 0 || currentIndex === -1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div>前の設問に移動</div>
                <div className="mt-1 text-xs text-gray-400">
                  キー:{" "}
                  <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                    Shift+A
                  </kbd>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          <Select
            value={currentCropRegion?.id || ""}
            onValueChange={(value) => {
              const selectedRegion =
                questionRegions.find((q) => q.id === value) || null
              onCropRegionChange(selectedRegion)
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="設問を選択" />
            </SelectTrigger>
            <SelectContent>
              {questionRegions.map((question, _index) => {
                const progress = questionProgress?.[question.id]
                return (
                  <SelectItem
                    key={question.id}
                    value={question.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>{question.label || question.orderIndex || 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {question.points || 0}点
                      </Badge>
                    </div>
                    {progress && (
                      <div className="ml-auto flex items-center gap-1">
                        {progress.percentage === 100 ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : progress.percentage > 0 ? (
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        ) : null}
                        <span className="text-xs text-gray-500">
                          {progress.gradedAnswers}/{progress.totalAnswers}
                        </span>
                      </div>
                    )}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onNextQuestion}
                disabled={
                  currentIndex === questionRegions.length - 1 ||
                  currentIndex === -1
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div>次の設問に移動</div>
                <div className="mt-1 text-xs text-gray-400">
                  キー:{" "}
                  <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                    Shift+D
                  </kbd>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 設問一覧（サムネイル表示） */}
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="mb-2 text-xs text-gray-500">
            設問一覧（クリックで移動）
          </div>
          <div className="flex flex-wrap gap-2">
            {questionRegions.map((question, _index) => {
              const progress = questionProgress?.[question.id]
              const isActive = question.id === currentCropRegion?.id
              return (
                <Tooltip key={question.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 px-2 ${
                        isActive ? "" : "hover:bg-gray-50"
                      }`}
                      onClick={() => onCropRegionChange(question)}
                    >
                      <span className="text-xs">
                        {question.label || question.orderIndex || 1}
                      </span>
                      {progress && progress.percentage > 0 && (
                        <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-green-500">
                          {progress.percentage === 100 && (
                            <CheckCircle className="h-2 w-2 text-white" />
                          )}
                        </div>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">
                        {question.label || question.orderIndex || 1}
                      </div>
                      <div className="text-xs text-gray-400">
                        {question.label}
                      </div>
                      <div className="text-xs text-gray-400">
                        {question.points || 0}点
                      </div>
                      {progress && (
                        <div className="mt-1 text-xs text-gray-400">
                          進捗: {progress.percentage}%
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </SidePanelSection>
    </TooltipProvider>
  )
}
