import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { DEFAULT_KEYBINDINGS } from "@/components/exams/07-score-at-once/constants/scoringKeybindings"
import { useAuth } from "@/contexts/AuthContext"
import { getModifierKeyLabel } from "@/lib/platformUtils"

export function useKeyboardSettings() {
  const { user } = useAuth()
  const userId = user?.id
  const initializedRef = useRef(false)

  const [shortcuts, setShortcuts] = useState(DEFAULT_KEYBINDINGS)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string>("")
  const [modifierKeyLabel, setModifierKeyLabel] = useState("Alt")

  // 初期化時にDBから読み込み
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadShortcuts = async () => {
      setModifierKeyLabel(getModifierKeyLabel())

      if (userId && window.electronAPI?.settings) {
        try {
          const result =
            await window.electronAPI.settings.getUserKeyboardShortcuts(userId)
          if (result.success && result.shortcuts) {
            setShortcuts({ ...DEFAULT_KEYBINDINGS, ...result.shortcuts })
          }
        } catch (error) {
          console.error("キーバインディングの読み込みに失敗しました:", error)
        }
      }
    }

    loadShortcuts()
  }, [userId])

  // キー入力をキャプチャ
  useEffect(() => {
    if (!editingKey) return

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()

      // Escapeでキャンセル
      if (event.key === "Escape") {
        setEditingKey(null)
        setPendingKey("")
        return
      }

      // 修飾キーのみの場合はスキップ
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
        return
      }

      // キーを記録
      let key = event.key
      if (key === " ") key = "Space"

      setPendingKey(key)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [editingKey])

  const handleKeyEdit = (shortcutKey: string) => {
    setEditingKey(shortcutKey)
    setPendingKey("")
  }

  const handleKeySave = useCallback(async () => {
    if (!editingKey || !pendingKey) return

    // 重複チェック
    const existingKey = Object.entries(shortcuts).find(
      ([key, value]) => key !== editingKey && value === pendingKey
    )

    if (existingKey) {
      toast.error(
        `キー "${pendingKey}" は既に "${existingKey[0]}" で使用されています`
      )
      return
    }

    // 新しいショートカットを保存（楽観的更新）
    const newShortcuts = {
      ...shortcuts,
      [editingKey]: pendingKey,
    }

    setShortcuts(newShortcuts)
    setEditingKey(null)
    setPendingKey("")

    // DBに保存
    if (userId && window.electronAPI?.settings) {
      try {
        await window.electronAPI.settings.saveUserKeyboardShortcuts(
          userId,
          newShortcuts
        )
        toast.success("ショートカットキーを更新しました")
      } catch (error) {
        console.error("キーバインディングの保存に失敗しました:", error)
        toast.error("ショートカットキーの保存に失敗しました")
      }
    } else {
      toast.success("ショートカットキーを更新しました")
    }
  }, [editingKey, pendingKey, shortcuts, userId])

  const handleKeyCancel = () => {
    setEditingKey(null)
    setPendingKey("")
  }

  const handleReset = useCallback(async () => {
    if (confirm("すべてのショートカットキーをデフォルトに戻しますか？")) {
      setShortcuts(DEFAULT_KEYBINDINGS)

      if (userId && window.electronAPI?.settings) {
        try {
          await window.electronAPI.settings.resetUserKeyboardShortcuts(userId)
          toast.success("ショートカットキーをデフォルトに戻しました")
        } catch (error) {
          console.error("キーバインディングのリセットに失敗しました:", error)
          toast.error("ショートカットキーのリセットに失敗しました")
        }
      } else {
        toast.success("ショートカットキーをデフォルトに戻しました")
      }
    }
  }, [userId])

  const getKeyDisplayName = (key: string) => {
    const KEY_DISPLAY_NAMES: { [key: string]: string } = {
      q: "Q",
      e: "E",
      f: "F",
      j: "J",
      o: "O",
      p: "P",
      h: "H",
      g: "G",
      t: "T",
      l: "L",
      b: "B",
      y: "Y",
      ArrowRight: "→",
      ArrowLeft: "←",
      ArrowDown: "↓",
      ArrowUp: "↑",
      "=": "=",
      "-": "-",
      "0": "0",
    }
    return KEY_DISPLAY_NAMES[key] || key
  }

  return {
    shortcuts,
    editingKey,
    pendingKey,
    modifierKeyLabel,
    handleKeyEdit,
    handleKeySave,
    handleKeyCancel,
    handleReset,
    getKeyDisplayName,
  }
}
