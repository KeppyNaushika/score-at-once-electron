/**
 * IPC 境界。チャンネルの実装を受け取り、搬送形式（`IpcEnvelope`）へ詰めて登録する。
 *
 * 例外は失敗のエンベロープになり、preload の `invoke` が例外へ戻す。戻り値には
 * `serializePrisma` を掛ける — Decimal → number をハンドラの裁量にせず境界で一律に
 * 倒すためで、モデルごとの手書き型（`SerializedQuestionScore` 等）を増やさずに済む。
 */

import type { IpcMainInvokeEvent } from "electron"
import { ipcMain } from "electron"

import { serializePrisma } from "../lib/prisma/serializePrisma"
import { toIpcErrorMessage } from "./ipcEnvelope"

/** `withEvent` で包んだことの目印。登録側が `event` を渡すかの判断に使う */
export const EVENT_HANDLER = Symbol("ipcEventHandler")

/**
 * `event` を必要とするハンドラーに印を付ける。
 *
 * `event.sender` からウィンドウや履歴を取る経路（フルスクリーン制御・ナビゲーション
 * 履歴など）は第1引数に `event` が要る。ここで包むと **型の上では第1引数が消える**ので、
 * preload が `Parameters<>` から引数を導いても renderer の呼び出しと形が揃う。
 */
export function withEvent<HandlerArgs extends unknown[], HandlerResult>(
  handler: (
    event: IpcMainInvokeEvent,
    ...args: HandlerArgs
  ) => HandlerResult | Promise<HandlerResult>
): ((...args: HandlerArgs) => HandlerResult | Promise<HandlerResult>) & {
  [EVENT_HANDLER]: true
} {
  return Object.assign(handler as never, { [EVENT_HANDLER]: true as const })
}

/** 1チャンネル分の実装 */
type ChannelHandler = (...args: never[]) => unknown

/** チャンネル名 → 実装。ハンドラー各ファイルが `satisfies HandlerMap` で名乗る */
export type HandlerMap = Record<string, ChannelHandler>

/** 1チャンネルを登録する。`index.ts` の一括登録から呼ぶ */
export function registerChannel(
  channel: string,
  handler: ChannelHandler
): void {
  const takesEvent = EVENT_HANDLER in handler
  const call = handler as (...args: unknown[]) => unknown
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const value = takesEvent
        ? await call(event, ...args)
        : await call(...args)
      return { __ipc: "ok", value: serializePrisma(value) }
    } catch (err) {
      console.error(`Error in IPC handler [${channel}]:`, err)
      return { __ipc: "failed", error: toIpcErrorMessage(err, "Unknown error") }
    }
  })
}
