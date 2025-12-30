import { SCORE_STATUS_CONFIG } from "@/components/projects/07-score-at-once/ScoringGrid/constants/score-status-config"
import type { GridAnswerItem } from "@/components/projects/07-score-at-once/ScoringGrid/types/grid-types"
import CroppedAnswerImage from "@/components/projects/07-score-at-once/ScoringMain/CroppedAnswerImage"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"

const SCORE_STATUS_KEYS = Object.keys(SCORE_STATUS_CONFIG) as Array<
  keyof typeof SCORE_STATUS_CONFIG
>

type ScoreStatusConfig =
  (typeof SCORE_STATUS_CONFIG)[keyof typeof SCORE_STATUS_CONFIG]

const isScoreStatusKey = (
  status: keyof typeof SCORE_STATUS_CONFIG
): status is keyof typeof SCORE_STATUS_CONFIG =>
  SCORE_STATUS_KEYS.includes(status)

interface GridCellProps {
  answer: GridAnswerItem
  isSelected: boolean
  showStudentNames: boolean
  layoutDirection: LayoutDirection
  calculatedCellHeight: number
  selectionBorderSettings: {
    tailwindClass: string
  }
  onMouseDown: (e: React.MouseEvent, answerId: string) => void
}

export function GridCell({
  answer,
  isSelected,
  showStudentNames,
  layoutDirection,
  calculatedCellHeight,
  selectionBorderSettings,
  onMouseDown,
}: GridCellProps) {
  const statusKey: keyof typeof SCORE_STATUS_CONFIG = isScoreStatusKey(
    answer.status
  )
    ? answer.status
    : "unscored"
  const config: ScoreStatusConfig =
    SCORE_STATUS_CONFIG[statusKey] ?? SCORE_STATUS_CONFIG.unscored
  const Icon = config.icon
  const isMaster =
    answer.studentId === "MASTER" || answer.studentName === "模範解答"

  const cellClasses = ["flex flex-shrink-0 flex-col gap-1 p-2"]

  if (isMaster) {
    cellClasses.push("border-2 border-black bg-white")
  } else {
    cellClasses.push("border-2")
    if (isSelected) {
      cellClasses.push(
        selectionBorderSettings.tailwindClass,
        config.selectedBgColor
      )
    } else {
      cellClasses.push(config.borderColor, config.bgColor ?? "bg-white")
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

  // 列レイアウト時は明示的に高さを設定
  const cellStyle: React.CSSProperties = isColumnLayout
    ? {
        height: calculatedCellHeight,
        maxHeight: calculatedCellHeight,
        overflow: "hidden",
      }
    : {}

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
          <Icon className={`h-3 w-3 ${config.textColor} shrink-0`} />
        )}
      </div>
    </div>
  )
}
