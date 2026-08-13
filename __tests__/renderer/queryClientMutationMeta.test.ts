/**
 * 書き込みの後始末が1箇所で効いていることの検証。
 *
 * 各書き込みは `meta` で「何を取り直すか」「失敗したら何と言うか」を宣言するだけで、
 * 実装は `createAppQueryClient` の `MutationCache` にしか無い。ここが効かないと、
 * 全ての書き込みが黙って取り直さなくなる（＝保存できなかった値を保存済みとして
 * 表示し続ける）ので、中央処理だけを直接確かめる。
 */

import { MutationObserver, QueryObserver } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { defineMutation } from "../../src/queries/defineMutation"
import { createAppQueryClient } from "../../src/queries/queryClient"

const toastError = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({ toast: { error: toastError } }))

const QUERY_KEY = ["grade", "g1", "exclusions"] as const

beforeEach(() => {
  toastError.mockClear()
})

/** mutation を1回走らせて、決着するまで待つ */
async function runMutation(
  client: ReturnType<typeof createAppQueryClient>,
  mutationFn: () => Promise<unknown>
) {
  const observer = new MutationObserver(
    client,
    defineMutation({
      mutationFn,
      meta: {
        invalidates: QUERY_KEY,
        errorMessage: "対象生徒の設定を保存できませんでした",
      },
    })
  )
  await observer.mutate().catch(() => {
    // 失敗経路も検証したいので、ここでは投げ直さない
  })
}

describe("書き込みの後始末", () => {
  it("連打しても取り直しは1回にまとまる", async () => {
    const client = createAppQueryClient()
    const queryFn = vi.fn(async () => "data")
    // 画面が開いている状態を作る（active でなければ取り直しは走らない）
    const queryObserver = new QueryObserver(client, {
      queryKey: QUERY_KEY,
      queryFn,
    })
    const unsubscribe = queryObserver.subscribe(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))
    const afterInitial = queryFn.mock.calls.length

    const observer = new MutationObserver(
      client,
      defineMutation({
        mutationFn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1))
        },
        scope: { id: "grade:g1" },
        meta: { invalidates: QUERY_KEY, errorMessage: "失敗" },
      })
    )
    // 10マスを続けて切り替える
    await Promise.all(Array.from({ length: 10 }, () => observer.mutate()))
    await new Promise((resolve) => setTimeout(resolve, 50))

    // まとめないと10回走る（実測で確認済み）
    expect(queryFn.mock.calls.length - afterInitial).toBe(1)
    unsubscribe()
  })

  it("成功したら meta.invalidates を取り直す", async () => {
    const client = createAppQueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await runMutation(client, async () => "ok")

    expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEY })
  })

  it("失敗しても取り直す（書けなかった値を表示に残さない）", async () => {
    const client = createAppQueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await runMutation(client, async () => {
      throw new Error("DB is locked")
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEY })
  })

  it("失敗したら meta.errorMessage を見出しにして知らせる", async () => {
    const client = createAppQueryClient()

    await runMutation(client, async () => {
      throw new Error("DB is locked")
    })

    expect(toastError).toHaveBeenCalledWith(
      "対象生徒の設定を保存できませんでした",
      { description: "DB is locked" }
    )
  })
})
