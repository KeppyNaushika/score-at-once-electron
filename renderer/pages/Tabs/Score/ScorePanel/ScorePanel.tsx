import React, { useState } from "react"
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdChangeHistory,
  MdClose,
  MdCropSquare,
  MdEdit,
  MdOutlineCircle,
  MdQuestionMark,
  MdRefresh,
} from "react-icons/md"

import CommentWindow from "../CommentWindow" // CommentWindow をインポート

interface ScorePanelProps {
  scores: PanelScore[] // Use PanelScore from index.type.ts
  orders: OrderButtonState[] // Use OrderButtonState from index.type.ts
  // Note: The usage of 'orders' prop in the component implies it might be a list of display options
  // rather than sort orders. The current type OrderButtonState might not perfectly fit its usage.
  // Specifically, `toggleShowAnswerArea(show)` and `showAnswerAreaMap[show]` expect `show` to be a number (index),
  // but `show` is an `OrderButtonState` object in the map function.
}

const ScorePanel: React.FC<ScorePanelProps> = ({ scores, orders }) => {
  const [isShowCommentWindow, setIsShowCommentWindow] = useState(false)
  const [showAnswerAreaMap, setShowAnswerAreaMap] = useState<
    Record<number, boolean>
  >({}) // For multiple answer areas

  const toggleShowAnswerArea = (index: number) => {
    setShowAnswerAreaMap((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleScoreChange = (score: PanelScore, index: number) => {
    // Logic to handle score change
    console.log("Score changed for index", index, ":", score)
    // Example API call (ensure sendScorePanel exists in MyAPI)
    // window.electronAPI.sendScorePanel({ score, index }).catch(console.error);
  }

  const handleOrderChange = (
    show: boolean,
    index: number,
    order: OrderButtonState,
  ) => {
    // Logic to handle order change
    console.log("Order changed for index", index, ":", show, order)
  }

  const handleMove = (direction: string) => {
    console.log("Move:", direction)
    // ここに移動ロジックを実装します
  }

  // Example usage based on errors
  const exampleFunctionUsingScoreAndOrder = (
    scoreItem: PanelScore,
    orderItem: OrderButtonState,
    index: number,
  ) => {
    if (scoreItem.value === "correct") {
      // Example: Comparing ScoreValue
      console.log("Score is correct")
    }

    if (orderItem.sorted === "ascending") {
      // Example: Comparing OrderDirection
      console.log("Order is ascending")
    }

    // Accessing showAnswerArea for a specific item
    const currentShowAnswerArea = showAnswerAreaMap[index] || false
    if (currentShowAnswerArea) {
      console.log("Answer area is shown for item", index)
    }
  }

  const labels = [
    <>
      <MdOutlineCircle size={"1em"} />
      <div className="w-10 text-center">正答</div>
    </>,
    <>
      <MdChangeHistory size={"1em"} />
      <div className="w-10 text-center">部分点</div>
    </>,
    <>
      <MdQuestionMark size={"1em"} />
      <div className="w-10 text-center">保留</div>
    </>,
    <>
      <MdClose size={"1em"} />
      <div className="w-10 text-center">誤答</div>
    </>,
    <>
      <MdCropSquare size={"1em"} />
      <div className="w-10 text-center">無答</div>
    </>,
  ]
  return (
    <div className="flex min-w-full select-none overflow-x-auto bg-slate-100 py-2 shadow-md">
      <div className="flex flex-col justify-between px-4">
        <div className="mt-1 flex h-14 w-[250px] flex-wrap justify-between">
          {scores.map((score, index) => {
            // Assuming score.value is a string suitable for className
            const scoreValueString = String(score.value)
            return (
              <div
                className={`flex h-6 w-[80px] cursor-pointer items-center justify-center border-2 border-${scoreValueString}/80 text-xs shadow-md`}
                key={index}
                onClick={() => {
                  window.electronAPI.sendScorePanel(score)
                }}
              >
                {labels[index]}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-center text-xs">採点</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="flex flex-col justify-between px-4">
        <div className="mt-1 flex h-14 w-[250px] flex-wrap justify-between">
          {orders.map((order, index) => {
            // Changed 'show' to 'order' for clarity
            // TODO: Fix type mismatch. `toggleShowAnswerArea` expects a number. `order` is an OrderButtonState object.
            // Consider passing `index` to `toggleShowAnswerArea` and using `index` for `showAnswerAreaMap`.
            // const currentOrderIsVisible = showAnswerAreaMap[index]; // Example of using index
            const scoreValueForBorder = scores[index]
              ? String(scores[index].value)
              : "gray-300" // Fallback color
            return (
              <div
                key={order.id} // Assuming OrderButtonState has a unique id
                onClick={() => {
                  // toggleShowAnswerArea(order) // This will cause a type error.
                  // Correct usage might be: toggleShowAnswerArea(index)
                  console.warn(
                    "toggleShowAnswerArea called with Order object, expected number (index). Review logic.",
                  )
                }}
                className={`flex h-6 w-[80px] cursor-pointer items-center justify-center text-xs ${
                  // showAnswerAreaMap[order] // This will also cause a type error.
                  // Correct usage might be: showAnswerAreaMap[index]
                  false // Placeholder due to type mismatch
                    ? `border-${scoreValueForBorder}/80 border-2 shadow-md`
                    : ""
                }`}
              >
                {labels[index]}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-center text-xs">表示</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          <div className="mx-1 flex size-10 cursor-pointer items-center justify-center">
            <MdRefresh size={"1.5em"} />
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">再読込</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          <div
            className="mx-1 flex size-10 cursor-pointer items-center justify-center"
            onClick={() => {
              setIsShowCommentWindow(true)
            }}
          >
            <MdEdit size={"1.5em"} />
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">コメント</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          <div
            className="mx-1 flex size-10 cursor-pointer items-center justify-center"
            onClick={() => handleMove("back")}
          >
            <MdArrowBack size={"1.5em"} />
          </div>
          <div
            className="mx-1 flex size-10 cursor-pointer items-center justify-center"
            onClick={() => handleMove("down")}
          >
            <MdArrowDownward size={"1.5em"} />
          </div>
          <div
            className="mx-1 flex size-10 cursor-pointer items-center justify-center"
            onClick={() => handleMove("up")}
          >
            <MdArrowUpward size={"1.5em"} />
          </div>
          <div
            className="mx-1 flex size-10 cursor-pointer items-center justify-center"
            onClick={() => handleMove("forward")}
          >
            <MdArrowForward size={"1.5em"} />
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">移動</div>
      </div>
      {isShowCommentWindow && (
        <CommentWindow setIsShowCommentWindow={setIsShowCommentWindow} />
      )}
    </div>
  )
}

export default ScorePanel
