/**
 * IPC の搬送形式の往復テスト。
 *
 * 境界（`registerHandler` / `registerSafeHandler`）が詰めた形を、preload の
 * `invoke` がほどけることを固定する。ここが食い違うと全チャンネルが同時に壊れるが、
 * 他の単体テストは prisma クライアントを直接叩くのでこの層を一切通らない。
 *
 * 詳細は docs/ipc-and-data-fetching-plan.md 段階2・3。
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

import {
  registerHandler,
  registerSafeHandler,
} from "../../../electron-src/ipc-handlers/ipcHandlerUtils"
import { invoke } from "../../../electron-src/preload-apis/invoke"

describe("IPC 搬送形式の往復", () => {
  beforeEach(() => {
    listeners.clear()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("registerHandler の戻り値が payload として届く", async () => {
    registerHandler("test:ok", async (examId: string) => ({ examId }))

    await expect(invoke("test:ok", "exam-1")).resolves.toEqual({
      examId: "exam-1",
    })
  })

  it("registerHandler の例外は文言を保って reject になる", async () => {
    registerHandler("test:throws", async () => {
      throw new Error("設問が見つかりません")
    })

    await expect(invoke("test:throws")).rejects.toThrow("設問が見つかりません")
  })

  it("境界で Decimal が number へ倒れる", async () => {
    registerHandler("test:decimal", async () => ({
      partialScore: new Prisma.Decimal(2.5),
    }))

    await expect(invoke("test:decimal")).resolves.toEqual({ partialScore: 2.5 })
  })

  it("境界でバイナリが展開されない", async () => {
    registerHandler("test:binary", async () => ({
      image: new Uint8Array([137, 80]),
    }))

    const result = await invoke("test:binary")
    expect(result).toEqual({ image: new Uint8Array([137, 80]) })
  })

  it("registerSafeHandler の例外は payload の { success: false } として届く", async () => {
    registerSafeHandler(
      "test:safe",
      async () => {
        throw new Error("保存に失敗しました")
      },
      "既定の文言"
    )

    await expect(invoke("test:safe")).resolves.toEqual({
      success: false,
      error: "保存に失敗しました",
    })
  })

  it("registerSafeHandler は文言の無い例外で fallbackError を使う", async () => {
    registerSafeHandler(
      "test:safe-fallback",
      async () => {
        throw new Error("")
      },
      "既定の文言"
    )

    await expect(invoke("test:safe-fallback")).resolves.toEqual({
      success: false,
      error: "既定の文言",
    })
  })

  it("エンベロープでない戻り値はそのまま通す（生 ipcMain.handle のチャンネル）", async () => {
    listeners.set("test:raw", async () => ({ raw: true }))

    await expect(invoke("test:raw")).resolves.toEqual({ raw: true })
  })

  it("payload が偶然 success を持っていてもほどきに影響しない", async () => {
    registerHandler("test:legacy-shape", async () => ({
      success: true,
      grade: { id: "grade-1" },
    }))

    await expect(invoke("test:legacy-shape")).resolves.toEqual({
      success: true,
      grade: { id: "grade-1" },
    })
  })

  it("null を返すハンドラの結果が null のまま届く", async () => {
    registerHandler("test:null", async () => null)

    await expect(invoke("test:null")).resolves.toBeNull()
  })
})
