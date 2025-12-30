/**
 * コマンド登録フック
 * コンポーネント内でショートカットコマンドを登録するために使用
 *
 * 使用例:
 * ```tsx
 * useCommand('scoring.correct', handleCorrect, {
 *   when: '!inputFocus && !modalOpen && hasSelectedAnswers',
 *   metadata: {
 *     title: '正答として採点',
 *     category: '採点',
 *     description: '選択中の答案を正答として採点します',
 *   },
 * })
 * ```
 */

import { useCallback, useEffect, useMemo, useRef } from "react"
import type {
  CommandHandler,
  CommandMetadata,
} from "../ScoringMain/contexts/shortcutContextTypes"
import { useShortcutContext } from "../ScoringMain/contexts/ShortcutProvider"

/**
 * メタデータの同値性を判定するために安定したシグネチャを生成
 */
function createMetadataSignature(metadata?: CommandMetadata): string {
  if (!metadata) return "null"
  try {
    return JSON.stringify(metadata)
  } catch {
    return "nonserializable"
  }
}

/**
 * useCommandのオプション
 */
export interface UseCommandOptions {
  /**
   * 実行条件を表すwhen句（JavaScript式として評価される）
   * デフォルト: "true" （常に有効）
   *
   * 利用可能な変数:
   * - inputFocus: input/textareaにフォーカスがある
   * - textEditorActive: リッチテキストエディタが開いている
   * - gradingMode: "grid" | "individual"
   * - modalOpen: 何らかのモーダルが開いている
   * - partialScoreModalOpen: 部分点入力モーダルが開いている
   * - sidePanelVisible: サイドパネルが表示されている
   * - hasSelectedAnswers: 答案が選択されている
   *
   * 例:
   * - "!inputFocus" - 入力フォーカス中以外
   * - "!inputFocus && !modalOpen" - 入力中でもモーダル中でもない
   * - "gradingMode == 'grid' && hasSelectedAnswers" - グリッドモードで答案が選択されている
   * - "partialScoreModalOpen" - 部分点モーダルが開いている
   */
  when?: string

  /**
   * コマンドのメタデータ（設定画面での表示用）
   */
  metadata?: CommandMetadata
}

/**
 * コマンドを登録するフック
 * コンポーネントのマウント時に自動的に登録され、アンマウント時に自動的に解除される
 *
 * @param commandId - コマンドID（例: "scoring.correct"）
 * @param handler - コマンド実行時のハンドラー関数
 * @param options - オプション（when句、メタデータなど）
 */
export function useCommand(
  commandId: string,
  handler: () => void,
  options: UseCommandOptions = {}
) {
  const { registerCommand, unregisterCommand } = useShortcutContext()

  // handlerの最新版をrefで保持（無限ループ回避）
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  // 安定したwrapper関数を作成
  const stableHandler = useCallback(() => {
    handlerRef.current()
  }, [])

  // メタデータを安定化（内容が変わらない限り再登録しない）
  const metadataSignature = useMemo(
    () => createMetadataSignature(options.metadata),
    [options.metadata]
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps -- metadataSignature already reflects changes to options.metadata
  const stableMetadata = useMemo(() => options.metadata, [metadataSignature])

  // when句を安定化
  const when = options.when || "true"

  useEffect(() => {
    // コマンドオブジェクトを作成
    const command: CommandHandler = {
      commandId,
      handler: stableHandler,
      when,
      metadata: stableMetadata,
    }

    // コマンドを登録
    registerCommand(command)

    // アンマウント時に解除
    return () => {
      unregisterCommand(commandId)
    }
  }, [
    commandId,
    stableHandler,
    when,
    stableMetadata,
    registerCommand,
    unregisterCommand,
  ])
}
