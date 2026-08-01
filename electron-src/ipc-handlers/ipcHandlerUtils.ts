/**
 * IPC ハンドラーのボイラープレートを削減するユーティリティ
 */

import { ipcMain } from "electron"

/**
 * IPC ハンドラーを登録し、try-catch + エラーログを自動適用する。
 * エラー時は例外をそのまま再スローする（呼び出し元でハンドリングされる）。
 *
 * 引数と戻り値の型は渡した handler から推論する。ipcMain.handle のリスナーは
 * 可変長引数が any[] で宣言されているため、こちら側で型変数として受け直せる。
 */
export function registerHandler<HandlerArgs extends unknown[], HandlerResult>(
  channel: string,
  handler: (...args: HandlerArgs) => HandlerResult | Promise<HandlerResult>
): void {
  ipcMain.handle(channel, async (_event, ...args: HandlerArgs) => {
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
export function registerSafeHandler<
  HandlerArgs extends unknown[],
  HandlerResult,
>(
  channel: string,
  handler: (...args: HandlerArgs) => HandlerResult | Promise<HandlerResult>,
  fallbackError?: string
): void {
  ipcMain.handle(channel, async (_event, ...args: HandlerArgs) => {
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
