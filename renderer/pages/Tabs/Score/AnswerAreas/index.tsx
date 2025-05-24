import React, { useCallback, useEffect, useRef, useState } from "react"

import { type IpcRendererEvent } from "electron"
import FlexboxContainer from "../FlexboxContainer/FlexboxContainer"
import {
  type DragAction,
  type Order,
  type PartialPoint,
  PARTIALPOINTS,
  type Score,
  SCORES,
  type Show,
  SHOWS,
} from "../index.type"
import AnswerAreaComponent from "./AnswerArea"
import RectangleSelectorContainer from "./RectangleSelectorContainer"
import {
  type AnswerArea,
  type DirectionToMoveAnswerArea,
  type Move,
  MOVES,
} from "./index.type"

const AnswerAreas = (props: {
  orderOfAnswerArea: Order[]
  dragAction: DragAction
  showAnswerArea: Record<Show, boolean>
  toggleShowAnswerArea: (show: Show) => void
  setIsShowCommentWindow: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const {
    orderOfAnswerArea,
    dragAction,
    showAnswerArea,
    toggleShowAnswerArea,
    setIsShowCommentWindow,
  } = props

  // 答案データ
  const numberOfAnswerAreas = 120
  const DEFAULT_MAX_POINTS = 4
  const defaultAnswerAreas = [...Array(numberOfAnswerAreas).keys()].map((v) => {
    const answerArea: AnswerArea = {
      isSelected: v === 0,
      isShown: true,
      index: v,
      studentId: v.toString(),
      studentName: "0000",
      maxPoints: DEFAULT_MAX_POINTS,
      score: "unscored",
      partialPoints: null,
      cropTmp: { top: 0.2, bottom: 0.3, left: 0.2, right: 0.3 },
    }
    return answerArea
  })

  // Move
  const [numberOfItemsInRow, setNumberOfItemsInRow] = useState(0)
  const [numberOfItemsInColumn, setNumberOfItemsInColumn] = useState(0)
  const [answerAreas, setAnswerAreas] =
    useState<AnswerArea[]>(defaultAnswerAreas)
  const [isShowStudentName, setIsShowStudentName] = useState(true)

  const handleItemsChange = (items: {
    numberOfItemsInRow: number
    numberOfItemsInColumn: number
  }): void => {
    setNumberOfItemsInRow(items.numberOfItemsInRow)
    setNumberOfItemsInColumn(items.numberOfItemsInColumn)
  }

  const moveSelectedAnswerArea = useCallback(
    (directionToMoveAnswerArea: DirectionToMoveAnswerArea): void => {
      const shownAnswerAreas = answerAreas.filter(
        (answerArea) => answerArea.isShown,
      )
      if (shownAnswerAreas.length !== 0) {
        setAnswerAreas((prevAnswerAreas) => {
          const minIndex =
            prevAnswerAreas.find(
              (answerArea) =>
                answerArea.isSelected && answerArea.index !== null,
            )?.index ?? null
          const maxIndex =
            prevAnswerAreas.findLast(
              (answerArea) =>
                answerArea.isSelected && answerArea.index !== null,
            )?.index ?? null
          if (minIndex === null || maxIndex === null) return prevAnswerAreas

          const newAnswerAreas = prevAnswerAreas.map((answerArea) => ({
            ...answerArea,
            isSelected: false,
          }))
          const setIndex: Record<DirectionToMoveAnswerArea, number> = {
            prev: Math.max(minIndex - 1, 0),
            next: Math.min(maxIndex + 1, shownAnswerAreas.length - 1),
            prevRow: Math.max(minIndex - numberOfItemsInRow, 0),
            nextRow: Math.min(
              maxIndex + numberOfItemsInRow,
              shownAnswerAreas.length - 1,
            ),
            prevColumn: Math.max(minIndex - numberOfItemsInColumn, 0),
            nextColumn: Math.min(
              maxIndex + numberOfItemsInColumn,
              shownAnswerAreas.length - 1,
            ),
          }

          const newSelectedIndex = setIndex[directionToMoveAnswerArea]
          scrollToElement(newSelectedIndex)
          return newAnswerAreas.map((answerArea) => ({
            ...answerArea,
            isSelected: answerArea.index === newSelectedIndex,
          }))
        })
      }
    },
    [answerAreas, numberOfItemsInRow, numberOfItemsInColumn],
  )
  const handleMovePress = useCallback(
    (move: Move): void => {
      const setIndexInOrder: Record<
        number,
        Record<Move, DirectionToMoveAnswerArea>
      > = {
        0: { left: "prev", right: "next", up: "prevRow", down: "nextRow" },
        1: { left: "next", right: "prev", up: "prevRow", down: "nextRow" },
        2: {
          left: "prevColumn",
          right: "nextColumn",
          up: "prev",
          down: "next",
        },
        3: {
          left: "nextColumn",
          right: "prevColumn",
          up: "prev",
          down: "next",
        },
      }
      const isSelectedOrderIndex = orderOfAnswerArea.findIndex(
        (v) => v.isSelected,
      )
      const directionToMoveAnswerArea =
        setIndexInOrder[isSelectedOrderIndex][move]
      moveSelectedAnswerArea(directionToMoveAnswerArea)
    },
    [moveSelectedAnswerArea, orderOfAnswerArea],
  )

  // Score
  const scoreAnswerArea = useCallback(
    (score: Score): void => {
      const newAnswerAreas = answerAreas.map((answerArea) => {
        const newAnswerArea = answerArea
        if (answerArea.isSelected) {
          newAnswerArea.score = score
          if (
            ["unscored", "correct", "incorrect", "noanswer"].includes(score)
          ) {
            newAnswerArea.partialPoints = null
          }
        }
        return newAnswerArea
      })
      setAnswerAreas(newAnswerAreas)
      moveSelectedAnswerArea("next")
    },
    [answerAreas, moveSelectedAnswerArea],
  )

  // Reload
  const reload = useCallback(() => {
    setAnswerAreas((prevAnswerAreas) => {
      let index = 0
      const newAnswerAreas = prevAnswerAreas.map((answerArea) => {
        const isShown = showAnswerArea[`toggle-show-${answerArea.score}`]
        answerArea.isShown = isShown
        answerArea.isSelected = false
        answerArea.index = null
        if (isShown) {
          if (index === 0) {
            answerArea.isSelected = true
          }
          answerArea.index = index
          index += 1
        }
        return answerArea
      })
      return newAnswerAreas
    })
  }, [showAnswerArea])

  useEffect(() => {
    reload()
  }, [reload, showAnswerArea])

  // Show
  const showAnswerAreas = useCallback(
    (show: Show): void => {
      toggleShowAnswerArea(show)
    },
    [toggleShowAnswerArea],
  )

  // PartialPoint
  const setPartialPoint = useCallback((partialPoint: PartialPoint) => {
    setAnswerAreas((prevAnswerAreas) => {
      const newAnswerAreas = [...prevAnswerAreas]
      return newAnswerAreas.map((answerArea) => {
        if (answerArea.isSelected) {
          answerArea.score = "partial"
          answerArea.partialPoints =
            partialPoint === "partial-point-backspace"
              ? null
              : Number(
                  (answerArea.partialPoints ?? "") +
                    partialPoint.replace("partial-point-", ""),
                )
          if ((answerArea.partialPoints?.toString().length ?? 0) > 3) {
            answerArea.partialPoints = null
          }
        }
        return answerArea
      })
    })
  }, [])

  // SelectAll
  const selectAll = useCallback(() => {
    setAnswerAreas((prevAnswerAreas) => {
      const newAnswerArea = prevAnswerAreas.map((answerArea) => {
        answerArea.isSelected = answerArea.isShown
        return answerArea
      })
      return newAnswerArea
    })
  }, [])

  const refs = useRef<Array<HTMLDivElement | null>>([])

  const scrollToElement = (index: number): void => {
    const ref = refs.current[index]
    if (ref !== null) {
      ref.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      })
    }
  }

  const setRef = (index: number) => (el: HTMLDivElement | null) => {
    refs.current[index] = el
  }

  useEffect(() => {
    const listener = (_event: IpcRendererEvent, value: string): void => {
      if (MOVES.includes(value as Move)) {
        handleMovePress(value as Move)
      } else if (SCORES.includes(value as Score)) {
        scoreAnswerArea(value as Score)
      } else if (SHOWS.includes(value as Show)) {
        showAnswerAreas(value as Show)
      } else if (PARTIALPOINTS.includes(value as PartialPoint)) {
        setPartialPoint(value as PartialPoint)
      } else if (value === "select-all") {
        selectAll()
      } else if (value === "reload") {
        reload()
      } else if (value === "comment") {
        setIsShowCommentWindow((prev) => !prev)
      } else if (value === "studentName") {
        setIsShowStudentName((prev) => !prev)
      }
    }

    window.electronAPI.scorePanel(listener)
    return () => {
      window.electronAPI.removeScorePanelListener(listener)
    }
  }, [
    answerAreas,
    handleMovePress,
    moveSelectedAnswerArea,
    numberOfItemsInRow,
    orderOfAnswerArea,
    reload,
    scoreAnswerArea,
    selectAll,
    setIsShowCommentWindow,
    setPartialPoint,
    showAnswerAreas,
  ])
  return (
    <RectangleSelectorContainer
      dragAction={dragAction}
      setAnswerAreas={setAnswerAreas}
    >
      <FlexboxContainer
        key={orderOfAnswerArea.find((v) => v.isSelected)?.id ?? 0}
        onItemsChange={handleItemsChange}
        orderOfAnswerArea={orderOfAnswerArea}
      >
        {answerAreas.some((answerArea) => answerArea.isShown) ? (
          answerAreas.map(
            (answerArea, index) =>
              answerArea.isShown && (
                <div ref={setRef(index)} key={answerArea.studentId}>
                  <AnswerAreaComponent
                    answerArea={answerArea}
                    isShowStudentName={isShowStudentName}
                  />
                </div>
              ),
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="pb-2 text-2xl">
              表示条件を満たす答案がありません
            </div>
            <div>［採点パネル］→［表示］から表示条件を変更して下さい</div>
          </div>
        )}
      </FlexboxContainer>
    </RectangleSelectorContainer>
  )
}

export default AnswerAreas
