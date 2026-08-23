import { useMutation, useQuery } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import { toast } from "sonner"

import { DEFAULT_KEYBINDINGS } from "@/components/exams/07-score-at-once/constants/scoringKeybindings"
import { normalizeKey } from "@/components/exams/07-score-at-once/ScoringMain/utils/normalizeKey"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { getModifierKeyLabel } from "@/lib/platformUtils"
import {
  keyboardShortcutsQuery,
  resetKeyboardShortcutsMutation,
  saveKeyboardShortcutsMutation,
} from "@/queries/settings"

/** プラットフォームは変わらないので購読するものが無い */
const subscribeToNothing = () => () => {}
const getServerModifierKeyLabel = () => "Alt"

export function useKeyboardSettings() {
  const userId = useCurrentUser().id

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string>("")

  // 修飾キーの表示名はプラットフォーム依存。サーバ側では読めないので、
  // 事前描画では "Alt"、マウント後に実際の値へ差し替える
  const modifierKeyLabel = useSyncExternalStore(
    subscribeToNothing,
    getModifierKeyLabel,
    getServerModifierKeyLabel
  )

  // 採点画面（ShortcutProvider）と同じキャッシュを共有する
  const { data: storedShortcuts } = useQuery(keyboardShortcutsQuery(userId))
  const saveKeyboardShortcuts = useMutation(
    saveKeyboardShortcutsMutation(userId)
  )
  const resetKeyboardShortcuts = useMutation(
    resetKeyboardShortcutsMutation(userId)
  )
  const shortcuts = useMemo(
    () => ({ ...DEFAULT_KEYBINDINGS, ...storedShortcuts }),
    [storedShortcuts]
  )

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

      // 記録は押す側と**同じ関数**を通す。ここで綴りを書き直すと規則が2つになり、
      // 修飾キー付きの割り当てが記録の時点で食い違う（Shift+d を押したときに
      // `event.key` は `"D"`、押す側の `normalizeKey` は `"Shift+d"` を作る）
      setPendingKey(normalizeKey(event))
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

    // 書いてから読み直す。手元のキャッシュへ先に置くと、保存に失敗したときに
    // 新しいキーが割り当たったまま残る（戻す道が無い）
    const newShortcuts = {
      ...shortcuts,
      [editingKey]: pendingKey,
    }

    setEditingKey(null)
    setPendingKey("")

    saveKeyboardShortcuts.mutate(newShortcuts, {
      onSuccess: () => toast.success("ショートカットキーを更新しました"),
    })
  }, [editingKey, pendingKey, shortcuts, saveKeyboardShortcuts])

  const handleKeyCancel = () => {
    setEditingKey(null)
    setPendingKey("")
  }

  const handleReset = useCallback(() => {
    if (!confirm("すべてのショートカットキーをデフォルトに戻しますか？")) {
      return
    }
    resetKeyboardShortcuts.mutate(undefined, {
      onSuccess: () =>
        toast.success("ショートカットキーをデフォルトに戻しました"),
    })
  }, [resetKeyboardShortcuts])

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
