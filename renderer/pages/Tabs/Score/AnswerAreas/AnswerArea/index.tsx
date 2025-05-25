import { type AnswerArea, ScoreValue } from "../index.type" // Assuming ScoreValue is in index.type
// Removed Score import as ScoreValue is used

// Define a type for score colors, which would come from settings
export type ScoreColorPalette = Record<ScoreValue, string> & {
  selected: string
  defaultBg: string
  overlaySymbol: string // Color for the symbol itself
}

// Define a type for overlay symbols
export type ScoreOverlaySymbols = Partial<Record<ScoreValue, string>> & {
  default: string
}

const AnswerAreaComponent = (props: {
  answerArea: AnswerArea
  isShowStudentName: boolean
  showScoreOverlay?: boolean // New prop to control overlay visibility
  scoreColors?: ScoreColorPalette // New prop for dynamic colors
  overlaySymbols?: ScoreOverlaySymbols // New prop for symbols
}) => {
  const {
    answerArea,
    isShowStudentName,
    showScoreOverlay = false, // Default to false
    // Default colors, ideally from a theme or settings context
    scoreColors = {
      unscored: "bg-gray-400",
      correct: "bg-green-500",
      incorrect: "bg-red-500",
      partial: "bg-yellow-500",
      pending: "bg-blue-500", // Color for pending
      noanswer: "bg-purple-500",
      selected: "bg-selectedAnswer",
      defaultBg: "bg-gray-100",
      overlaySymbol: "text-black", // Default color for overlay symbols
    },
    overlaySymbols = {
      correct: "✓", // Example symbols
      incorrect: "✗",
      partial: "△",
      pending: "?",
      noanswer: "Ø",
      default: "",
    },
  } = props

  const borderColorClass =
    scoreColors[answerArea.score.value] || scoreColors.unscored
  const bgColorClass = answerArea.isSelected
    ? scoreColors.selected
    : scoreColors.defaultBg

  const point = ((currentAnswerArea: AnswerArea) => {
    const p = {
      text: (currentAnswerArea.partialPoints ?? "-").toString(),
      color: "bg-white", // Default background for the point text box
    }
    // Ensure currentAnswerArea.score.value is a ScoreValue
    const scoreVal: ScoreValue = currentAnswerArea.score.value

    switch (scoreVal) {
      case "unscored":
        p.text = "-"
        break
      case "correct":
        p.text = currentAnswerArea.maxPoints.toString()
        break
      case "incorrect":
        p.text = "0"
        break
      case "pending": // Handle pending case for point text if needed
        p.text = currentAnswerArea.partialPoints?.toString() ?? "?" // Or specific text for pending
        if (currentAnswerArea.partialPoints === null) {
          p.color = scoreColors.pending // Or a specific color for pending points box
        }
        break
      case "noanswer":
        p.text = "N/A" // Or specific text for no answer
        break
      case "partial":
        // p.text is already set to partialPoints or "-"
        if (currentAnswerArea.partialPoints === null) {
          // Keep default color or set specific for null partial
        } else if (
          currentAnswerArea.partialPoints > currentAnswerArea.maxPoints
        ) {
          p.color = "bg-red-500" // Error color if points exceed max
        } else {
          // Potentially a specific color for valid partial points if different from default
          // p.color = scoreColors.partial; // if you want the box itself to be yellow
        }
        break
      default:
        // This case should not be reached if ScoreValue is correctly typed
        const exhaustiveCheck: never = scoreVal
        break
    }
    return p
  })(answerArea)

  const symbolToShow =
    overlaySymbols[answerArea.score.value] ?? overlaySymbols.default

  return (
    <div className="flex self-start">
      <div
        className={`ml-2 mt-2 p-1 ${borderColorClass}`}
        id={`answer-${answerArea.studentId}`}
      >
        <div className={`relative p-1 ${bgColorClass}`}>
          {" "}
          {/* Added relative for overlay positioning */}
          <div className="mb-1 text-center text-xs">
            {isShowStudentName ? answerArea.studentName : " "}
          </div>
          <div className="relative size-24 bg-white">
            {" "}
            {/* This would be the image container */}
            {/* Placeholder for the actual answer image */}
            <div className="flex size-full items-center justify-center text-gray-400">
              {answerArea.studentId} (Image Area)
            </div>
            {showScoreOverlay && symbolToShow && (
              <div
                className={`absolute inset-0 flex items-center justify-center text-4xl font-bold opacity-75 ${scoreColors.overlaySymbol}`}
              >
                {symbolToShow}
              </div>
            )}
          </div>
          <div className="flex justify-center pt-1">
            <div
              className={`w-10 rounded-sm text-center text-xs ${point.color}`}
            >
              {point.text}
            </div>
            <div className="pl-1 text-xs">点</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnswerAreaComponent
