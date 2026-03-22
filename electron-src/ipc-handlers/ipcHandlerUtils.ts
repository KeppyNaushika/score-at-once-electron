/**
 * IPC ハンドラーのボイラープレートを削減するユーティリティ
 */

import { ipcMain } from "electron"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFunction = (...args: any[]) => any

/**
 * IPC ハンドラーを登録し、try-catch + エラーログを自動適用する。
 * エラー時は例外をそのまま再スローする（呼び出し元でハンドリングされる）。
 */
export function registerHandler(
  channel: string,
  handler: HandlerFunction
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await handler(...args)
    } catch (err) {
      console.error(`Error in IPC handler [${channel}]:`, err)
      throw err
    }
  })
}

/**
 * IPC ハンドラーを登録し、try-catch + エラーログを自動適用する。
 * エラー時は例外をスローせず、{ success: false, error: message } を返す。
 */
export function registerSafeHandler(
  channel: string,
  handler: HandlerFunction,
  fallbackError?: string
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await handler(...args)
    } catch (err) {
      console.error(`Error in IPC handler [${channel}]:`, err)
      return {
        success: false,
        error:
          err instanceof Error ? err.message : fallbackError || "Unknown error",
      }
    }
  })
}
