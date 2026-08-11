/**
 * IPCハンドラをテストから直接呼ぶためのハーネス
 *
 * `__tests__/setup.ts` が electron の `ipcMain.handle` を `vi.fn()` に差し替えているので、
 * `registerXxxHandlers()` を呼ぶとコールバックはモックに記録されるだけで実行できない。
 * 記録された呼び出しからチャンネル名でコールバックを取り出し、`_event` を補って呼ぶ。
 *
 * これが無いと、ハンドラに書いた分岐（「対象が1件も無ければエラーを返す」等）を
 * 実行時に検証できない。main の関数に切り出せる処理はそちらでテストする方が軽いので、
 * ハーネスを使うのは「ハンドラ自身が持つ判断」を見たいときに限る。
 */
import { ipcMain } from "electron"
import { expect, vi } from "vitest"

import { isIpcEnvelope } from "@/electron-src/ipc-handlers/ipcEnvelope"

type RegisteredHandler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>

/**
 * 登録済みハンドラを取り出す。
 *
 * @param registerHandlers - `registerOmrHandlers` 等の登録関数。呼ぶ前にモックを初期化する
 * @param channel - `omr:detect-master-markers` 等のチャンネル名
 */
export function captureIpcHandler(
  registerHandlers: () => void,
  channel: string
): (...args: unknown[]) => Promise<unknown> {
  const handleMock = vi.mocked(ipcMain.handle)
  handleMock.mockClear()

  registerHandlers()

  const registration = handleMock.mock.calls.find((call) => call[0] === channel)
  expect(
    registration,
    `IPCチャンネル ${channel} が登録されていない`
  ).toBeDefined()

  const handler = registration![1] as RegisteredHandler
  // 境界が詰めた搬送形式をほどく。preload の `invoke` と同じ扱いにして、
  // テストが見るのは payload だけにする（`registerHandler` / `registerEventHandler`
  // のどちらで登録されていても呼び出し側の書き方が変わらない）。
  return async (...args: unknown[]) => {
    const result: unknown = await handler({}, ...args)

    if (!isIpcEnvelope(result)) return result
    if (result.__ipc === "failed") throw new Error(result.error)

    return result.value
  }
}
