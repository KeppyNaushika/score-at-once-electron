import { Badge } from "@/components/ui/badge"
import { SCORE_STATUS_CONFIG, type ScoringStatus } from "@/components/projects/07-score-at-once/components/answer-grid/constants/score-status-config"

interface ScoreStatusBadgeProps {
  status: ScoringStatus | "master"
  currentScore?: number
  maxScore: number
  isSelected?: boolean
}

export function ScoreStatusBadge({
  status,
  currentScore,
  maxScore,
  isSelected = false,
}: ScoreStatusBadgeProps) {
  const config = status === "master" ? SCORE_STATUS_CONFIG.master : SCORE_STATUS_CONFIG[status]
  const Icon = config.icon

  // スコア表示のロジック
  const getScoreDisplay = () => {
    if (status === "master") return ""
    if (typeof currentScore === "number") {
      return `${currentScore}/${maxScore}`
    }
    return ""
  }

  const scoreDisplay = getScoreDisplay()

  return (
    <div className="flex items-center justify-center gap-1">
      <Icon
        className={`h-4 w-4 ${config.textColor}`}
        fill={
          (status === "correct" || status === "final") && isSelected
            ? "currentColor"
            : "none"
        }
      />
      {scoreDisplay && (
        <Badge
          variant="secondary"
          className={`px-1 py-0 text-xs font-mono ${config.textColor} ${
            isSelected ? config.selectedBgColor : config.bgColor
          }`}
        >
          {scoreDisplay}
        </Badge>
      )}
    </div>
  )
}