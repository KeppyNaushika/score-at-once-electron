import React, { useEffect, useState } from "react"
import ScorePanel from "./ScorePanel/ScorePanel"
import QuestionPanel from "./QuestionPanel/QuestionPanel"
import AnswerAreas from "./AnswerAreas"
import CommentWindow from "./CommentWindow"
import {
  type DragAction,
  SHOWS,
  type Show,
  type Order,
  dragActions,
} from "./index.type"

const orders: Order[] = [
  { id: 0, className: "flex-row flex-wrap", isSelected: true },
  { id: 1, className: "flex-row-reverse flex-wrap", isSelected: false },
  { id: 2, className: "flex-col flex-wrap", isSelected: false },
  { id: 3, className: "flex-col flex-wrap-reverse", isSelected: false },
]

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

  const [isShowCommentWindow, setIsShowCommentWindow] = useState(false)

  useEffect(() => {
    window.electronAPI.setShortcut("score")
  }, [orderOfAnswerArea])

  return (
    <>
      {isShowCommentWindow && (
        <CommentWindow setIsShowCommentWindow={setIsShowCommentWindow} />
      )}
      <div className="flex min-w-full grow flex-col">
        <ScorePanel
          showAnswerArea={showAnswerArea}
          toggleShowAnswerArea={toggleShowAnswerArea}
          setIsShowCommentWindow={setIsShowCommentWindow}
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
          setIsShowCommentWindow={setIsShowCommentWindow}
        />
      </div>
    </>
  )
}

export default ScoreTab
