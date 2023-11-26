import React, { useEffect, useState } from "react"
import ScorePanel from "../score/ScorePanel"
import QuestionPanel from "../score/QuestionPanel"
import AnswerAreas from "../score/AnswerAreas"

export type Id = string
export type ExamId = Id
export type SheetId = Id
export type QuestionId = Id
export type StudentId = Id

export interface CropCoords {
  top: number
  bottom: number
  left: number
  right: number
}

export interface Tag {
  name: string
  isEnabled: boolean
}

export interface Question {
  tags: [Tag[]]
  examId: ExamId
  questionId: QuestionId
  sheetId: SheetId
  crop: CropCoords
}

export interface Order {
  id: number
  className: string
  isSelected: boolean
}

const orders: Order[] = [
  { id: 0, className: "flex-row flex-wrap", isSelected: true },
  { id: 1, className: "flex-row-reverse flex-wrap", isSelected: false },
  { id: 2, className: "flex-col flex-wrap", isSelected: false },
  { id: 3, className: "flex-col flex-wrap-reverse", isSelected: false },
]

export const SCORES = [
  "unscored",
  "correct",
  "partial",
  "pending",
  "incorrect",
] as const
export const SHOWS = SCORES.map((score) => `toggle-show-${score}` as const)
export const PARTIALPOINTS = (
  ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "backspace"] as const
).map((v) => `partial-point-${v}` as const)
export type Score = (typeof SCORES)[number]
export type Show = (typeof SHOWS)[number]
export type PartialPoint = (typeof PARTIALPOINTS)[number]

export const dragActions = [
  "newAnswerArea",
  "addAnswerArea",
  "dragAnswerArea",
] as const
export type DragAction = (typeof dragActions)[number]

const ScoreTab = (): JSX.Element => {
  const [orderOfAnswerArea, setOrderOfAnswerArea] = useState(orders)
  const [dragAction, setDragAction] = useState<DragAction>("newAnswerArea")

  const initialShowAnswerArea: Record<Show, boolean> = Object.fromEntries(
    SHOWS.map((key) => [key, false]),
  ) as Record<Show, boolean>
  initialShowAnswerArea[SHOWS[0]] = true
  const [showAnswerArea, setShowAnswerArea] = useState(initialShowAnswerArea)

  const switchOrderOfAnswerArea = (): void => {
    setOrderOfAnswerArea((prev) => {
      const index = (prev.findIndex((v) => v.isSelected) + 1) % prev.length
      return prev.map((v, i) => ({
        ...v,
        isSelected: i === index,
      }))
    })
  }

  const switchDragAction = (): void => {
    setDragAction((prevAction) => {
      const newAction =
        dragActions[
          (dragActions.findIndex((action) => action === prevAction) + 1) %
            dragActions.length
        ]
      return newAction
    })
  }

  const toggleShowAnswerArea = (show: Show): void => {
    setShowAnswerArea((prevShowAnswerArea) => {
      const newShowAnswerArea = { ...prevShowAnswerArea }
      newShowAnswerArea[show] = !newShowAnswerArea[show]
      return newShowAnswerArea
    })
  }

  useEffect(() => {
    window.electronAPI.setShortcut("score")
  }, [orderOfAnswerArea])

  return (
    <div className="flex min-w-full grow flex-col">
      <ScorePanel
        showAnswerArea={showAnswerArea}
        toggleShowAnswerArea={toggleShowAnswerArea}
      />
      <QuestionPanel
        orderOfAnswerArea={orderOfAnswerArea}
        switchOrderOfAnswerArea={switchOrderOfAnswerArea}
        dragAction={dragAction}
        switchDragAction={switchDragAction}
      />
      <AnswerAreas
        orderOfAnswerArea={orderOfAnswerArea}
        dragAction={dragAction}
        showAnswerArea={showAnswerArea}
        toggleShowAnswerArea={toggleShowAnswerArea}
      />
    </div>
  )
}

export default ScoreTab
