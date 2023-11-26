import React from "react"
import { type Show } from "../../pages/score"

const ScorePanel = (props: {
  showAnswerArea: Record<Show, boolean>
  toggleShowAnswerArea: (show: Show) => void
}): JSX.Element => {
  const { showAnswerArea, toggleShowAnswerArea } = props
  return (
    <div className="flex min-w-full select-none overflow-x-auto bg-slate-100 py-2 shadow-md">
      <div className="flex flex-col px-4">
        <div className="mt-1 flex">
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-unscored/50 shadow-md">
            -
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-correct/50 shadow-md">
            ○
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-partial/50 shadow-md">
            △
          </div>
          <div className="border-hold/50 mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 shadow-md">
            ？
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-incorrect/50 shadow-md">
            ✕
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">採点</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          {Object.keys(showAnswerArea).map((showKey, index) => {
            const show = showKey as Show
            const symbols = ["-", "○", "△", "？", "✕"]
            return (
              <div
                key={index}
                onClick={() => {
                  toggleShowAnswerArea(show)
                }}
                className={`mx-1 flex h-10 w-10 cursor-pointer items-center justify-center ${
                  showAnswerArea[show]
                    ? "border-gray/50 border-2 shadow-md"
                    : ""
                }`}
              >
                {symbols[index]}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-center text-xs">表示</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            ←
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            ↓
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            ↑
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            →
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">移動</div>
      </div>
    </div>
  )
}

export default ScorePanel
