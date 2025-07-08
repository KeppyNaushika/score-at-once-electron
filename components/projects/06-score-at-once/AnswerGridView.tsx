"use client"

import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  Minus,
  X,
} from "lucide-react"

type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

import { useCallback, useEffect, useRef, useState } from "react"

// 採点領域をクロップして表示するコンポーネント
const CroppedAnswerImage = ({
  imageUrl,
  questionRegion,
  alt,
  className = "",
}: {
  imageUrl: string
  questionRegion?: QuestionRegion
  alt: string
  className?: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const imageElement = imageRef.current
    if (!canvas || !imageElement || !imageLoaded) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // キャンバスサイズを設定
    const containerWidth = canvas.offsetWidth
    const containerHeight = canvas.offsetHeight
    canvas.width = containerWidth
    canvas.height = containerHeight

    if (questionRegion) {
      // 採点領域をクロップして描画
      const sourceX = questionRegion.x * imageElement.naturalWidth
      const sourceY = questionRegion.y * imageElement.naturalHeight
      const sourceWidth = questionRegion.width * imageElement.naturalWidth
      const sourceHeight = questionRegion.height * imageElement.naturalHeight

      // アスペクト比を維持してキャンバスにフィット
      const aspectRatio = sourceWidth / sourceHeight
      const canvasAspectRatio = containerWidth / containerHeight

      let drawWidth = containerWidth
      let drawHeight = containerHeight
      let drawX = 0
      let drawY = 0

      if (aspectRatio > canvasAspectRatio) {
        drawHeight = containerWidth / aspectRatio
        drawY = (containerHeight - drawHeight) / 2
      } else {
        drawWidth = containerHeight * aspectRatio
        drawX = (containerWidth - drawWidth) / 2
      }

      ctx.drawImage(
        imageElement,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      )
    } else {
      // 全体画像を表示
      ctx.drawImage(imageElement, 0, 0, containerWidth, containerHeight)
    }
  }, [imageLoaded, questionRegion])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  return (
    <div className={`relative w-full ${className}`}>
      <img
        ref={imageRef}
        src={imageUrl}
        alt={alt}
        className="hidden"
        onLoad={handleImageLoad}
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        className="h-auto w-full"
        style={{ display: imageLoaded ? "block" : "none" }}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-xs text-gray-500">読み込み中...</div>
        </div>
      )}
    </div>
  )
}

// 採点状態のアイコンと色を定義
const SCORE_STATUS_CONFIG = {
  ungraded: {
    icon: Circle,
    borderColor: "border-gray-400",
    bgColor: "bg-gray-50",
    selectedBgColor: "bg-gray-100",
    textColor: "text-gray-600",
    key: "q",
  },
  correct: {
    icon: CheckCircle,
    borderColor: "border-green-500",
    bgColor: "bg-green-50",
    selectedBgColor: "bg-green-100",
    textColor: "text-green-700",
    key: "e",
  },
  partial: {
    icon: AlertTriangle,
    borderColor: "border-yellow-500",
    bgColor: "bg-yellow-50",
    selectedBgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    key: "f",
  },
  pending: {
    icon: Clock,
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50",
    selectedBgColor: "bg-blue-100",
    textColor: "text-blue-700",
    key: "j",
  },
  incorrect: {
    icon: X,
    borderColor: "border-red-500",
    bgColor: "bg-red-50",
    selectedBgColor: "bg-red-100",
    textColor: "text-red-700",
    key: "o",
  },
  no_answer: {
    icon: Minus,
    borderColor: "border-purple-500",
    bgColor: "bg-purple-50",
    selectedBgColor: "bg-purple-100",
    textColor: "text-purple-600",
    key: "p",
  },
  proposed: {
    icon: AlertTriangle,
    borderColor: "border-orange-500",
    bgColor: "bg-orange-50",
    selectedBgColor: "bg-orange-100",
    textColor: "text-orange-700",
    key: "",
  },
  final: {
    icon: CheckCircle,
    borderColor: "border-green-600",
    bgColor: "bg-green-100",
    selectedBgColor: "bg-green-200",
    textColor: "text-green-800",
    key: "",
  },
  master: {
    icon: CheckCircle,
    borderColor: "border-blue-600",
    bgColor: "bg-blue-50",
    selectedBgColor: "bg-blue-100",
    textColor: "text-blue-800",
    key: "",
  },
}

export type GridLayoutDirection =
  | "right-down"
  | "left-down"
  | "down-right"
  | "down-left"

interface QuestionRegion {
  id: string
  label: string
  questionNumber: string
  points: number
  x: number // 0.0 - 1.0 (画像全体に対する割合)
  y: number // 0.0 - 1.0
  width: number // 0.0 - 1.0
  height: number // 0.0 - 1.0
}

interface AnswerItem {
  id: string
  studentId: string
  studentName: string
  imageUrl: string
  currentScore?: number
  maxScore: number
  status: ScoringStatus | "master"
  isSelected?: boolean
  questionRegion?: QuestionRegion
  isMaster?: boolean
}

interface AnswerGridViewProps {
  answers: AnswerItem[]
  currentQuestionIndex: number
  layoutDirection: GridLayoutDirection
  gridSize: { columns: number; rows: number }
  onAnswerSelect: (id: string, isSelected: boolean) => void
  onAnswerScore: (id: string | string[], status: ScoringStatus) => void
  selectedAnswers: Set<string>
  currentAnswerId?: string // 現在採点中の答案ID
  className?: string
  onEffectiveColumnsChange?: (columns: number) => void // 実際の列数変更を親に通知
  itemsPerRow?: number[] // 外部からの1行あたり表示件数
  autoScroll?: boolean // 自動スクロール設定
  showStudentNames?: boolean // 生徒名表示設定
}

export default function AnswerGridView({
  answers,
  currentQuestionIndex,
  layoutDirection,
  gridSize,
  onAnswerSelect,
  onAnswerScore,
  selectedAnswers,
  currentAnswerId,
  className = "",
  onEffectiveColumnsChange,
  itemsPerRow: externalItemsPerRow,
  autoScroll = true,
  showStudentNames = true,
}: AnswerGridViewProps) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [isDragging, setIsDragging] = useState(false)
  const [itemsPerRow, setItemsPerRow] = useState([5]) // 1行あたりの表示件数 (0-10)
  const gridRef = useRef<HTMLDivElement>(null)

  // 外部からのitemsPerRowを優先し、ない場合はlocalStorageから読み込み
  useEffect(() => {
    if (externalItemsPerRow) {
      setItemsPerRow(externalItemsPerRow)
      if (onEffectiveColumnsChange) {
        onEffectiveColumnsChange(externalItemsPerRow[0])
      }
    } else {
      const stored = localStorage.getItem("answerGridView-itemsPerRow")
      let initialValue = [5] // デフォルト値
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (
            Array.isArray(parsed) &&
            parsed.length === 1 &&
            typeof parsed[0] === "number" &&
            parsed[0] >= 1 &&
            parsed[0] <= 10
          ) {
            initialValue = parsed
            setItemsPerRow(parsed)
          }
        } catch (error) {
          console.warn("Failed to parse stored itemsPerRow:", error)
        }
      }
      // 親コンポーネントに初期値を通知
      if (onEffectiveColumnsChange) {
        onEffectiveColumnsChange(initialValue[0])
      }
    }
  }, [externalItemsPerRow, onEffectiveColumnsChange])

  // itemsPerRowの変更をlocalStorageに保存
  const handleItemsPerRowChange = (value: number[]) => {
    setItemsPerRow(value)
    localStorage.setItem("answerGridView-itemsPerRow", JSON.stringify(value))
    // 親コンポーネントに実際の列数を通知
    if (onEffectiveColumnsChange) {
      onEffectiveColumnsChange(value[0])
    }
  }

  // 答案表示数の増減機能
  const incrementItemsPerRow = useCallback(() => {
    const currentValue = itemsPerRow[0]
    const newValue = Math.min(currentValue + 1, 12) // 最大12列
    handleItemsPerRowChange([newValue])
  }, [itemsPerRow])

  const decrementItemsPerRow = useCallback(() => {
    const currentValue = itemsPerRow[0]
    const newValue = Math.max(currentValue - 1, 2) // 最小2列
    handleItemsPerRowChange([newValue])
  }, [itemsPerRow])

  // Opt + [-/+] キーボードイベント処理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Option/Alt + Minus で減少
      if (event.altKey && (event.key === "-" || event.key === "_")) {
        event.preventDefault()
        decrementItemsPerRow()
      }
      // Option/Alt + Plus で増加
      else if (
        event.altKey &&
        (event.key === "+" || event.key === "=" || event.key === "Equal")
      ) {
        event.preventDefault()
        incrementItemsPerRow()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [incrementItemsPerRow, decrementItemsPerRow])

  // 実際に使用するgridSizeを計算
  const effectiveGridSize = {
    columns: itemsPerRow[0] === 0 ? gridSize.columns : itemsPerRow[0], // 0の場合は元のgridSizeを使用
    rows:
      layoutDirection === "down-right" || layoutDirection === "down-left"
        ? itemsPerRow[0] // 下→右レイアウトでは1列の表示件数として使用
        : gridSize.rows,
  }

  // レイアウト方向に応じて答案を並び替え
  const sortedAnswers = useCallback(() => {
    // 下→右・下→左レイアウトでは、CSS Gridのgrid-auto-flow: columnが自動で縦配置するため
    // ソート変換不要、元の順序のまま使用
    if (layoutDirection === "down-right" || layoutDirection === "down-left") {
      return answers // 元の順序をそのまま使用
    }

    // 右→下レイアウトのみソート処理
    if (layoutDirection === "right-down") {
      return answers // デフォルト順序
    }

    // 左→下レイアウト用のソート
    if (layoutDirection === "left-down") {
      const totalAnswers = answers.length
      const cols = effectiveGridSize.columns
      const sorted = new Array(totalAnswers)

      answers.forEach((answer, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        const newIndex = row * cols + (cols - 1 - col)
        if (newIndex < totalAnswers) {
          sorted[newIndex] = answer
        }
      })

      return sorted.filter(Boolean)
    }

    return answers
  }, [answers, layoutDirection, effectiveGridSize])

  // キーボードショートカット処理
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合はスキップ
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const statusEntry = Object.entries(SCORE_STATUS_CONFIG).find(
        ([_, config]) => config.key === key,
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

  // 選択された答案を画面中央にスクロール（自動スクロール設定に基づく）
  useEffect(() => {
    if (autoScroll && selectedAnswers.size === 1 && gridRef.current) {
      const selectedId = Array.from(selectedAnswers)[0]
      const selectedElement = gridRef.current.querySelector(
        `[data-answer-id="${selectedId}"]`,
      ) as HTMLElement

      if (selectedElement) {
        // gridRef.current自体がスクロールコンテナ（overflow-auto）
        const container = gridRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = selectedElement.getBoundingClientRect()

        // 縦・横両方向のスクロール計算（すべてのレイアウトに対応）
        const scrollLeft =
          elementRect.left -
          containerRect.left +
          container.scrollLeft -
          container.clientWidth / 2 +
          elementRect.width / 2

        const scrollTop =
          elementRect.top -
          containerRect.top +
          container.scrollTop -
          container.clientHeight / 2 +
          elementRect.height / 2

        // 両方向に同時にスクロール
        container.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: "smooth",
        })
      }
    }
  }, [selectedAnswers, layoutDirection, autoScroll])

  // マウスドラッグ選択
  const handleMouseDown = (event: React.MouseEvent, answerId: string) => {
    // 模範解答の場合は選択処理をスキップ
    if (answerId.startsWith("master-")) {
      event.preventDefault()
      return
    }

    setDragStart({ x: event.clientX, y: event.clientY })
    setIsDragging(false)

    // Ctrlキーが押されている場合は複数選択（追加・削除切り替え）
    if (event.ctrlKey) {
      event.preventDefault()
      onAnswerSelect(answerId, !selectedAnswers.has(answerId))
    }
    // Shiftキーが押されている場合は範囲選択
    else if (event.shiftKey) {
      event.preventDefault()
      handleShiftSelect(answerId)
    }
    // 通常クリック（単一選択または新規選択開始）
    else {
      if (!selectedAnswers.has(answerId)) {
        // 現在の選択をクリア
        selectedAnswers.forEach((id) => onAnswerSelect(id, false))
        // 新しい選択を追加
        onAnswerSelect(answerId, true)
      }
    }
  }

  // Shift+クリックでの範囲選択処理
  const handleShiftSelect = (endAnswerId: string) => {
    const answers = sortedAnswers()
    if (answers.length === 0) return

    // 既に選択されている最初の答案を取得
    let startIndex = -1
    for (let i = 0; i < answers.length; i++) {
      if (selectedAnswers.has(answers[i].id)) {
        startIndex = i
        break
      }
    }

    // 終了位置を取得
    const endIndex = answers.findIndex((answer) => answer.id === endAnswerId)

    if (startIndex === -1 || endIndex === -1) {
      // 範囲選択できない場合は単一選択
      onAnswerSelect(endAnswerId, true)
      return
    }

    // 範囲を選択
    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    for (let i = minIndex; i <= maxIndex; i++) {
      if (i < answers.length) {
        onAnswerSelect(answers[i].id, true)
      }
    }
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragStart && !isDragging) {
      const distance = Math.sqrt(
        Math.pow(event.clientX - dragStart.x, 2) +
          Math.pow(event.clientY - dragStart.y, 2),
      )
      if (distance > 5) {
        setIsDragging(true)
      }
    }
  }

  const handleMouseUp = (event: React.MouseEvent) => {
    if (isDragging) {
      // ドラッグ選択を終了
      handleDragSelection(event)
    }
    setDragStart(null)
    setIsDragging(false)
  }

  // ドラッグによる矩形選択処理
  const handleDragSelection = (event: React.MouseEvent) => {
    if (!dragStart) return

    const gridElement = event.currentTarget as HTMLElement
    const gridRect = gridElement.getBoundingClientRect()

    // 矩形選択範囲を計算
    const startX = Math.min(dragStart.x, event.clientX) - gridRect.left
    const endX = Math.max(dragStart.x, event.clientX) - gridRect.left
    const startY = Math.min(dragStart.y, event.clientY) - gridRect.top
    const endY = Math.max(dragStart.y, event.clientY) - gridRect.top

    // グリッド内の答案カードをチェック
    const cardElements = gridElement.querySelectorAll("[data-answer-id]")
    const selectedIds: string[] = []

    cardElements.forEach((cardElement) => {
      const rect = cardElement.getBoundingClientRect()
      const relativeRect = {
        left: rect.left - gridRect.left,
        right: rect.right - gridRect.left,
        top: rect.top - gridRect.top,
        bottom: rect.bottom - gridRect.top,
      }

      // 矩形と重なるかチェック
      if (
        relativeRect.left < endX &&
        relativeRect.right > startX &&
        relativeRect.top < endY &&
        relativeRect.bottom > startY
      ) {
        const answerId = cardElement.getAttribute("data-answer-id")
        if (answerId) {
          selectedIds.push(answerId)
        }
      }
    })

    // 選択状態を更新
    if (selectedIds.length > 0) {
      // 現在の選択をクリア
      selectedAnswers.forEach((id) => onAnswerSelect(id, false))
      // 新しい選択を追加
      selectedIds.forEach((id) => onAnswerSelect(id, true))
    }
  }

  return (
    <div className={`flex h-full min-w-0 flex-col ${className}`}>
      {/* 答案グリッド */}
      <div
        ref={gridRef}
        className={`grid min-w-0 gap-2 p-1 select-none ${
          layoutDirection === "down-right" || layoutDirection === "down-left"
            ? "h-full"
            : "h-auto"
        }`}
        style={{
          gridTemplateColumns:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? `repeat(${Math.ceil(answers.length / effectiveGridSize.rows)}, 200px)` // 固定幅
              : `repeat(${effectiveGridSize.columns}, 1fr)`,
          gridTemplateRows:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? `repeat(${effectiveGridSize.rows}, 1fr)`
              : "none",
          gridAutoRows: "auto",
          gridAutoFlow:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "column"
              : "row",
          width: "100%",
          maxWidth: "100%", // 重要: 最大幅を強制制限
          overflowX:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "auto"
              : "hidden",
          overflowY:
            layoutDirection === "right-down" || layoutDirection === "left-down"
              ? "auto"
              : "hidden",
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {sortedAnswers().map((answer) => {
          if (!answer) return <div key="empty" />

          const config =
            SCORE_STATUS_CONFIG[
              answer.status as keyof typeof SCORE_STATUS_CONFIG
            ] || SCORE_STATUS_CONFIG.ungraded
          const Icon = config.icon
          const isSelected = selectedAnswers.has(answer.id)
          const isCurrentAnswer = currentAnswerId === answer.id
          const isMaster = answer.isMaster

          return (
            <div
              key={answer.id}
              data-answer-id={answer.id}
              className={`relative flex-shrink-0 p-2 transition-all duration-150 ${
                layoutDirection === "down-right" ||
                layoutDirection === "down-left"
                  ? "flex h-full flex-col"
                  : ""
              } ${isMaster ? "cursor-default border-2 border-black bg-white" : `cursor-pointer hover:shadow-md ${config.bgColor || "bg-white"}`} ${isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""} ${isCurrentAnswer ? "shadow-lg ring-2 ring-orange-500 ring-offset-1" : ""} ${!isMaster ? config.borderColor : ""} ${!isMaster && isSelected ? config.selectedBgColor : ""}`}
              onMouseDown={(e) => handleMouseDown(e, answer.id)}
            >
              {/* 答案画像 */}
              <div
                className={`mb-1 overflow-hidden ${
                  layoutDirection === "down-right" ||
                  layoutDirection === "down-left"
                    ? "flex flex-1 items-center justify-center"
                    : ""
                }`}
                style={
                  layoutDirection === "down-right" ||
                  layoutDirection === "down-left"
                    ? { minHeight: "0", height: "100%" } // flex-1が正しく動作するよう強制
                    : {}
                }
              >
                <CroppedAnswerImage
                  imageUrl={answer.imageUrl}
                  questionRegion={answer.questionRegion}
                  alt={isMaster ? "模範解答" : `${answer.studentName}の答案`}
                  className={
                    layoutDirection === "down-right" ||
                    layoutDirection === "down-left"
                      ? "h-full w-full object-contain" // 下→右: 幅高さ両方フル、比率保持
                      : "h-auto w-full" // 右→下: 幅ベース
                  }
                />
              </div>

              {/* 学生情報と採点状況 */}
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center space-x-1">
                  <span
                    className={`truncate text-xs ${isMaster ? "font-bold text-black" : "font-medium"}`}
                  >
                    {isMaster
                      ? answer.studentName
                      : showStudentNames
                        ? answer.studentName
                        : ""}
                  </span>

                  {!isMaster && answer.status !== "ungraded" && (
                    <Badge variant="outline" className="h-4 px-1 text-xs">
                      {answer.currentScore !== undefined
                        ? `${answer.currentScore}/${answer.maxScore}`
                        : answer.status === "correct" ||
                            answer.status === "final"
                          ? `${answer.maxScore}pt`
                          : answer.status === "incorrect" ||
                              answer.status === "no_answer"
                            ? "0pt"
                            : answer.status === "proposed"
                              ? "提案中"
                              : "採点中"}
                    </Badge>
                  )}

                  {isMaster && (
                    <Badge
                      variant="outline"
                      className="h-4 border-black bg-white px-1 text-xs text-black"
                    >
                      {answer.maxScore}点満点
                    </Badge>
                  )}
                </div>

                {!isMaster && (
                  <Icon
                    className={`h-3 w-3 ${config.textColor} flex-shrink-0`}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
