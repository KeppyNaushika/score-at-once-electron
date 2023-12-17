import React, { useState } from "react"
import { dragActions, type DragAction, type Order } from "..//Tabs/Score"
// import arrow0 from "../../../public/images/arrows/arrow0.png"
// import arrow1 from "../../../public/images/arrows/arrow1.png"
// import arrow2 from "../../../public/images/arrows/arrow2.png"
// import arrow3 from "../../../public/images/arrows/arrow3.png"

const QuestionList = (): JSX.Element => {
  const [dragAction, setDragAction] = useState(false)

  const QuestionChoice = (): JSX.Element => (
    <div className="absolute top-8 z-50 w-full animate-float-in px-2">
      <div className=" rounded-md border-2 border-black bg-white/90 shadow-md">
        <div className="border-black px-10 py-1">設問１</div>
        {[...Array(10).keys()].map((v, index) => (
          <div key={index} className="border-t-2 border-black px-10 py-1">
            設問{index + 3}
          </div>
        ))}
      </div>
    </div>
  )
  const handleClickQuestion = (): void => {
    setDragAction((prev) => !prev)
  }
  return (
    <>
      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-black text-sm">
        ←
      </div>
      <div className="relative mx-2">
        <div
          onClick={handleClickQuestion}
          className="mx-2 flex items-center rounded-md border-2 border-black shadow-md"
        >
          <div className="min-w-[300px] px-10">設問２</div>
          <div className="pr-2 text-xs">▼</div>
        </div>
        {dragAction && <QuestionChoice />}
      </div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-black text-sm">
        →
      </div>
    </>
  )
}

const DragActionSwitch = (props: {
  dragAction: DragAction
  switchDragAction: () => void
}): JSX.Element => {
  const SelectedDragActionBg = {
    [dragActions[0]]: "-translate-x-16",
    [dragActions[1]]: "",
    [dragActions[2]]: "translate-x-16",
  }

  return (
    <div className="flex flex-col items-center px-8">
      <div
        className="relative flex h-5 w-48 items-center justify-center rounded-full shadow-md"
        onClick={props.switchDragAction}
      >
        <div
          className={`absolute flex h-full w-16 rounded-full bg-primary/50 transition-all duration-200 ${
            SelectedDragActionBg[props.dragAction]
          }`}
        ></div>
        <div className="absolute flex justify-around">
          <div className="w-12 text-center text-xs">新規選択</div>
          <div className="w-4"></div>
          <div className="w-12 text-center text-xs">追加選択</div>
          <div className="w-4"></div>
          <div className="w-12 text-center text-xs">答案移動</div>
        </div>
      </div>
      <div className="pt-1 text-xs">ドラッグして答案を</div>
    </div>
  )
}

const OrderOfAnswerArea = (props: {
  orderOfAnswerArea: Order[]
  switchOrderOfAnswerArea: () => void
}): JSX.Element => {
  // const orderImages = [arrow0, arrow1, arrow2, arrow3]

  const handleOnClick = (): void => {
    props.switchOrderOfAnswerArea()
  }

  return (
    <div
      onClick={handleOnClick}
      className="flex h-8 w-8 items-center justify-center bg-primary/20 shadow-md"
    >
      {/* <Image src={orderImages[props.orderOfAnswerArea]} alt="" /> */}
      {props.orderOfAnswerArea.findIndex((v) => v.isSelected)}
    </div>
  )
}

const QuestionPanel = (props: {
  orderOfAnswerArea: Order[]
  switchOrderOfAnswerArea: () => void
  dragAction: DragAction
  switchDragAction: () => void
}): JSX.Element => {
  return (
    <div className="flex min-w-full select-none items-center justify-center bg-slate-100 py-2 shadow-md">
      <div className="flex items-center px-2">
        <QuestionList />
        <DragActionSwitch
          dragAction={props.dragAction}
          switchDragAction={props.switchDragAction}
        />
        <OrderOfAnswerArea
          orderOfAnswerArea={props.orderOfAnswerArea}
          switchOrderOfAnswerArea={props.switchOrderOfAnswerArea}
        />
      </div>
    </div>
  )
}

export default QuestionPanel
