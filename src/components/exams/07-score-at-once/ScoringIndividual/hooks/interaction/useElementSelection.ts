import { useCallback, useRef } from "react"

import type {
  DrawingElement,
  LineEditMode,
  RectangleEditMode,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

interface UseElementSelectionProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isCtrlPressed: boolean

  // Actions
  toggleSelection: (id: string) => void
  setSelectedElementIds: (ids: string[]) => void
  setLineEditMode: (mode: LineEditMode) => void
  setRectangleEditMode: (mode: RectangleEditMode) => void

  // Utils
  hitTestElement: (element: DrawingElement, x: number, y: number) => boolean
  getLineEditMode: (
    element: DrawingElement,
    x: number,
    y: number
  ) => LineEditMode
  getRectangleEditMode: (
    element: DrawingElement,
    x: number,
    y: number
  ) => RectangleEditMode

  // Optional callback for text element re-click
  onTextElementReClick?: (element: DrawingElement) => void
}

/** 描画要素のクリック選択・複数選択・ダブルクリック検出を管理するフック */
export function useElementSelection({
  currentTool,
  drawingElements,
  selectedElementIds,
  isCtrlPressed,
  toggleSelection,
  setSelectedElementIds,
  setLineEditMode,
  setRectangleEditMode,
  hitTestElement,
  getLineEditMode,
  getRectangleEditMode,
  onTextElementReClick,
}: UseElementSelectionProps) {
  // ダブルクリック検出用の状態
  const lastClickRef = useRef<{ elementId: string | null; timestamp: number }>({
    elementId: null,
    timestamp: 0,
  })
  const DOUBLE_CLICK_THRESHOLD = 300 // ミリ秒

  // 要素選択処理
  const handleElementSelection = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select")
        return { elementSelected: false, clickedElement: null }

      // 既存要素の選択チェック
      let elementSelected = false
      let clickedElement: DrawingElement | null = null

      // 要素がない場合は早期リターン
      if (drawingElements.length === 0) {
        return { elementSelected: false, clickedElement: null }
      }

      for (let i = drawingElements.length - 1; i >= 0; i--) {
        const element = drawingElements[i]
        const hitResult = hitTestElement(element, imageCoords.x, imageCoords.y)

        if (hitResult) {
          clickedElement = element
          elementSelected = true
          break
        }
      }

      if (elementSelected && clickedElement) {
        // Ctrl/Cmdキーが押されている場合は複数選択
        if (isCtrlPressed) {
          toggleSelection(clickedElement.id)
          // 複数選択時はクリック状態をリセット
          lastClickRef.current = { elementId: null, timestamp: 0 }
        } else {
          // 既に選択されている要素をクリックした場合
          if (selectedElementIds.includes(clickedElement.id)) {
            // テキスト要素の場合、ダブルクリックをチェック
            if (clickedElement.type === "text" && onTextElementReClick) {
              const currentTime = Date.now()
              const lastClick = lastClickRef.current

              if (
                lastClick.elementId === clickedElement.id &&
                currentTime - lastClick.timestamp < DOUBLE_CLICK_THRESHOLD
              ) {
                onTextElementReClick(clickedElement)
                // ダブルクリック検出後はリセット
                lastClickRef.current = { elementId: null, timestamp: 0 }
              } else {
                // 単一クリックの記録
                lastClickRef.current = {
                  elementId: clickedElement.id,
                  timestamp: currentTime,
                }
              }
            }
          } else {
            // 新しい要素を単独選択
            setSelectedElementIds([clickedElement.id])
            // 新しい要素を選択したのでクリック状態をリセット
            lastClickRef.current = { elementId: null, timestamp: 0 }
          }
        }

        // 編集モードの判定（クリックされた要素を使用）
        const firstSelectedElement = clickedElement

        if (firstSelectedElement?.type === "line") {
          const editMode = getLineEditMode(
            firstSelectedElement,
            imageCoords.x,
            imageCoords.y
          )
          setLineEditMode(editMode)
        } else if (firstSelectedElement?.type === "rectangle") {
          const editMode = getRectangleEditMode(
            firstSelectedElement,
            imageCoords.x,
            imageCoords.y
          )
          setRectangleEditMode(editMode)
        }
      }
      // No element selected - nothing to do

      return { elementSelected, clickedElement, clickedCoords: imageCoords }
    },
    [
      currentTool,
      drawingElements,
      selectedElementIds,
      isCtrlPressed,
      hitTestElement,
      toggleSelection,
      setSelectedElementIds,
      getLineEditMode,
      setLineEditMode,
      getRectangleEditMode,
      setRectangleEditMode,
      onTextElementReClick,
    ]
  )

  return {
    handleElementSelection,
  }
}
