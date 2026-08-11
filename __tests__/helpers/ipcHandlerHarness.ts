/**
 * IPCハンドラをテストから直接呼ぶためのハーネス
 *
 * `__tests__/setup.ts` が electron の `ipcMain.handle` を `vi.fn()` に差し替えているので、
 * 登録簿の実装を `registerChannel` へ通すとコールバックはモックに記録されるだけで
 * 実行できない。記録された呼び出しからコールバックを取り出し、`_event` を補って呼ぶ。
 *
 * 実装を直接呼ばず境界を通すのは、`serializePrisma` と搬送形式を本番と同じ経路で
 * 通すため（Decimal → number の変換が抜けた状態でテストが通ってしまわないように）。
 *
 * これが無いと、ハンドラに書いた分岐（「対象が1件も無ければエラーを返す」等）を
 * 実行時に検証できない。main の関数に切り出せる処理はそちらでテストする方が軽いので、
 * ハーネスを使うのは「ハンドラ自身が持つ判断」を見たいときに限る。
 */
import { ipcMain } from "electron"
import { expect, vi } from "vitest"

import { isIpcEnvelope } from "@/electron-src/ipc-handlers/ipcEnvelope"
import type { HandlerMap } from "@/electron-src/ipc-handlers/ipcHandlerUtils"
import { registerChannel } from "@/electron-src/ipc-handlers/ipcHandlerUtils"

type RegisteredHandler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>

/**
 * 登録簿の1チャンネルを境界ごと呼べる関数にする。
 *
 * @param handlers - `omrHandlers` 等のチャンネル登録簿
 * @param channel - `omr:detect-master-markers` 等のチャンネル名
 */
export function captureIpcHandler(
  handlers: HandlerMap,
  channel: string
): (...args: unknown[]) => Promise<unknown> {
  const handleMock = vi.mocked(ipcMain.handle)
  handleMock.mockClear()

  const implementation = handlers[channel]
  expect(
    implementation,
    `IPCチャンネル ${channel} が登録簿に無い`
  ).toBeDefined()
  registerChannel(channel, implementation)

  const registration = handleMock.mock.calls.find((call) => call[0] === channel)
  expect(
    registration,
    `IPCチャンネル ${channel} が登録されていない`
  ).toBeDefined()

  const handler = registration![1] as RegisteredHandler
  // 境界が詰めた搬送形式をほどく。preload の `invoke` と同じ扱いにして、
  // テストが見るのは payload だけにする。
  return async (...args: unknown[]) => {
    const result: unknown = await handler({}, ...args)

    if (!isIpcEnvelope(result)) return result
    if (result.__ipc === "failed") throw new Error(result.error)

    return result.value
  }
}
