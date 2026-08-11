/**
 * IPC の搬送形式の往復テスト。
 *
 * 境界（`registerChannel`）が詰めた形を preload の `invoke` がほどけることを固定する。
 * ここが食い違うと全チャンネルが同時に壊れるが、他の単体テストは prisma クライアントを
 * 直接叩くのでこの層を一切通らない。
 *
 * 詳細は docs/ipc-and-data-fetching-plan.md 段階2・3・5。
 */

import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

/** ipcMain.handle で登録されたリスナーを channel ごとに保持する */
const listeners = new Map<
  string,
  (event: unknown, ...args: unknown[]) => Promise<unknown>
>()

vi.mock("electron", () => ({
  ipcMain: {
    handle: (
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => Promise<unknown>
    ) => {
      listeners.set(channel, listener)
    },
  },
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      const listener = listeners.get(channel)
      if (!listener) throw new Error(`未登録のチャンネル: ${channel}`)
      return listener({}, ...args)
    },
  },
}))

import { registerChannel } from "../../../electron-src/ipc-handlers/ipcHandlerUtils"
import { invoke } from "../../../electron-src/preload-apis/invoke"

/**
 * 搬送形式そのものを見るテストなので、実在しないチャンネル名を使う。
 * 本番の `invoke` はチャンネル名を登録簿（`Handlers`）に縛るため、ここだけ緩める。
 */
const invokeAnyChannel = invoke as unknown as (
  channel: string,
  ...args: unknown[]
) => Promise<unknown>

describe("IPC 搬送形式の往復", () => {
  beforeEach(() => {
    listeners.clear()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("チャンネルの戻り値が payload として届く", async () => {
    registerChannel("test:ok", async (examId: string) => ({ examId }))

    await expect(invokeAnyChannel("test:ok", "exam-1")).resolves.toEqual({
      examId: "exam-1",
    })
  })

  it("チャンネルの例外は文言を保って reject になる", async () => {
    registerChannel("test:throws", async () => {
      throw new Error("設問が見つかりません")
    })

    await expect(invokeAnyChannel("test:throws")).rejects.toThrow(
      "設問が見つかりません"
    )
  })

  it("境界で Decimal が number へ倒れる", async () => {
    registerChannel("test:decimal", async () => ({
      partialScore: new Prisma.Decimal(2.5),
    }))

    await expect(invokeAnyChannel("test:decimal")).resolves.toEqual({
      partialScore: 2.5,
    })
  })

  it("境界でバイナリが展開されない", async () => {
    registerChannel("test:binary", async () => ({
      image: new Uint8Array([137, 80]),
    }))

    const result = await invokeAnyChannel("test:binary")
    expect(result).toEqual({ image: new Uint8Array([137, 80]) })
  })

  it("エンベロープでない戻り値はそのまま通す", async () => {
    listeners.set("test:raw", async () => ({ raw: true }))

    await expect(invokeAnyChannel("test:raw")).resolves.toEqual({ raw: true })
  })

  it("payload が偶然 success を持っていてもほどきに影響しない", async () => {
    registerChannel("test:legacy-shape", async () => ({
      success: true,
      grade: { id: "grade-1" },
    }))

    await expect(invokeAnyChannel("test:legacy-shape")).resolves.toEqual({
      success: true,
      grade: { id: "grade-1" },
    })
  })

  it("null を返すハンドラの結果が null のまま届く", async () => {
    registerChannel("test:null", async () => null)

    await expect(invokeAnyChannel("test:null")).resolves.toBeNull()
  })
})
