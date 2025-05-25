import React, { useEffect, useState } from "react" // useContext を削除

import { useProjects } from "../../../../components/hooks/useProjects" // useProjects をインポート
import AnswerAreas from "./AnswerAreas"
import FlexboxContainer from "./FlexboxContainer/FlexboxContainer"
import {
  AnswerArea,
  type OrderButtonState,
  type PanelScore,
} from "./index.type"
import ScorePanel from "./ScorePanel/ScorePanel"

const initialOrders: OrderButtonState[] = [
  {
    id: "1",
    name: "出席番号順",
    isSelected: true,
    field: "studentId",
    sorted: "ascending",
    className: "",
  },
  {
    id: "2",
    name: "得点順",
    isSelected: false,
    field: "points",
    sorted: "descending",
    className: "",
  },
  {
    id: "3",
    name: "未採点のみ",
    isSelected: false,
    field: "status",
    sorted: "none",
    className: "",
  },
  {
    id: "4",
    name: "要確認のみ",
    isSelected: false,
    field: "needsReview",
    sorted: "none",
    className: "",
  },
]

const ScoreTab = () => {
  const { selectedProjectId } = useProjects() // useProjects から取得
  const [answerAreas, setAnswerAreas] = useState<AnswerArea[]>([])
  const [selectedAnswerAreaIds, setSelectedAnswerAreaIds] = useState<string[]>(
    [],
  )
  const [questions, setQuestions] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [orders, setOrders] = useState<OrderButtonState[]>(initialOrders)
  const [panelScores, setPanelScores] = useState<PanelScore[]>([
    { value: "correct" },
    { value: "partial" },
    { value: "pending" },
    { value: "incorrect" },
    { value: "no_answer" },
  ])

  useEffect(() => {
    if (selectedProjectId) {
      // window.electronAPI.fetchScoreData(selectedProjectId).then(data => {
      //   setAnswerAreas(data.answerAreas);
      //   setQuestions(data.questions);
      //   setStudents(data.students);
      // }).catch(console.error);
    }
  }, [selectedProjectId])

  const handleSelectAnswerArea = (
    areaId: string,
    isCtrlOrMetaPressed: boolean,
  ) => {
    setSelectedAnswerAreaIds((prevSelectedIds) => {
      if (isCtrlOrMetaPressed) {
        return prevSelectedIds.includes(areaId)
          ? prevSelectedIds.filter((id) => id !== areaId)
          : [...prevSelectedIds, areaId]
      }
      return [areaId]
    })
  }

  const handleOrderClick = (orderId: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => ({
        ...order,
        isSelected: order.id === orderId,
        sorted:
          order.id === orderId &&
          order.isSelected &&
          order.sorted === "ascending"
            ? "descending"
            : order.id === orderId &&
                order.isSelected &&
                order.sorted === "descending"
              ? "ascending"
              : order.sorted,
      })),
    )
  }

  const OrderButtons: React.FC<{
    orders: OrderButtonState[]
    onOrderClick: (orderId: string) => void
    children?: React.ReactNode
  }> = ({ orders, onOrderClick, children }) => (
    <FlexboxContainer
      className="p-2"
      alignItems="center"
      justifyContent="flex-start"
    >
      {orders.map((order) => (
        <button
          key={order.id}
          onClick={() => onOrderClick(order.id)}
          className={`mx-1 rounded border p-2 ${order.isSelected ? "bg-blue-500 text-white" : "bg-gray-200"} ${order.className || ""}`}
        >
          {order.name}
          {order.isSelected && order.sorted === "ascending" && " ↑"}
          {order.isSelected && order.sorted === "descending" && " ↓"}
        </button>
      ))}
      {children}
    </FlexboxContainer>
  )

  return (
    <div className="flex h-full flex-col">
      <ScorePanel scores={panelScores} orders={orders} />
      <OrderButtons orders={orders} onOrderClick={handleOrderClick} />
      <AnswerAreas
        answerAreas={answerAreas}
        selectedAnswerAreaIds={selectedAnswerAreaIds}
        handleSelectAnswerArea={handleSelectAnswerArea}
        projectId={selectedProjectId}
        questions={questions}
        students={students}
      />
    </div>
  )
}

export default ScoreTab
