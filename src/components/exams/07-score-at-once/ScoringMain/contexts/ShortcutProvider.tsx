"use client"

/**
 * ショートカット管理システムのプロバイダー
 * 一括採点画面専用のショートカット機能を提供
 *
 * 主な機能:
 * - コマンドの登録・解除（コンポーネントのライフサイクルに連動）
 * - キーバインディングの管理（DB連携、カスタマイズ可能）
 * - コンテキスト状態の管理（実行条件の判定）
 * - when句による柔軟な実行条件制御
 * - macOSデッドキー対応
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { useAuth } from "@/contexts/AuthContext"

import { DEFAULT_KEYBINDINGS } from "../../constants/scoringKeybindings"
import type {
  CommandHandler,
  KeyBinding,
  ScoringContextState,
  ShortcutContextValue,
} from "./shortcutContextTypes"

// ============================================
// コンテキスト作成
// ============================================

const ShortcutContext = createContext<ShortcutContextValue | null>(null)

/**
 * ShortcutContextを取得するフック
 * ShortcutProvider内でのみ使用可能
 */
export function useShortcutContext() {
  const context = useContext(ShortcutContext)
  if (!context) {
    throw new Error("useShortcutContext must be used within ShortcutProvider")
  }
  return context
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * macOSデッドキーのKeyCodeマッピング
 * Option+E などがデッドキーとして検出される問題に対応
 */
const DEAD_KEY_CODE_MAP: { [code: string]: string } = {
  KeyQ: "q",
  KeyE: "e",
  KeyF: "f",
  KeyJ: "j",
  KeyO: "o",
  KeyP: "p",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyW: "w",
  KeyR: "r",
  KeyT: "t",
  KeyY: "y",
  KeyU: "u",
  KeyI: "i",
  KeyG: "g",
  KeyH: "h",
  KeyK: "k",
  KeyL: "l",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: "b",
  KeyN: "n",
  KeyM: "m",
}

/**
 * 大文字小文字を保持すべき特殊キー
 * これらのキーはキーバインディング設定と同じ形式で返す
 */
const SPECIAL_KEYS = new Set([
  "Escape",
  "Backspace",
  "Enter",
  "Tab",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Delete",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
])

/**
 * キー入力を正規化する
 * macOSデッドキー対応と修飾キーの処理を含む
 */
function normalizeKey(event: KeyboardEvent): string {
  let key = event.key

  // macOSデッドキー対応
  if (key === "Dead" && event.code && DEAD_KEY_CODE_MAP[event.code]) {
    key = DEAD_KEY_CODE_MAP[event.code]
  } else if (event.code && DEAD_KEY_CODE_MAP[event.code]) {
    key = DEAD_KEY_CODE_MAP[event.code]
  }

  // 特殊キーは大文字小文字を保持、通常キーは小文字に正規化
  if (!SPECIAL_KEYS.has(key)) {
    key = key.toLowerCase()
  }

  // スペースキーの正規化
  if (key === " ") {
    key = "Space"
  }

  // 修飾キーを含める（順序: Ctrl, Alt, Shift, Meta）
  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push("Ctrl")
  if (event.altKey) modifiers.push("Alt")
  if (event.shiftKey) modifiers.push("Shift")

  if (modifiers.length > 0) {
    return `${modifiers.join("+")}+${key}`
  }

  return key
}

/**
 * when句を評価する
 * JavaScript式として安全に評価
 */
function evaluateWhenClause(
  when: string,
  context: ScoringContextState
): boolean {
  try {
    // 簡易的な式評価（セキュリティ上の理由で制限された構文のみ）
    // コンテキスト変数を直接参照可能
    // 例: "!inputFocus && gradingMode == 'grid'"

    const evaluateWhen = new Function(
      "inputFocus",
      "textEditorActive",
      "gradingMode",
      "modalOpen",
      "partialScoreModalOpen",
      "sidePanelVisible",
      "hasSelectedAnswers",
      "scoringOperationMode",
      `return ${when}`
    )

    return evaluateWhen(
      context.inputFocus,
      context.textEditorActive,
      context.gradingMode,
      context.modalOpen,
      context.partialScoreModalOpen,
      context.sidePanelVisible,
      context.hasSelectedAnswers,
      context.scoringOperationMode
    )
  } catch (error) {
    console.error("Failed to evaluate when clause:", when, error)
    return false
  }
}

// ============================================
// ShortcutProvider コンポーネント
// ============================================

interface ShortcutProviderProps {
  children: ReactNode
}

/** 一括採点画面のキーボードショートカット管理（コマンド登録・キーバインド・when句評価）を提供するプロバイダー */
export function ShortcutProvider({ children }: ShortcutProviderProps) {
  const { user } = useAuth()
  const userId = user?.id
  const initializedRef = useRef(false)

  // ============================================
  // 状態管理
  // ============================================

  // コンテキスト状態
  const [context, setContext] = useState<ScoringContextState>({
    inputFocus: false,
    textEditorActive: false,
    gradingMode: "grid",
    modalOpen: false,
    partialScoreModalOpen: false,
    sidePanelVisible: true,
    hasSelectedAnswers: false,
    scoringOperationMode: "keyboard",
  })

  // コマンドレジストリ（commandId -> CommandHandler[]）
  // 同一commandIdに異なるwhen句を持つ複数ハンドラーを共存させる
  const [commands, setCommands] = useState<Map<string, CommandHandler[]>>(
    new Map()
  )

  // キーバインディング
  const [keyBindings, setKeyBindings] =
    useState<KeyBinding>(DEFAULT_KEYBINDINGS)

  // キーバインディングを読み込む
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadKeyBindings = async () => {
      if (userId && window.electronAPI?.settings) {
        try {
          const result =
            await window.electronAPI.settings.getUserKeyboardShortcuts(userId)
          if (result.success && result.shortcuts) {
            setKeyBindings({ ...DEFAULT_KEYBINDINGS, ...result.shortcuts })
          }
        } catch (error) {
          console.error("キーバインディングの読み込みに失敗しました:", error)
        }
      }
    }

    loadKeyBindings()
  }, [userId])

  // ============================================
  // コンテキスト値の更新
  // ============================================

  const setContextValue = useCallback(
    <K extends keyof ScoringContextState>(
      key: K,
      value: ScoringContextState[K]
    ) => {
      setContext((prev) => {
        // 変更がない場合は更新しない（無駄な再レンダリング防止）
        if (prev[key] === value) return prev
        return { ...prev, [key]: value }
      })
    },
    []
  )

  // ============================================
  // コマンドの登録・解除
  // ============================================

  const registerCommand = useCallback((command: CommandHandler) => {
    setCommands((prev) => {
      const next = new Map(prev)
      const existing = next.get(command.commandId) || []
      // 同じregistrationIdのハンドラーを置換、それ以外は保持
      const filtered = existing.filter(
        (commandHandler) =>
          commandHandler.registrationId !== command.registrationId
      )
      next.set(command.commandId, [...filtered, command])
      return next
    })
  }, [])

  const unregisterCommand = useCallback(
    (commandId: string, registrationId: string) => {
      setCommands((prev) => {
        const next = new Map(prev)
        const existing = next.get(commandId)
        if (existing) {
          const filtered = existing.filter(
            (commandHandler) => commandHandler.registrationId !== registrationId
          )
          if (filtered.length === 0) {
            next.delete(commandId)
          } else {
            next.set(commandId, filtered)
          }
        }
        return next
      })
    },
    []
  )

  // ============================================
  // キーバインディングの管理
  // ============================================

  const updateKeyBinding = useCallback(
    async (commandId: string, key: string) => {
      const newBindings = { ...keyBindings, [commandId]: key }
      setKeyBindings(newBindings)

      // 設定を保存
      if (userId && window.electronAPI?.settings) {
        try {
          await window.electronAPI.settings.saveUserKeyboardShortcuts(
            userId,
            newBindings
          )
        } catch (error) {
          console.error("キーバインディングの保存に失敗しました:", error)
        }
      }
    },
    [keyBindings, userId]
  )

  const resetKeyBindings = useCallback(async () => {
    setKeyBindings(DEFAULT_KEYBINDINGS)
    if (userId && window.electronAPI?.settings) {
      try {
        await window.electronAPI.settings.resetUserKeyboardShortcuts(userId)
      } catch (error) {
        console.error("キーバインディングのリセットに失敗しました:", error)
      }
    }
  }, [userId])

  // ============================================
  // 全コマンド取得
  // ============================================

  const getAllCommands = useCallback(() => {
    return Array.from(commands.values()).flat()
  }, [commands])

  // ============================================
  // 自動的な入力フォーカス検出
  // ============================================

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      setContextValue("inputFocus", isInput)
    }

    document.addEventListener("focusin", handleFocus, true)
    document.addEventListener("focusout", handleFocus, true)

    return () => {
      document.removeEventListener("focusin", handleFocus, true)
      document.removeEventListener("focusout", handleFocus, true)
    }
  }, [setContextValue])

  // ============================================
  // キーボードイベントハンドリング
  // ============================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // キーを正規化（macOSデッドキー対応含む）
      const key = normalizeKey(event)

      // ============================================
      // 重要: input要素内での制御
      // ============================================
      const target = event.target
      const isInputElement =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      // input要素内では、モーダル制御キー以外をスルー
      // これにより、通常の文字入力（0-9, a-z, .等）とBackspace等は正常に動作する
      if (isInputElement) {
        // ユーザー設定から部分点・保留・キャンセルのキーを取得
        const modalControlKeys = [
          keyBindings["scoring.partial"],
          keyBindings["scoring.pending"],
          keyBindings["modal.cancel"],
        ].filter(Boolean)

        if (!modalControlKeys.includes(key)) {
          // モーダル制御キー以外は通常の入力として処理（Backspace含む）
          return
        }
        // 部分点/保留/キャンセルキーの場合は、後続のコマンド評価に進む
      }

      // 逆引き: key -> commandId[] (複数のコマンドが同じキーにバインドされている可能性)
      const commandIds = Object.entries(keyBindings)
        .filter(([_, bindingKey]) => bindingKey === key)
        .map(([id]) => id)

      if (commandIds.length === 0) {
        // このキーにバインドされたコマンドはない
        return
      }

      // ============================================
      // 重要: より具体的な条件を持つコマンドを優先
      // ============================================
      // 全候補ハンドラーを収集（同一commandIdに複数ハンドラーが存在しうる）
      const candidates: CommandHandler[] = []
      for (const commandId of commandIds) {
        const handlers = commands.get(commandId) || []
        candidates.push(...handlers)
      }

      // when句の複雑さ（&&の数）でソート（降順）
      // より複雑な条件 = より具体的な状況 = 優先度が高い
      candidates.sort((candidateA, candidateB) => {
        const complexityA = (candidateA.when.match(/&&/g) || []).length
        const complexityB = (candidateB.when.match(/&&/g) || []).length
        return complexityB - complexityA
      })

      // 複数のハンドラーがある場合、when句が真になる最初のものを実行
      for (const candidate of candidates) {
        const shouldExecute = evaluateWhenClause(candidate.when, context)

        if (shouldExecute) {
          event.preventDefault()
          event.stopPropagation()

          try {
            candidate.handler()
          } catch (error) {
            console.error(
              `Failed to execute command "${candidate.commandId}":`,
              error
            )
          }

          // 最初にマッチしたコマンドのみ実行（VSCodeと同じ動作）
          return
        }
      }

      // どのコマンドも実行条件を満たさなかった
      // → イベントは通常通り処理される
    }

    // キーダウンイベントをリスニング
    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [keyBindings, commands, context])

  // ============================================
  // コンテキスト値の提供
  // ============================================

  const value: ShortcutContextValue = {
    context,
    setContextValue,
    registerCommand,
    unregisterCommand,
    keyBindings,
    updateKeyBinding,
    resetKeyBindings,
    getAllCommands,
  }

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  )
}
