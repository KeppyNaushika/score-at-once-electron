/**
 * 書き込みの後始末が1箇所で効いていることの検証。
 *
 * 各書き込みは `meta` で「何を取り直すか」「失敗したら何と言うか」を宣言するだけで、
 * 実装は `createAppQueryClient` の `MutationCache` にしか無い。ここが効かないと、
 * 全ての書き込みが黙って取り直さなくなる（＝保存できなかった値を保存済みとして
 * 表示し続ける）ので、中央処理だけを直接確かめる。
 */

import {
  MutationObserver,
  onlineManager,
  QueryObserver,
} from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
        invalidates: [QUERY_KEY],
        errorMessage: "対象生徒の設定を保存できませんでした",
      },
    })
  )
  await observer.mutate().catch(() => {
    // 失敗経路も検証したいので、ここでは投げ直さない
  })
}

describe("meta の型（コンパイル時に強制されること）", () => {
  // 以下は実行時ではなく **型** の検証である。`@ts-expect-error` が付いた行が
  // 通るようになったら（＝型が緩んだら）`npm run typecheck` が落ちる。
  it("DB を書くなら invalidates を省略できない", () => {
    defineMutation({
      mutationFn: async () => "ok",
      // @ts-expect-error invalidates も writesDatabase も名乗っていない
      meta: { errorMessage: "保存できませんでした" },
    })
  })

  it("行き先が空では書けない", () => {
    defineMutation({
      mutationFn: async () => "ok",
      // @ts-expect-error 行き先が1つも無いなら、それは DB を書いていない
      meta: { invalidates: [], errorMessage: "保存できませんでした" },
    })
  })

  it("空のキーは書けない（前方一致で全クエリに当たるため）", () => {
    defineMutation({
      mutationFn: async () => "ok",
      // @ts-expect-error 空配列のキーは NonEmptyQueryKey を満たさない
      meta: { invalidates: [[]], errorMessage: "保存できませんでした" },
    })
  })

  it("行き先は複数書ける", () => {
    defineMutation({
      mutationFn: async () => "ok",
      meta: {
        invalidates: [QUERY_KEY, ["gradeSourceFits", "g1"] as const],
        errorMessage: "保存できませんでした",
      },
    })
  })

  it("DB を書かないと名乗りながら取り直す先は持てない", () => {
    defineMutation({
      mutationFn: async () => "ok",
      meta: {
        writesDatabase: false,
        // @ts-expect-error 書かないと名乗る以上、取り直す先は存在しない
        invalidates: [QUERY_KEY],
        errorMessage: "書き出せませんでした",
      },
    })
  })

  it("DB を書かない経路は writesDatabase: false だけで足りる", () => {
    defineMutation({
      mutationFn: async () => "ok",
      meta: { writesDatabase: false, errorMessage: "書き出せませんでした" },
    })
  })
})

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
        meta: { invalidates: [QUERY_KEY], errorMessage: "失敗" },
      })
    )
    // 10マスを続けて切り替える
    await Promise.all(Array.from({ length: 10 }, () => observer.mutate()))
    await new Promise((resolve) => setTimeout(resolve, 50))

    // まとめないと10回走る（実測で確認済み）
    expect(queryFn.mock.calls.length - afterInitial).toBe(1)
    unsubscribe()
  })

  it("行き先の広い書き込みは、狭い書き込みを見て黙らない", async () => {
    // 照合が前方一致だと、[["exam","E1"]] は [["exam","E1","cropRegions"]] に
    // 一致してしまう。狭い方は自分のキーしか取り直さないので、広い方が黙ると
    // 試験まるごとの取り直しが誰にも行われない
    const client = createAppQueryClient()
    const broadKey = ["exam", "E1"] as const
    const narrowKey = ["exam", "E1", "cropRegions"] as const
    const queryFn = vi.fn(async () => "data")
    const queryObserver = new QueryObserver(client, {
      queryKey: broadKey,
      queryFn,
    })
    const unsubscribe = queryObserver.subscribe(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))
    const afterInitial = queryFn.mock.calls.length

    const narrow = new MutationObserver(
      client,
      defineMutation({
        mutationFn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30))
        },
        meta: { invalidates: [narrowKey], errorMessage: "失敗" },
      })
    )
    const broad = new MutationObserver(
      client,
      defineMutation({
        mutationFn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1))
        },
        meta: { invalidates: [broadKey], errorMessage: "失敗" },
      })
    )

    // 狭い方が走っている最中に、広い方が終わる
    const narrowDone = narrow.mutate()
    await broad.mutate()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(queryFn.mock.calls.length - afterInitial).toBe(1)
    await narrowDone
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

describe("オフラインでも止まらない", () => {
  // データはローカルの SQLite で、IPC はネットワークを跨がない。既定の
  // networkMode:"online" のままだと、Wi-Fi を切った端末で navigator.onLine が
  // false になり、**全クエリが paused のまま固まって採点も保存されない**。
  // NAS の共有ファイルに触れるのは sqlite-nas-sync だけで、その経路は
  // React Query を通らない（docs/branch-review-findings.md #5）。
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it("オンライン判定が false でも取得が走る", async () => {
    onlineManager.setOnline(false)
    const client = createAppQueryClient()
    const fetchData = vi.fn(async () => "取れた")

    const observer = new QueryObserver(client, {
      queryKey: ["offline-probe"],
      queryFn: fetchData,
    })
    const unsubscribe = observer.subscribe(() => {})
    await vi.waitFor(() => expect(fetchData).toHaveBeenCalled())
    unsubscribe()

    expect(observer.getCurrentResult().fetchStatus).not.toBe("paused")
  })

  it("オンライン判定が false でも書き込みが走る", async () => {
    onlineManager.setOnline(false)
    const client = createAppQueryClient()
    const write = vi.fn(async () => "書けた")

    await runMutation(client, write)

    expect(write).toHaveBeenCalled()
  })
})
