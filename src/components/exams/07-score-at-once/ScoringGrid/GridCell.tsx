import {
  getDynamicScoreStatusConfig,
  type ScoreStatusKey,
} from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import type { GridAnswerItem } from "@/components/exams/07-score-at-once/ScoringGrid/types/gridTypes"
import CroppedAnswerImage from "@/components/exams/07-score-at-once/ScoringMain/CroppedAnswerImage"
import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"
import type { ScoringStatusColors } from "@/lib/scoringStatusColors"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

const VALID_STATUS_KEYS: ScoreStatusKey[] = [
  "unscored",
  "correct",
  "partial",
  "pending",
  "incorrect",
  "no_answer",
  "double_mark",
  "master",
]

const isValidStatusKey = (status: string): status is ScoreStatusKey =>
  VALID_STATUS_KEYS.includes(status as ScoreStatusKey)

interface GridCellProps {
  answer: GridAnswerItem
  isSelected: boolean
  showStudentNames: boolean
  layoutDirection: LayoutDirection
  calculatedCellHeight: number
  selectionBorderColor: string
  scoringColors: ScoringStatusColors
  expandMargin?: number
  annotations?: DrawingAnnotation[]
  pageSize?: string
  onMouseDown: (e: React.MouseEvent, answerId: string) => void
}

export function GridCell({
  answer,
  isSelected,
  showStudentNames,
  layoutDirection,
  calculatedCellHeight,
  selectionBorderColor,
  scoringColors,
  expandMargin,
  annotations,
  pageSize,
  onMouseDown,
}: GridCellProps) {
  const statusConfig = getDynamicScoreStatusConfig(scoringColors)
  const statusKey: ScoreStatusKey = isValidStatusKey(answer.status)
    ? answer.status
    : "unscored"
  const config = statusConfig[statusKey]
  const Icon = config.icon
  const isMaster =
    answer.studentId === "MASTER" || answer.studentName === "模範解答"

  // 基本のセルクラス
  const cellClasses = ["flex shrink-0 flex-col gap-1 p-2 border-2"]

  // スタイルを構築
  let cellBgStyle: React.CSSProperties = {}

  if (isMaster) {
    cellClasses.push("border-black bg-white")
  } else {
    if (isSelected) {
      cellBgStyle = {
        ...config.selectedBgStyle,
        borderColor: selectionBorderColor,
      }
    } else {
      cellBgStyle = {
        ...config.bgStyle,
        borderColor: "transparent",
      }
      cellClasses.push("border-transparent")
    }
  }

  const getScoreDisplay = () => {
    if (answer.status === "correct") {
      return `${answer.maxScore}/${answer.maxScore}`
    }
    if (answer.status === "incorrect" || answer.status === "no_answer") {
      return `0/${answer.maxScore}`
    }
    if (answer.status === "partial" || answer.status === "pending") {
      return answer.currentScore !== null && answer.currentScore !== undefined
        ? `${answer.currentScore}/${answer.maxScore}`
        : `-/${answer.maxScore}`
    }
    return "採点中"
  }

  const isColumnLayout =
    layoutDirection === "down-right" || layoutDirection === "down-left"

  // 列レイアウト時は明示的に高さを設定、背景色・ボーダー色を適用
  const cellStyle: React.CSSProperties = {
    ...(isColumnLayout && {
      height: calculatedCellHeight,
      maxHeight: calculatedCellHeight,
      overflow: "hidden",
    }),
    ...(layoutDirection === "down-left" && {
      direction: "ltr" as const,
    }),
    ...cellBgStyle,
  }

  return (
    <div
      data-answer-id={answer.id}
      className={cellClasses.join(" ")}
      style={cellStyle}
      onMouseDown={(e) => onMouseDown(e, answer.id)}
    >
      {/* 答案画像 */}
      <CroppedAnswerImage
        imageUrl={answer.imageUrl}
        cropRegion={answer.questionRegion}
        alt={isMaster ? "模範解答" : `${answer.studentName}の答案`}
        className={
          isColumnLayout
            ? "h-full w-auto flex-1" // 列表示: 高さ目一杯、幅は縦横比で自動、余白占有
            : "h-auto w-full" // 行表示: 幅目一杯、高さは縦横比で自動
        }
        isColumnLayout={isColumnLayout}
        calculatedCellHeight={calculatedCellHeight}
        isSelected={isSelected}
        expandMargin={expandMargin}
        annotations={annotations}
        pageSize={pageSize}
      />

      {/* 学生情報と採点状況 */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center space-x-1">
          <span
            title={
              isMaster || showStudentNames ? answer.studentName : undefined
            }
            className={`block max-w-full truncate text-xs ${
              isMaster ? "font-bold text-black" : "font-medium"
            }`}
            style={isMaster ? undefined : config.textStyle}
          >
            {isMaster
              ? answer.studentName
              : showStudentNames
                ? answer.studentName
                : ""}
          </span>

          {!isMaster && answer.status !== "unscored" && (
            <Badge variant="outline" className="h-4 px-1 text-xs">
              {getScoreDisplay()}
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
          <Icon className="h-3 w-3 shrink-0" style={config.iconStyle} />
        )}
      </div>
    </div>
  )
}
