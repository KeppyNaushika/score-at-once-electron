"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  questionNumber: string
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
          
          {/* 設問選択ドロップダウン */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">設問選択</span>
            </div>
            
            <Select
              value={currentQuestionIndex.toString()}
              onValueChange={(value) => onQuestionChange(parseInt(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="設問を選択" />
              </SelectTrigger>
              <SelectContent>
                {questionRegions.map((question, index) => {
                  const progress = questionProgress?.[question.id]
                  return (
                    <SelectItem key={question.id} value={index.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span>{question.questionNumber}</span>
                          <Badge variant="outline" className="text-xs">
                            {question.points}点
                          </Badge>
                        </div>
                        {progress && (
                          <div className="flex items-center gap-1 ml-2">
                            {progress.percentage === 100 ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : progress.percentage > 0 ? (
                              <AlertCircle className="h-3 w-3 text-yellow-500" />
                            ) : null}
                            <span className="text-xs text-gray-500">
                              {progress.percentage}%
                            </span>
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {currentQuestion && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{currentQuestion.label}</span>
                <Badge variant="secondary">{currentQuestion.points}点</Badge>
              </div>
            )}
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrevQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    前の設問
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>前の設問に移動</div>
                    <div className="text-xs text-gray-400 mt-1">
                      キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">←</kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md">
                <span className="text-sm text-gray-600">
                  {currentQuestionIndex + 1} / {questionRegions.length}
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextQuestion}
                    disabled={currentQuestionIndex === questionRegions.length - 1}
                  >
                    次の設問
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div>次の設問に移動</div>
                    <div className="text-xs text-gray-400 mt-1">
                      キー: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">→</kbd>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* 現在の設問の進捗 */}
            {currentProgress && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  採点進捗: {currentProgress.gradedAnswers}/{currentProgress.totalAnswers}
                </span>
                <div className="w-20">
                  <Progress value={currentProgress.percentage} className="h-2" />
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {currentProgress.percentage}%
                </span>
              </div>
            )}
          </div>

          {/* 設問一覧（サムネイル表示） */}
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-gray-500 mb-2">設問一覧（クリックで移動）</div>
            <div className="flex gap-2 flex-wrap">
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
                          isActive ? '' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => onQuestionChange(index)}
                      >
                        <span className="text-xs">{question.questionNumber}</span>
                        {progress && progress.percentage > 0 && (
                          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 flex items-center justify-center">
                            {progress.percentage === 100 && (
                              <CheckCircle className="h-2 w-2 text-white" />
                            )}
                          </div>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <div className="font-medium">{question.questionNumber}</div>
                        <div className="text-xs text-gray-400">{question.label}</div>
                        <div className="text-xs text-gray-400">{question.points}点</div>
                        {progress && (
                          <div className="text-xs text-gray-400 mt-1">
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