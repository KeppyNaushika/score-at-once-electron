/**
 * @fileoverview キーボードイベントフック
 * Shift/Ctrl/Metaキーの追跡と要素削除のショートカット
 */
import { useEffect } from "react"

/** キーボードフックのプロパティ */
interface UseKeyboardHandlersProps {
  /** 選択中の要素ID配列 */
  selectedElementIds: string[]
  /** テキスト編集モーダル表示中フラグ */
  isTextEditing: boolean
  /** Shiftキー状態設定関数 */
  setIsShiftPressed: (pressed: boolean) => void
  /** Ctrlキー状態設定関数 */
  setIsCtrlPressed: (pressed: boolean) => void
  /** 描画要素削除関数 */
  removeDrawingElement: (id: string) => void
}

/**
 * キーボードイベントフック
 *
 * @description
 * グローバルなキーボードイベントを監視し、
 * 修飾キーの状態追跡と要素削除ショートカットを提供する。
 * テキスト編集モーダル表示中は、フォーカス位置に関わらず全ショートカットを
 * 無効化する（モーダル内編集中のBackspaceでアノテーションが削除されるのを防ぐ）。
 *
 * @param props - フックのプロパティ
 */
export function useKeyboard({
  selectedElementIds,
  isTextEditing,
  setIsShiftPressed,
  setIsCtrlPressed,
  removeDrawingElement,
}: UseKeyboardHandlersProps) {
  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト編集モーダル表示中は全ショートカットを無効化（フォーカス非依存）
      if (isTextEditing) {
        return
      }

      // 通常モード時のキーボード処理
      if (e.key === "Shift") {
        setIsShiftPressed(true)
      }

      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(true)
      }

      // 入力欄（テキスト編集モーダルのtextarea等）にフォーカスがある場合は
      // 削除ショートカットを抑制する（モーダルでテキスト編集中のBackspaceで
      // アノテーションごと削除されるのを防ぐ）
      const target = e.target as HTMLElement | null
      const isEditableTarget =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)

      // Delete/Backspaceで選択要素を削除（複数選択対応）
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isEditableTarget &&
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
    isTextEditing,
    setIsShiftPressed,
    setIsCtrlPressed,
    removeDrawingElement,
  ])
}
