/**
 * IPC ハンドラーのボイラープレートを削減するユーティリティ
 */

import type { IpcMainInvokeEvent } from "electron"
import { ipcMain } from "electron"

import type { Serialized } from "@/types/prismaExtensions"

import { serializePrisma } from "../lib/prisma/serializePrisma"
import type { IpcEnvelope } from "./ipcEnvelope"
import { toIpcErrorMessage } from "./ipcEnvelope"

/**
 * IPC ハンドラーを登録し、戻り値を搬送形式（`IpcEnvelope`）へ詰めて返す。
 * 例外は失敗のエンベロープになり、preload の `invoke` が例外へ戻す。
 * renderer から見ると reject で受け取る点は従来と変わらない。
 *
 * 戻り値には `serializePrisma` を掛ける。Decimal → number をハンドラの裁量にせず
 * 境界で一律に倒すためで、モデルごとの手書き型（`SerializedQuestionScore` 等）を
 * 増やさずに済ませる。
 *
 * 引数と戻り値の型は渡した handler から推論する。ipcMain.handle のリスナーは
 * 可変長引数が any[] で宣言されているため、こちら側で型変数として受け直せる。
 */
export function registerHandler<HandlerArgs extends unknown[], HandlerResult>(
  channel: string,
  handler: (...args: HandlerArgs) => HandlerResult | Promise<HandlerResult>
): void {
  ipcMain.handle(
    channel,
    async (
      _event,
      ...args: HandlerArgs
    ): Promise<IpcEnvelope<Serialized<HandlerResult>>> => {
      try {
        return { __ipc: "ok", value: serializePrisma(await handler(...args)) }
      } catch (err) {
        console.error(`Error in IPC handler [${channel}]:`, err)
        return {
          __ipc: "failed",
          error: toIpcErrorMessage(err, "Unknown error"),
        }
      }
    }
  )
}

/**
 * `event` を必要とするハンドラーを登録する。
 *
 * `event.sender` からウィンドウや履歴を取る経路（フルスクリーン制御・印刷・
 * アーカイブの進捗通知など）は第1引数に `event` が要るため `registerHandler` の
 * 形に収まらない。搬送形式と `serializePrisma` は同じように掛かる。
 */
export function registerEventHandler<
  HandlerArgs extends unknown[],
  HandlerResult,
>(
  channel: string,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: HandlerArgs
  ) => HandlerResult | Promise<HandlerResult>
): void {
  ipcMain.handle(
    channel,
    async (
      event,
      ...args: HandlerArgs
    ): Promise<IpcEnvelope<Serialized<HandlerResult>>> => {
      try {
        return {
          __ipc: "ok",
          value: serializePrisma(await handler(event, ...args)),
        }
      } catch (err) {
        console.error(`Error in IPC handler [${channel}]:`, err)
        return {
          __ipc: "failed",
          error: toIpcErrorMessage(err, "Unknown error"),
        }
      }
    }
  )
}
