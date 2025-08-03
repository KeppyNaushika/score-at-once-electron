import { useEffect } from "react"

interface UseKeyboardHandlersProps {
  selectedElementIds: string[]
  showTextInput: boolean
  setIsShiftPressed: (pressed: boolean) => void
  setIsCtrlPressed: (pressed: boolean) => void
  removeDrawingElement: (id: string) => void
}

export function useKeyboardHandlers({
  selectedElementIds,
  showTextInput,
  setIsShiftPressed,
  setIsCtrlPressed,
  removeDrawingElement,
}: UseKeyboardHandlersProps) {
  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(true)
      }

      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(true)
      }

      // Delete/Backspaceで選択要素を削除（複数選択対応）
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElementIds.length > 0 &&
        !showTextInput
      ) {
        e.preventDefault()
        selectedElementIds.forEach((id) => {
          removeDrawingElement(id)
        })
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(false)
      }

      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [
    selectedElementIds,
    showTextInput,
    setIsShiftPressed,
    setIsCtrlPressed,
    removeDrawingElement,
  ])
}
