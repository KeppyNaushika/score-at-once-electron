import { useCallback, useRef } from "react"
import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"

interface UseElementSelectionProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isCtrlPressed: boolean
  
  // Actions
  toggleSelection: (id: string) => void
  setSelectedElementIds: (ids: string[]) => void
  clearSelection: () => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  
  // Utils
  hitTestElement: (element: any, x: number, y: number) => boolean
  getLineEditMode: (element: any, x: number, y: number) => any
  getRectangleEditMode: (element: any, x: number, y: number) => any
  
  // Optional callback for text element re-click
  onTextElementReClick?: (element: DrawingElement) => void
}

export function useElementSelection({
  currentTool,
  drawingElements,
  selectedElementIds,
  isCtrlPressed,
  toggleSelection,
  setSelectedElementIds,
  clearSelection,
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
      if (currentTool !== "select") return { elementSelected: false, clickedElement: null }

      // 既存要素の選択チェック
      let elementSelected = false
      let clickedElement: any = null

      console.log("🔍 要素選択チェック開始:", {
        drawingElementsCount: drawingElements.length,
        imageCoords,
        elements: drawingElements.map(el => ({ 
          id: el.id, 
          type: el.type, 
          x: el.x, 
          y: el.y,
          endX: el.endX,
          endY: el.endY,
          width: el.width,
          height: el.height,
          textBoxWidth: el.textBoxWidth,
          textBoxHeight: el.textBoxHeight
        }))
      })
      
      // 要素がない場合は早期リターン
      if (drawingElements.length === 0) {
        console.log("❌ 描画要素がありません - 長方形選択開始")
        return { elementSelected: false, clickedElement: null }
      }

      for (let i = drawingElements.length - 1; i >= 0; i--) {
        const element = drawingElements[i]
        const hitResult = hitTestElement(element, imageCoords.x, imageCoords.y)
        console.log(`🎯 ヒットテスト ${element.type}[${element.id}]:`, {
          result: hitResult,
          elementPos: { x: element.x, y: element.y },
          testCoords: imageCoords,
        })
        
        if (hitResult) {
          clickedElement = element
          elementSelected = true
          console.log("✅ 要素ヒット:", element.id)
          break
        }
      }

      if (elementSelected && clickedElement) {
        console.log("🎯 要素選択:", clickedElement.type, clickedElement.id)
        
        // Ctrl/Cmdキーが押されている場合は複数選択
        if (isCtrlPressed) {
          toggleSelection(clickedElement.id)
          // 複数選択時はクリック状態をリセット
          lastClickRef.current = { elementId: null, timestamp: 0 }
        } else {
          // 既に選択されている要素をクリックした場合
          if (selectedElementIds.includes(clickedElement.id)) {
            console.log("📌 選択維持:", clickedElement.id)
            
            // テキスト要素の場合、ダブルクリックをチェック
            if (clickedElement.type === "text" && onTextElementReClick) {
              const currentTime = Date.now()
              const lastClick = lastClickRef.current
              
              if (
                lastClick.elementId === clickedElement.id &&
                currentTime - lastClick.timestamp < DOUBLE_CLICK_THRESHOLD
              ) {
                console.log("✏️ テキスト要素ダブルクリック:", clickedElement.id)
                onTextElementReClick(clickedElement)
                // ダブルクリック検出後はリセット
                lastClickRef.current = { elementId: null, timestamp: 0 }
              } else {
                // 単一クリックの記録
                lastClickRef.current = { elementId: clickedElement.id, timestamp: currentTime }
              }
            }
          } else {
            // 新しい要素を単独選択
            console.log("✨ 新規選択:", clickedElement.id)
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
            imageCoords.y,
          )
          setLineEditMode(editMode)
        } else if (firstSelectedElement?.type === "rectangle") {
          const editMode = getRectangleEditMode(
            firstSelectedElement,
            imageCoords.x,
            imageCoords.y,
          )
          setRectangleEditMode(editMode)
        }

        // 選択のみ実行（まだ移動は開始しない）
        console.log("🎯 要素選択完了:", {
          clickedElement: clickedElement.id,
          selectedIds: selectedElementIds,
          imageCoords,
          elementPos: { x: clickedElement.x, y: clickedElement.y },
          elementSelected: true,
        })
      } else {
        console.log("❌ 要素選択なし - 長方形選択開始")
      }

      console.log("🔄 handleElementSelection戻り値:", { 
        elementSelected, 
        clickedElement: clickedElement?.id || null,
        totalElementsChecked: drawingElements.length,
        imageCoords
      })
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
    ],
  )

  return {
    handleElementSelection,
  }
}