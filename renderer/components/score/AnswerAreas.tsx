import React, { useRef, useCallback, useEffect, useState } from "react"
import FlexboxContainer from "./FlexboxContainer"
import { type IpcRendererEvent } from "electron"
import {
  type DragAction,
  type Order,
  type Score,
  type Show,
  type PartialPoint,
  SCORES,
  SHOWS,
  PARTIALPOINTS,
  type CropCoords,
  type StudentId,
} from "../../pages/score"
import AnswerAreaComponent from "./AnswerAreas/AnswerArea"
import RectangleSelectorContainer from "./AnswerAreas/RectangleSelectorContainer"

const MOVES = ["left", "right", "up", "down"] as const
const DIRECTION_TO_MOVE_ANSWER_AREA = [
  "prev",
  "next",
  "prevRow",
  "nextRow",
  "prevColumn",
  "nextColumn",
] as const
type Move = (typeof MOVES)[number]
type DirectionToMoveAnswerArea = (typeof DIRECTION_TO_MOVE_ANSWER_AREA)[number]

export interface AnswerArea {
  isSelected: boolean
  isShown: boolean
  index: number | null
  studentId: StudentId
  studentName: string
  maxPoints: number
  score: Score
  partialPoints: number | null
  cropTmp: CropCoords
}

const AnswerAreas = (props: {
  orderOfAnswerArea: Order[]
  dragAction: DragAction
  showAnswerArea: Record<Show, boolean>
  toggleShowAnswerArea: (show: Show) => void
}): JSX.Element => {
  const {
    orderOfAnswerArea,
    dragAction,
    showAnswerArea,
    toggleShowAnswerArea,
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
  const movePress = useCallback(
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
          if (["unscored", "correct", "incorrect"].includes(score)) {
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

  useEffect(() => {
    setAnswerAreas((prevAnswerAreas) => {
      let index = 0
      const newAnswerAreas = [...prevAnswerAreas].map((answerArea) => {
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
    setAnswerAreas((prevAnswerArea) => {
      const newAnswerArea = [...prevAnswerArea].map((answerArea) => {
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

  useEffect(() => {
    const listener = (_event: IpcRendererEvent, value: string): void => {
      if (MOVES.includes(value as Move)) {
        movePress(value as Move)
      } else if (SCORES.includes(value as Score)) {
        scoreAnswerArea(value as Score)
      } else if (SHOWS.includes(value as Show)) {
        showAnswerAreas(value as Show)
      } else if (PARTIALPOINTS.includes(value as PartialPoint)) {
        setPartialPoint(value as PartialPoint)
      } else if (value === "select-all") {
        selectAll()
      }
    }

    window.electronAPI.scorePanel(listener)
    return () => {
      window.electronAPI.removeScorePanelListener(listener)
    }
  }, [
    answerAreas,
    movePress,
    moveSelectedAnswerArea,
    numberOfItemsInRow,
    orderOfAnswerArea,
    scoreAnswerArea,
    selectAll,
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
        {answerAreas.map((answerArea, index) => {
          return answerArea.isShown ? (
            <div
              ref={(el) => (refs.current[index] = el)}
              key={answerArea.studentId}
            >
              <AnswerAreaComponent answerArea={answerArea} />
            </div>
          ) : (
            <></>
          )
        })}
      </FlexboxContainer>
    </RectangleSelectorContainer>
  )
}

export default AnswerAreas