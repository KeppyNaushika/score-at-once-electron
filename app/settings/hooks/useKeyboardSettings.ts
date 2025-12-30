import { DEFAULT_KEYBINDINGS } from "@/components/projects/07-score-at-once/constants/scoring-keybindings"
import { getModifierKeyLabel } from "@/lib/platform-utils"
import { useEffect, useState } from "react"
import { toast } from "sonner"

// localStorage キー
const STORAGE_KEY = "scoringKeyBindings"

// キーバインディング取得関数（新システム版）
function getKeyboardShortcuts() {
  if (typeof window === "undefined") return DEFAULT_KEYBINDINGS

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_KEYBINDINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error("Failed to load keyboard shortcuts:", error)
  }
  return DEFAULT_KEYBINDINGS
}

// キーバインディング保存関数（新システム版）
function saveKeyboardShortcuts(shortcuts: typeof DEFAULT_KEYBINDINGS) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
  } catch (error) {
    console.error("Failed to save keyboard shortcuts:", error)
  }
}

export function useKeyboardSettings() {
  const [shortcuts, setShortcuts] = useState(DEFAULT_KEYBINDINGS)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string>("")
  const [modifierKeyLabel, setModifierKeyLabel] = useState("Alt")

  // 初期化時にlocalStorageから読み込み
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShortcuts(getKeyboardShortcuts())
      setModifierKeyLabel(getModifierKeyLabel())
    })

    return () => cancelAnimationFrame(frame)
  }, [])

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

  const handleKeySave = () => {
    if (!editingKey || !pendingKey) return

    // 重複チェック
    const existingKey = Object.entries(shortcuts).find(
      ([key, value]) => key !== editingKey && value === pendingKey,
    )

    if (existingKey) {
      toast.error(
        `キー "${pendingKey}" は既に "${existingKey[0]}" で使用されています`,
      )
      return
    }

    // 新しいショートカットを保存
    const newShortcuts = {
      ...shortcuts,
      [editingKey]: pendingKey,
    }

    setShortcuts(newShortcuts)
    saveKeyboardShortcuts(newShortcuts)
    setEditingKey(null)
    setPendingKey("")
    toast.success("ショートカットキーを更新しました")
  }

  const handleKeyCancel = () => {
    setEditingKey(null)
    setPendingKey("")
  }

  const handleReset = () => {
    if (confirm("すべてのショートカットキーをデフォルトに戻しますか？")) {
      setShortcuts(DEFAULT_KEYBINDINGS)
      saveKeyboardShortcuts(DEFAULT_KEYBINDINGS)
      toast.success("ショートカットキーをデフォルトに戻しました")
    }
  }

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
