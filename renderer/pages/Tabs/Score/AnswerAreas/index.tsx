import React, { useEffect, useRef, useState } from "react"
// Assuming AnswerArea, Order, Show types come from the parent Score component's types
import {
  type AnswerArea,
  type Order as ParentOrder,
  type Show as ParentShow,
} from "../index.type"
// Assuming DragAction is specific to AnswerAreas or defined here
import { type DragAction } from "./index.type"
import AnswerAreaComponent from "./AnswerArea"
// ... other imports

// Remove local conflicting type declarations for AnswerArea, Order, Show, DragAction if they exist here

interface AnswerAreasProps {
  answerAreas: AnswerArea[]
  setAnswerAreas: React.Dispatch<React.SetStateAction<AnswerArea[]>>
  orders: ParentOrder[]
  setOrders: React.Dispatch<React.SetStateAction<ParentOrder[]>>
  toggleShow: (show: ParentShow) => void
  selectedAnswerAreaIds: string[]
  handleSelectAnswerArea: (
    answerAreaId: string,
    isCtrlKey: boolean,
    isShiftKey: boolean,
  ) => void
  isShowStudentName: boolean
  showScoreOverlay: boolean
  currentProjectId: string | null
  questions: any[] // Replace with actual Question type
  students: any[] // Replace with actual Student type
  setIsShowCommentWindow: React.Dispatch<React.SetStateAction<boolean>> // Added prop
}

const AnswerAreas = (props: AnswerAreasProps) => {
  const {
    answerAreas, // These are the already filtered/sorted ones for display
    setAnswerAreas, // This is the setter for the original list of answer areas
    orders,
    setOrders,
    toggleShow,
    selectedAnswerAreaIds,
    handleSelectAnswerArea,
    isShowStudentName,
    showScoreOverlay,
    currentProjectId,
    questions,
    students,
    setIsShowCommentWindow, // Use this prop
  } = props

  // This local state might be for drag/drop operations or new area creation,
  // but the main list of answerAreas comes from props.
  // If this `items` is different, its type needs to be clear.
  // For now, assuming operations modify the `answerAreas` from props via `setAnswerAreas`.
  // const [items, setItems] = useState<AnswerArea[]>(answerAreas)

  // useEffect(() => {
  // setItems(answerAreas)
  // }, [answerAreas])

  // Consolidate handleItemsChange if it was duplicated
  const handleItemsChange = (newItems: AnswerArea[], action: DragAction) => {
    console.log("Action:", action, "New Items:", newItems)
    setAnswerAreas(newItems) // Update the source of truth
  }

  // Example usage of setIsShowCommentWindow
  const openCommentWindowForArea = (answerArea: AnswerArea) => {
    // Logic to select the answer area for comment
    console.log("Opening comment for", answerArea.id)
    setIsShowCommentWindow(true)
  }

  // Correcting logic for displaying answer areas
  // The `answerAreas` prop should already be the list to display.
  // The filtering and sorting logic should ideally be in the parent `Score` component
  // or passed as `showAnswerAreas` directly.

  // If `showAnswerAreas` was a local computed variable:
  // const showAnswerAreas = answerAreas.filter(area => area.isShown); // Example filter

  // Example of creating an AnswerArea object, ensure all required fields are present
  const exampleAreaCreation = () => {
    const newArea: AnswerArea = {
      isSelected: false, // Assuming isSelected is part of AnswerArea or added for local state
      id: "newArea123",
      studentId: "student1",
      studentName: "John Doe",
      questionId: "q1",
      maxPoints: 10,
      score: { value: null, isScored: false }, // Example Score object
      partialPoints: null,
      isShown: true,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      comment: "New comment",
      index: 0, // Added: ensure this is provided
      cropTmp: {}, // Added: ensure this is provided or typed appropriately
    }
    console.log(newArea)
  }

  return (
    <div
      className="grid-cols-auto-fill-120 grid gap-2 overflow-y-auto p-2"
      // onDragOver, onDrop handlers for drag-and-drop functionality
    >
      {answerAreas.map(
        (
          answerArea,
          index, // Use index from map if needed for keys, not as part of AnswerArea data
        ) => (
          <div
            key={answerArea.id} // Use a unique ID from AnswerArea
            onClick={(e) => {
              handleSelectAnswerArea(
                answerArea.id,
                e.ctrlKey || e.metaKey,
                e.shiftKey,
              )
            }}
            onDoubleClick={() => openCommentWindowForArea(answerArea)}
            // draggable props if implementing drag and drop
          >
            <AnswerAreaComponent
              answerArea={{
                ...answerArea,
                // Ensure all properties expected by AnswerAreaComponent are present
                // isSelected is now correctly part of the AnswerArea type from props
                isSelected: selectedAnswerAreaIds.includes(answerArea.id),
              }}
              isShowStudentName={isShowStudentName}
              showScoreOverlay={showScoreOverlay}
              // scoreColors and overlaySymbols can be passed if customized
            />
          </div>
        ),
      )}
      {/* Placeholder for adding new answer areas if applicable */}
      {/* <div
        className="flex h-32 w-28 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-400 text-gray-400 hover:border-gray-500 hover:text-gray-500"
        onClick={() => {
          // Logic to add a new answer area
          // This would typically involve calling handleItemsChange or a similar function
          // with a 'newAnswerArea' or 'addAnswerArea' action.
          // Example:
          // const newArea: AnswerArea = { id: Date.now().toString(), studentId: 'new', studentName: 'New Student', questionId: 'q1', maxPoints: 10, score: 'unscored', partialPoints: null, isShown: true, isSelected: false, x:0, y:0, width:100, height:100 };
          // handleItemsChange([...answerAreas, newArea], "addAnswerArea");
        }}
      >
        + 新規追加
      </div> */}
    </div>
  )
}

export default AnswerAreas
