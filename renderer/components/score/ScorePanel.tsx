import React from "react"
import { type Show } from "..//Tabs/Score"
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdChangeHistory,
  MdClose,
  MdEdit,
  MdHorizontalRule,
  MdOutlineCircle,
  MdQuestionMark,
  MdRefresh,
} from "react-icons/md"

const ScorePanel = (props: {
  showAnswerArea: Record<Show, boolean>
  toggleShowAnswerArea: (show: Show) => void
  setIsShowCommentWindow: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element => {
  const { showAnswerArea, toggleShowAnswerArea, setIsShowCommentWindow } = props
  return (
    <div className="flex min-w-full select-none overflow-x-auto bg-slate-100 py-2 shadow-md">
      <div className="flex flex-col px-4">
        <div className="mt-1 flex">
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-unscored/50 shadow-md">
            <MdHorizontalRule size={"1.5em"} />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-correct/50 shadow-md">
            <MdOutlineCircle size={"1.5em"} />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-partial/50 shadow-md">
            <MdChangeHistory size={"1.5em"} />
          </div>
          <div className="border-hold/50 mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 shadow-md">
            <MdQuestionMark size={"1.5em"} />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-incorrect/50 shadow-md">
            <MdClose size={"1.5em"} />
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">採点</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          {Object.keys(showAnswerArea).map((showKey, index) => {
            const show = showKey as Show
            const symbols = [
              <MdHorizontalRule size={"1.5em"} key={0} />,
              <MdOutlineCircle size={"1.5em"} key={1} />,
              <MdChangeHistory size={"1.5em"} key={2} />,
              <MdQuestionMark size={"1.5em"} key={3} />,
              <MdClose size={"1.5em"} key={4} />,
            ]
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
            <MdRefresh size={"1.5em"} />
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">再読込</div>
      </div>
      <div className="border-l-2 border-stone-200"></div>
      <div className="mt-1 flex flex-col px-4">
        <div className="flex">
          <div
            className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center"
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
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            <MdArrowBack size={"1.5em"} />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            <MdArrowDownward size={"1.5em"} />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            <MdArrowUpward size={"1.5em"} />
          </div>
          <div className="mx-1 flex h-10 w-10 cursor-pointer items-center justify-center">
            <MdArrowForward size={"1.5em"} />
          </div>
        </div>
        <div className="mt-1 flex justify-center text-xs">移動</div>
      </div>
    </div>
  )
}

export default ScorePanel
