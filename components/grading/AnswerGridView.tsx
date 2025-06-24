"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Circle, Clock, AlertTriangle, X, Minus } from "lucide-react"

type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"

import { useState, useCallback, useEffect } from "react"

// 採点状態のアイコンと色を定義
const SCORE_STATUS_CONFIG = {
  ungraded: { 
    icon: Circle, 
    color: "bg-gray-100 border-gray-300", 
    textColor: "text-gray-600",
    key: "q"
  },
  correct: { 
    icon: CheckCircle, 
    color: "bg-green-100 border-green-400", 
    textColor: "text-green-700",
    key: "e"
  },
  partial: { 
    icon: AlertTriangle, 
    color: "bg-yellow-100 border-yellow-400", 
    textColor: "text-yellow-700",
    key: "f"
  },
  pending: { 
    icon: Clock, 
    color: "bg-blue-100 border-blue-400", 
    textColor: "text-blue-700",
    key: "j"
  },
  incorrect: { 
    icon: X, 
    color: "bg-red-100 border-red-400", 
    textColor: "text-red-700",
    key: "o"
  },
  no_answer: { 
    icon: Minus, 
    color: "bg-gray-100 border-gray-400", 
    textColor: "text-gray-600",
    key: "p"
  },
}

export type GridLayoutDirection = "right-down" | "left-down" | "down-right" | "down-left"

interface AnswerItem {
  id: string
  studentId: string
  studentName: string
  imageUrl: string
  currentScore?: number
  maxScore: number
  status: ScoringStatus
  isSelected?: boolean
}

interface AnswerGridViewProps {
  answers: AnswerItem[]
  currentQuestionIndex: number
  layoutDirection: GridLayoutDirection
  gridSize: { columns: number; rows: number }
  onAnswerSelect: (id: string, isSelected: boolean) => void
  onAnswerScore: (id: string | string[], status: ScoringStatus) => void
  selectedAnswers: Set<string>
  className?: string
}

export default function AnswerGridView({
  answers,
  currentQuestionIndex,
  layoutDirection,
  gridSize,
  onAnswerSelect,
  onAnswerScore,
  selectedAnswers,
  className = "",
}: AnswerGridViewProps) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // レイアウト方向に応じて答案を並び替え
  const sortedAnswers = useCallback(() => {
    const total = gridSize.columns * gridSize.rows
    const visibleAnswers = answers.slice(0, total)
    
    if (layoutDirection === "right-down") {
      return visibleAnswers // デフォルト順序
    }
    
    const sorted = new Array(total)
    visibleAnswers.forEach((answer, index) => {
      const row = Math.floor(index / gridSize.columns)
      const col = index % gridSize.columns
      
      let newIndex: number
      switch (layoutDirection) {
        case "left-down":
          newIndex = row * gridSize.columns + (gridSize.columns - 1 - col)
          break
        case "down-right":
          newIndex = col * gridSize.rows + row
          break
        case "down-left":
          newIndex = (gridSize.columns - 1 - col) * gridSize.rows + row
          break
        default:
          newIndex = index
      }
      sorted[newIndex] = answer
    })
    
    return sorted.filter(Boolean)
  }, [answers, layoutDirection, gridSize])

  // キーボードショートカット処理
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合はスキップ
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const key = event.key.toLowerCase()
      const statusEntry = Object.entries(SCORE_STATUS_CONFIG).find(
        ([_, config]) => config.key === key
      )
      
      if (statusEntry && selectedAnswers.size > 0) {
        event.preventDefault()
        const [status] = statusEntry
        onAnswerScore(Array.from(selectedAnswers), status as ScoringStatus)
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [selectedAnswers, onAnswerScore])

  // マウスドラッグ選択
  const handleMouseDown = (event: React.MouseEvent, answerId: string) => {
    setDragStart({ x: event.clientX, y: event.clientY })
    setIsDragging(false)
    
    // Ctrlキーが押されている場合は複数選択
    if (event.ctrlKey) {
      onAnswerSelect(answerId, !selectedAnswers.has(answerId))
    } else {
      // 単一選択
      if (!selectedAnswers.has(answerId)) {
        onAnswerSelect(answerId, true)
      }
    }
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragStart && !isDragging) {
      const distance = Math.sqrt(
        Math.pow(event.clientX - dragStart.x, 2) + 
        Math.pow(event.clientY - dragStart.y, 2)
      )
      if (distance > 5) {
        setIsDragging(true)
      }
    }
  }

  const handleMouseUp = () => {
    setDragStart(null)
    setIsDragging(false)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ショートカットキー表示 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(SCORE_STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon
              return (
                <div key={status} className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">
                    {config.key.toUpperCase()}
                  </kbd>
                  <Icon className={`h-3 w-3 ${config.textColor}`} />
                  <span className="text-muted-foreground">
                    {status === "ungraded" && "未採点"}
                    {status === "correct" && "正答"}
                    {status === "partial" && "部分点"}
                    {status === "pending" && "保留"}
                    {status === "incorrect" && "誤答"}
                    {status === "no_answer" && "無答"}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 答案グリッド */}
      <div 
        className="grid gap-2 select-none"
        style={{
          gridTemplateColumns: `repeat(${gridSize.columns}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`,
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {sortedAnswers().map((answer) => {
          if (!answer) return <div key="empty" />
          
          const config = SCORE_STATUS_CONFIG[answer.status as keyof typeof SCORE_STATUS_CONFIG]
          const Icon = config.icon
          const isSelected = selectedAnswers.has(answer.id)
          
          return (
            <Card
              key={answer.id}
              className={`
                relative cursor-pointer transition-all duration-150 hover:shadow-md
                ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                ${config.color}
              `}
              onMouseDown={(e) => handleMouseDown(e, answer.id)}
            >
              <CardContent className="p-2">
                {/* 答案画像 */}
                <div className="aspect-[3/4] overflow-hidden rounded">
                  <img
                    src={answer.imageUrl}
                    alt={`${answer.studentName}の答案`}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                
                {/* 学生情報と採点状況 */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">
                      {answer.studentName}
                    </span>
                    <Icon className={`h-4 w-4 ${config.textColor}`} />
                  </div>
                  
                  {answer.status !== "ungraded" && (
                    <Badge variant="outline" className="text-xs">
                      {answer.currentScore !== undefined 
                        ? `${answer.currentScore}/${answer.maxScore}点`
                        : answer.status === "correct" ? `${answer.maxScore}点`
                        : answer.status === "incorrect" || answer.status === "no_answer" ? "0点"
                        : "採点中"
                      }
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      {/* 選択状況表示 */}
      {selectedAnswers.size > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="text-sm">
              <span className="font-medium">{selectedAnswers.size}件</span>
              <span className="text-muted-foreground">の答案を選択中</span>
              <span className="ml-4 text-xs text-muted-foreground">
                キーボードで一括採点: Q(未採点) E(正答) F(部分点) J(保留) O(誤答) P(無答)
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}