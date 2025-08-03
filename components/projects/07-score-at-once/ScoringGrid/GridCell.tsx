import { SCORE_STATUS_CONFIG } from "@/components/projects/07-score-at-once/ScoringGrid/constants/score-status-config"
import type { GridAnswerItem } from "@/components/projects/07-score-at-once/ScoringGrid/types/grid-types"
import CroppedAnswerImage from "@/components/projects/07-score-at-once/ScoringMain/CroppedAnswerImage"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { Badge } from "@/components/ui/badge"

interface GridCellProps {
  answer: GridAnswerItem
  isSelected: boolean
  showStudentNames: boolean
  layoutDirection: LayoutDirection
  itemsPerRow: number
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
  itemsPerRow,
  selectionBorderSettings,
  onMouseDown,
}: GridCellProps) {
  const config =
    SCORE_STATUS_CONFIG[answer.status as keyof typeof SCORE_STATUS_CONFIG] ||
    SCORE_STATUS_CONFIG.unscored
  const Icon = config.icon
  const isMaster =
    answer.studentId === "MASTER" || answer.studentName === "模範解答"

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

  return (
    <div
      data-answer-id={answer.id}
      className={`flex flex-shrink-0 flex-col gap-1 p-2 ${
        isMaster
          ? "border-2 border-black bg-white"
          : `${config.bgColor || "bg-white"}`
      } ${!isMaster ? config.borderColor : ""} ${
        !isMaster
          ? isSelected
            ? `border-2 ${selectionBorderSettings.tailwindClass}`
            : "border-2 border-transparent"
          : ""
      }`}
      onMouseDown={(e) => onMouseDown(e, answer.id)}
    >
      {/* 答案画像 */}
      <CroppedAnswerImage
        imageUrl={answer.imageUrl}
        cropRegion={answer.questionRegion}
        alt={isMaster ? "模範解答" : `${answer.studentName}の答案`}
        className={
          layoutDirection === "down-right" || layoutDirection === "down-left"
            ? "h-full w-auto flex-1" // 列表示: 高さ目一杯、幅は縦横比で自動、余白占有
            : "h-auto w-full" // 行表示: 幅目一杯、高さは縦横比で自動
        }
        isColumnLayout={
          layoutDirection === "down-right" || layoutDirection === "down-left"
        }
        itemsPerRow={itemsPerRow}
        isSelected={isSelected}
      />

      {/* 学生情報と採点状況 */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center space-x-1">
          <span
            className={`truncate text-xs ${
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
          <Icon className={`h-3 w-3 ${config.textColor} flex-shrink-0`} />
        )}
      </div>
    </div>
  )
}
