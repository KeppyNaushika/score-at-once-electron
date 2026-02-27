/**
 * Undo/Redo キーボードショートカット
 *
 * Ctrl+Z / Cmd+Z → undo
 * Ctrl+Shift+Z / Cmd+Shift+Z → redo
 * INPUT/TEXTAREA にフォーカス中はスキップ（ブラウザネイティブundoを優先）
 */

import { useEffect } from "react"

interface UseUndoRedoShortcutsOptions {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useUndoRedoShortcuts({
  undo,
  redo,
  canUndo,
  canRedo,
}: UseUndoRedoShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // INPUT/TEXTAREA にフォーカス中はブラウザネイティブundoを優先
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      const isModKey = e.metaKey || e.ctrlKey
      if (!isModKey || e.key.toLowerCase() !== "z") return

      if (e.shiftKey) {
        // Redo
        if (canRedo) {
          e.preventDefault()
          redo()
        }
      } else {
        // Undo
        if (canUndo) {
          e.preventDefault()
          undo()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo, canUndo, canRedo])
}
