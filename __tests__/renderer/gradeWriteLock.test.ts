/**
 * 成績算出のロック中は、書き込みが中央（`MutationCache`）で止まることの検証。
 *
 * 画面ごとに欄を塞ぐと漏れるので、止めるのは `createAppQueryClient` の1か所だけに
 * している。ここが効かないと、使われている試験の点数・配点が黙って変わる。
 *
 * 1. **ロック中は DB を書く書き込みが走らない。** mutationFn も、個々の `onMutate`
 *    （楽観的な書き換え）も呼ばれず、失敗トーストではなくロックの通知が出る
 * 2. **止めないもの**: DB を書かないもの（出力など）と、`bypassesGradeLock` を
 *    名乗るもの（利用者の設定・監査ログなど）
 * 3. **手放せば走る。** 後から握り直したロックは、前の手放しで外れない
 */

import { MutationObserver } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  GradeWriteLockedError,
  holdGradeWriteLock,
} from "../../src/lib/gradeWriteLock"
import { defineMutation } from "../../src/queries/defineMutation"
import { createAppQueryClient } from "../../src/queries/queryClient"
import type { AppMutationMeta } from "../../src/queries/registerMeta"

const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

const DB_WRITE: AppMutationMeta = {
  invalidates: [["exam", "exam-1"]],
  errorMessage: "配点を保存できませんでした",
}

let release: (() => void) | null = null

beforeEach(() => {
  toast.error.mockClear()
  toast.info.mockClear()
})

afterEach(() => {
  release?.()
  release = null
})

/** mutation を1回走らせて、mutationFn・onMutate が呼ばれたかと、決着を返す */
async function runMutation(meta: AppMutationMeta) {
  const client = createAppQueryClient()
  const mutationFn = vi.fn(async () => "ok")
  const onMutate = vi.fn()
  const observer = new MutationObserver(
    client,
    defineMutation({ mutationFn, onMutate, meta })
  )
  const result = await observer.mutate(undefined).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  )
  return { mutationFn, onMutate, result }
}

describe("成績算出のロックで書き込みを止める", () => {
  it("ロック中は、DB を書く書き込みを実行しない", async () => {
    release = holdGradeWriteLock()

    const { mutationFn, onMutate, result } = await runMutation(DB_WRITE)

    expect(mutationFn).not.toHaveBeenCalled()
    // 楽観的な書き換えも走らない（画面が先に変わらない）
    expect(onMutate).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBeInstanceOf(GradeWriteLockedError)
    // 失敗としては知らせず、ロックの通知を1つに畳んで出す
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(
      "成績算出で使われているため、ロックしています",
      expect.objectContaining({ id: "grade-write-lock" })
    )
  })

  it("ロックしていなければ、そのまま書く", async () => {
    const { mutationFn, result } = await runMutation(DB_WRITE)

    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it("DB を書かないもの（出力・印刷など）は止めない", async () => {
    release = holdGradeWriteLock()

    const { mutationFn } = await runMutation({
      writesDatabase: false,
      errorMessage: "出力できませんでした",
    })

    expect(mutationFn).toHaveBeenCalledTimes(1)
  })

  it("bypassesGradeLock を名乗るもの（設定・監査ログなど）は止めない", async () => {
    release = holdGradeWriteLock()

    const { mutationFn } = await runMutation({
      invalidates: [["userPreference", "user-1"]],
      errorMessage: "設定を保存できませんでした",
      bypassesGradeLock: true,
    })

    expect(mutationFn).toHaveBeenCalledTimes(1)
  })

  it("手放すと書ける", async () => {
    const releaseLock = holdGradeWriteLock()
    releaseLock()

    const { mutationFn } = await runMutation(DB_WRITE)

    expect(mutationFn).toHaveBeenCalledTimes(1)
  })

  it("握り直したロックは、前の手放しでは外れない", async () => {
    const releaseOld = holdGradeWriteLock()
    release = holdGradeWriteLock()
    // 別の試験へ移ったとき、前の layout の後始末が後から走っても外さない
    releaseOld()

    const { mutationFn } = await runMutation(DB_WRITE)

    expect(mutationFn).not.toHaveBeenCalled()
  })
})
