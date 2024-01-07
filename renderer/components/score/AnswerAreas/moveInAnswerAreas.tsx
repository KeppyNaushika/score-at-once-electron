import { useCallback, useRef, useState } from "react"
import {
  type DirectionToMoveAnswerArea,
  type AnswerArea,
  type Move,
} from "../AnswerAreas"
import { type Order } from "../../Tabs/Score"

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

const useAnswerAreaMovement = (): {
  answerAreas: AnswerArea[]
  handleItemsChange: (items: {
    numberOfItemsInRow: number
    numberOfItemsInColumn: number
  }) => void
  moveSelectedAnswerArea: (
    directionToMoveAnswerArea: DirectionToMoveAnswerArea,
  ) => void
  handleMovePress: (move: Move, orderOfAnswerArea: Order[]) => void
} => {
  // Move
  const [numberOfItemsInRow, setNumberOfItemsInRow] = useState<number>(0)
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
  const handleMovePress = useCallback(
    (move: Move, orderOfAnswerArea: Order[]): void => {
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
    [moveSelectedAnswerArea],
  )

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

  return {
    answerAreas,
    handleItemsChange,
    moveSelectedAnswerArea,
    handleMovePress,
  }
}

export default useAnswerAreaMovement
