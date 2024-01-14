import React from "react"
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdChangeHistory,
  MdClose,
  MdCropSquare,
  MdEdit,
  MdHorizontalRule,
  MdOutlineCircle,
  MdQuestionMark,
  MdRefresh,
} from "react-icons/md"
import { SCORES, SHOWS, type Show } from "../index.type"

const ScorePanel = (props: {
  showAnswerArea: Record<Show, boolean>
  toggleShowAnswerArea: (show: Show) => void
  setIsShowCommentWindow: React.Dispatch<React.SetStateAction<boolean>>
}): JSX.Element => {
  const { showAnswerArea, toggleShowAnswerArea, setIsShowCommentWindow } = props
  const labels = [
    <>
      <MdHorizontalRule size={"1em"} />
      <div className="w-10 text-center">未採点</div>
    </>,
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
    "正答",
    "部分点",
    "保留",
    "誤答",
    "無答",
  ]
  return (
    <div className="flex min-w-full select-none overflow-x-auto bg-slate-100 py-2 shadow-md">
      <div className="flex flex-col justify-between px-4">
        <div className="mt-1 flex h-14 w-[250px] flex-wrap justify-between">
          {SCORES.map((score, index) => {
            return (
              <div
                className={`flex h-6 w-[80px] cursor-pointer items-center justify-center border-2 border-${score}/80 text-xs shadow-md`}
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
          {SHOWS.map((show, index) => {
            return (
              <div
                key={index}
                onClick={() => {
                  toggleShowAnswerArea(show)
                }}
                className={`flex h-6 w-[80px] cursor-pointer items-center justify-center text-xs ${
                  showAnswerArea[show]
                    ? `border-${SCORES[index]}/80 border-2 shadow-md`
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
