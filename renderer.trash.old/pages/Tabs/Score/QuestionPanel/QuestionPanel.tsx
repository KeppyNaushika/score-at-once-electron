import React, { useState } from "react"
import { type DragAction } from "../../../../../types/common.types"

// dragActions 配列をモジュールスコープで定義
const dragActions: DragAction[] = [
  "newAnswerArea",
  "addAnswerArea",
  "moveAnswerArea",
]

const QuestionList = () => {
  const [dragAction, setDragAction] = useState(false)

  const QuestionChoice = () => (
    <div className="animate-float-in absolute top-8 z-50 w-full px-2">
      <div className="rounded-md border-2 border-black bg-white/90 shadow-md">
        <div className="border-black px-10 py-1">設問1</div>
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
}) => {
  const SelectedDragActionBg = {
    [dragActions[0]]: "-translate-x-16", // dragActions を参照できるように修正
    [dragActions[1]]: "",
    [dragActions[2]]: "translate-x-16", // dragActions を参照できるように修正
  }

  return (
    <div className="flex flex-col items-center px-8">
      <div
        className="relative flex h-5 w-48 items-center justify-center rounded-full shadow-md"
        onClick={props.switchDragAction}
      >
        <div
          className={`bg-primary/50 absolute flex h-full w-16 rounded-full transition-all duration-200 ${
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
}) => {
  // const orderImages = [arrow0, arrow1, arrow2, arrow3]

  const handleOnClick = (): void => {
    props.switchOrderOfAnswerArea()
  }
  const order = props.orderOfAnswerArea.findIndex((v) => v.isSelected)
  const orderIcons = [
    { className: "", text: "Z" },
    { className: "scale-x-[-1]", text: "Z" },
    { className: "scale-x-[-1]", text: "N" },
    { className: "", text: "N" },
  ]
  return (
    <div
      onClick={handleOnClick}
      className="bg-primary/20 flex h-8 w-8 items-center justify-center shadow-md"
    >
      {/* <Image src={orderImages[props.orderOfAnswerArea]} alt="" /> */}
      <div className={orderIcons[order].className}>
        {orderIcons[order].text}
      </div>
    </div>
  )
}

interface QuestionPanelProps {
  orders: Order[]
  onOrderClick: (orderId: string) => void
  onOrderDrag?: (draggedOrder: Order, targetOrder: Order) => void // Example drag handler
}

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  orders,
  onOrderClick,
  onOrderDrag,
}) => {
  const [activeDragAction, setActiveDragAction] = useState<DragAction>(
    dragActions[0],
  )

  const cycleDragAction = () => {
    setActiveDragAction((prevAction) => {
      const currentIndex = dragActions.indexOf(prevAction)
      const nextIndex = (currentIndex + 1) % dragActions.length
      return dragActions[nextIndex]
    })
  }

  // Example: If dragAction was meant to be a property on Order or handled here
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    order: Order,
  ) => {
    e.dataTransfer.setData("text/plain", order.id)
    // console.log("Dragging order:", order.dragAction); // If dragAction was a property
  }

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetOrder: Order,
  ) => {
    const draggedOrderId = e.dataTransfer.getData("text/plain")
    const draggedOrder = orders.find((o) => o.id === draggedOrderId)
    if (draggedOrder && onOrderDrag) {
      onOrderDrag(draggedOrder, targetOrder)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault() // Necessary to allow dropping
  }

  return (
    <div className="flex min-w-full items-center justify-center bg-slate-100 py-2 shadow-md select-none">
      <div className="flex items-center px-2">
        <QuestionList />
        <DragActionSwitch
          dragAction={activeDragAction} // 修正: orders[0].dragAction から activeDragAction へ
          switchDragAction={cycleDragAction} // 修正: () => {} から cycleDragAction へ
        />
        <OrderOfAnswerArea
          orderOfAnswerArea={orders}
          switchOrderOfAnswerArea={() => {}}
        />
      </div>
      <div>
        {orders.map((order) => (
          <div
            key={order.id}
            onClick={() => onOrderClick(order.id)}
            style={{ fontWeight: order.isSelected ? "bold" : "normal" }}
            draggable
            onDragStart={(e) => handleDragStart(e, order)}
            onDrop={(e) => handleDrop(e, order)}
            onDragOver={handleDragOver}
            className="my-1 cursor-move rounded border p-2"
          >
            {order.name}
            {/* If dragAction was meant to be displayed or used in a specific way:
          {order.dragAction && <span> ({order.dragAction.type})</span>}
          */}
          </div>
        ))}
      </div>
    </div>
  )
}

export default QuestionPanel
