/**
 * キーバインディング管理フック
 * 設定画面でキーバインディングを取得・更新するために使用
 *
 * 使用例:
 * ```tsx
 * const { allCommands, keyBindings, updateKeyBinding, resetKeyBindings } = useKeyBindings()
 *
 * // 全コマンドを表示
 * allCommands.map(command => (
 *   <div key={command.commandId}>
 *     {command.metadata?.title}: {keyBindings[command.commandId]}
 *   </div>
 * ))
 *
 * // キーバインディングを更新
 * updateKeyBinding('scoring.correct', 'x')
 *
 * // デフォルトに戻す
 * resetKeyBindings()
 * ```
 */

import type {
  CommandHandler,
  KeyBinding,
} from "../ScoringMain/contexts/ShortcutContextTypes"
import { useShortcutContext } from "../ScoringMain/contexts/ShortcutProvider"

/**
 * キーバインディング管理の結果
 */
export interface UseKeyBindingsResult {
  /** 登録されている全コマンド */
  allCommands: CommandHandler[]

  /** 現在のキーバインディング */
  keyBindings: KeyBinding

  /**
   * キーバインディングを更新
   * @param commandId - コマンドID
   * @param key - 新しいキー
   */
  updateKeyBinding: (commandId: string, key: string) => void

  /**
   * キーバインディングをデフォルトに戻す
   */
  resetKeyBindings: () => void

  /**
   * 指定されたキーが他のコマンドで使用されているかチェック
   * @param key - チェックするキー
   * @param excludeCommandId - 除外するコマンドID（現在編集中のコマンド）
   * @returns 使用されている場合は、そのコマンドIDを返す。使用されていなければundefined
   */
  findConflictingCommand: (
    key: string,
    excludeCommandId?: string
  ) => string | undefined
}

/**
 * キーバインディングを管理するフック
 * ShortcutProviderのコンテキストから取得
 *
 * 注意: このフックはShortcutProvider内でのみ使用可能
 * 一括採点画面以外では使用できない
 */
export function useKeyBindings(): UseKeyBindingsResult {
  const { getAllCommands, keyBindings, updateKeyBinding, resetKeyBindings } =
    useShortcutContext()

  /**
   * 指定されたキーが他のコマンドで使用されているかチェック
   */
  const findConflictingCommand = (
    key: string,
    excludeCommandId?: string
  ): string | undefined => {
    return Object.entries(keyBindings).find(
      ([commandId, bindingKey]) =>
        bindingKey === key && commandId !== excludeCommandId
    )?.[0]
  }

  return {
    allCommands: getAllCommands(),
    keyBindings,
    updateKeyBinding,
    resetKeyBindings,
    findConflictingCommand,
  }
}
