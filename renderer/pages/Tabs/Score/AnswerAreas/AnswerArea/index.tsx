import { type AnswerArea } from "../index.type"

const AnswerAreaComponent = (props: {
  answerArea: AnswerArea
  isShowStudentName: boolean
}) => {
  const { answerArea, isShowStudentName } = props
  const borderColor = `bg-${answerArea.score}`
  const bgColor = answerArea.isSelected ? "bg-selectedAnswer" : "bg-gray-100"
  const point = ((answerArea: AnswerArea) => {
    const point = {
      text: (answerArea.partialPoints ?? "-").toString(),
      color: "bg-white",
    }
    if (answerArea.score === "unscored") {
      point.text = "-"
    } else if (answerArea.score === "correct") {
      point.text = answerArea.maxPoints.toString()
    } else if (answerArea.score === "incorrect") {
      point.text = "0"
    } else {
      if (answerArea.partialPoints === null) {
        point.color = "bg-partial"
      } else if (
        answerArea.partialPoints !== null &&
        answerArea.partialPoints > answerArea.maxPoints
      ) {
        point.color = "bg-red-500"
      }
    }
    return point
  })(answerArea)

  return (
    <div className="flex self-start">
      <div
        className={`ml-2 mt-2 p-1 ${borderColor}`}
        id={`answer-${answerArea.studentId}`}
      >
        <div className={`p-1 ${bgColor}`}>
          <div className="mb-1 text-center text-xs">
            {isShowStudentName ? answerArea.studentName : " "}
          </div>
          <div className="size-24 bg-white">{answerArea.studentId}</div>
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
