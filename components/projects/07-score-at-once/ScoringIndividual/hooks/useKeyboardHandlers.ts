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
      // テキスト入力モード中は修飾キーのみ処理し、他のショートカットは無効化
      if (showTextInput) {
        // Shift/Ctrl/Metaの状態のみ追跡（書式設定で必要）
        if (e.key === "Shift") {
          setIsShiftPressed(true)
        }
        if (e.key === "Control" || e.key === "Meta") {
          setIsCtrlPressed(true)
        }
        // テキスト入力中は他のキーイベントを無視
        return
      }

      // 通常モード時のキーボード処理
      if (e.key === "Shift") {
        setIsShiftPressed(true)
      }

      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(true)
      }

      // Delete/Backspaceで選択要素を削除（複数選択対応）
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElementIds.length > 0
      ) {
        e.preventDefault()
        selectedElementIds.forEach((id) => {
          removeDrawingElement(id)
        })
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // 修飾キーのリリースは常に処理（テキスト入力中でも必要）
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
