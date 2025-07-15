"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react"

interface QuestionRegion {
  id: string
  label: string
  orderIndex?: number
  points: number
}

interface QuestionNavigatorProps {
  questionRegions: QuestionRegion[]
  currentQuestionIndex: number
  onQuestionChange: (index: number) => void
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
  currentQuestionIndex,
  onQuestionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
}: QuestionNavigatorProps) {
  const currentQuestion = questionRegions[currentQuestionIndex]
  const currentProgress = questionProgress?.[currentQuestion?.id]

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mb-4 bg-white p-4">
        {/* 設問ラベル */}
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">設問</span>
        </div>

        {/* ナビゲーション: [前] [設問プルダウン] [次] */}
        <div className="mb-4 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevQuestion}
                disabled={currentQuestionIndex === 0}
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
            value={currentQuestionIndex.toString()}
            onValueChange={(value) => onQuestionChange(parseInt(value))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="設問を選択" />
            </SelectTrigger>
            <SelectContent>
              {questionRegions.map((question, index) => {
                const progress = questionProgress?.[question.id]
                return (
                  <SelectItem key={question.id} value={index.toString()} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>
                        {question.label || question.orderIndex || 1}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {question.points}点
                      </Badge>
                    </div>
                    {progress && (
                      <div className="flex items-center gap-1 ml-auto">
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
                disabled={currentQuestionIndex === questionRegions.length - 1}
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
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 text-xs text-gray-500">
            設問一覧（クリックで移動）
          </div>
          <div className="flex flex-wrap gap-2">
            {questionRegions.map((question, index) => {
              const progress = questionProgress?.[question.id]
              const isActive = index === currentQuestionIndex
              return (
                <Tooltip key={question.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 px-2 ${
                        isActive ? "" : "hover:bg-gray-50"
                      }`}
                      onClick={() => onQuestionChange(index)}
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
                        {question.points}点
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
      </div>
    </TooltipProvider>
  )
}
