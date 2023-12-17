import React, { type ReactNode, useRef, useState } from "react"
import { type AnswerArea } from "../AnswerAreas"
import { type DragAction } from "../..//Tabs/Score"

const RectangleSelectorContainer = (props: {
  children: ReactNode
  dragAction: DragAction
  setAnswerAreas: React.Dispatch<React.SetStateAction<AnswerArea[]>>
}): JSX.Element => {
  const { children, dragAction, setAnswerAreas } = props

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 })
  const [showRectangle, setShowRectangle] = useState(false)
  const [rectangleStyle, setRectangleStyle] = useState({})
  const containerRef = useRef<HTMLDivElement>(null) // 親要素の参照用

  const updateRectangleStyle = (): void => {
    if (containerRef.current === null) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const x1 = Math.min(dragStart.x, dragEnd.x) - containerRect.left
    const y1 = Math.min(dragStart.y, dragEnd.y) - containerRect.top
    const x2 = Math.max(dragStart.x, dragEnd.x) - containerRect.left
    const y2 = Math.max(dragStart.y, dragEnd.y) - containerRect.top

    setRectangleStyle({
      left: x1,
      top: y1,
      width: x2 - x1,
      height: y2 - y1,
      position: "absolute",
      backgroundColor: "rgba(0, 123, 255, 0.5)", // 例: 青色の半透明
      zIndex: 1000, // 必要に応じて調整
    })
  }

  const handleMouseDown = (e: React.MouseEvent): void => {
    setDragStart({ x: e.clientX, y: e.clientY })
    setDragEnd({ x: e.clientX, y: e.clientY })
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (isDragging) {
      setDragEnd({ x: e.clientX, y: e.clientY })
      setShowRectangle(true)
    }
    updateRectangleStyle() // ドラッグ範囲のスタイルを更新
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
    setShowRectangle(false) // 長方形を非表示
    selectElementsInRange()
  }

  const selectElementsInRange = (): void => {
    // ドラッグされた範囲の計算
    const minX = Math.min(dragStart.x, dragEnd.x)
    const maxX = Math.max(dragStart.x, dragEnd.x)
    const minY = Math.min(dragStart.y, dragEnd.y)
    const maxY = Math.max(dragStart.y, dragEnd.y)

    // 範囲内の要素を選択
    setAnswerAreas((prevAnswerAreas) => {
      const newAnswerAreas =
        dragAction === "newAnswerArea"
          ? prevAnswerAreas.map((answerArea) => {
              answerArea.isSelected = false
              return answerArea
            })
          : prevAnswerAreas

      return newAnswerAreas.map((answerArea) => {
        const rect = document
          ?.getElementById(`answer-${answerArea.studentId}`)
          ?.getBoundingClientRect()
        if (rect == null) {
          return answerArea
        }
        if (
          rect.left < maxX &&
          rect.right > minX &&
          rect.top < maxY &&
          rect.bottom > minY
        ) {
          return { ...answerArea, isSelected: true }
        }
        return answerArea
      })
    })
  }

  return (
    <div
      ref={containerRef} // 親要素に参照を設定
      className="relative flex grow select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {showRectangle && <div style={rectangleStyle}></div>}
      {children}
    </div>
  )
}

export default RectangleSelectorContainer
