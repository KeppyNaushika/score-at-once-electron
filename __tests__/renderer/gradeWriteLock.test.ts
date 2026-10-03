/**
 * 成績算出のロックで main が断った書き込みを、renderer が失敗ではなくロックの知らせとして
 * 出すことの検証。
 *
 * 止める判定は main（`electron-src/lib/prisma/gradeWriteLock.ts`）の DB の手前にあり、
 * renderer は書き込みを分類しない。renderer の `MutationCache` は書き込みを止めず、
 * 断られたことを見分けて知らせ方を変えるだけ。
 *
 * 1. **断られた書き込みは、失敗トーストでなくロックの知らせ（1つに畳む）を出す**
 * 2. **renderer は書き込みを止めない。** mutationFn はロックの有無に関わらず走る
 *    （止めるかどうかは main が書き込み先のテーブルで決める）
 * 3. **ほかの失敗はこれまでどおり失敗トースト**
 */

import { MutationObserver } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GRADE_WRITE_LOCKED_MESSAGE } from "../../src/lib/shared/gradeWriteLock"
import { defineMutation } from "../../src/queries/defineMutation"
import { createAppQueryClient } from "../../src/queries/queryClient"
import type { AppMutationMeta } from "../../src/queries/registerMeta"

const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

const DB_WRITE: AppMutationMeta = {
  invalidates: [["exam", "exam-1"]],
  errorMessage: "配点を保存できませんでした",
}

beforeEach(() => {
  toast.error.mockClear()
  toast.info.mockClear()
})

/** mutation を1回走らせて、mutationFn が呼ばれたかと、決着を返す */
async function runMutation(mutationFn: () => Promise<string>) {
  const client = createAppQueryClient()
  const observedMutationFn = vi.fn(mutationFn)
  const observer = new MutationObserver(
    client,
    defineMutation({ mutationFn: observedMutationFn, meta: DB_WRITE })
  )
  const result = await observer.mutate(undefined).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  )
  return { mutationFn: observedMutationFn, result }
}

describe("成績算出のロックで断られた書き込みの知らせ方", () => {
  it("main がロックで断ったものは、失敗でなくロックの知らせを1つに畳んで出す", async () => {
    const { mutationFn, result } = await runMutation(async () => {
      // preload の invoke が、境界の取り決めの文言で例外へ戻したもの
      throw new Error(GRADE_WRITE_LOCKED_MESSAGE)
    })

    // renderer は止めない（mutationFn は走り、main が断る）
    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(
      GRADE_WRITE_LOCKED_MESSAGE,
      expect.objectContaining({ id: "grade-write-lock" })
    )
  })

  it("ほかの失敗は、これまでどおり失敗トーストを出す", async () => {
    await runMutation(async () => {
      throw new Error("ディスクがいっぱいです")
    })

    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      "配点を保存できませんでした",
      expect.objectContaining({ description: "ディスクがいっぱいです" })
    )
  })

  it("文言を含むだけの失敗は、ロックとして扱わない（完全一致で見分ける）", async () => {
    await runMutation(async () => {
      throw new Error(`${GRADE_WRITE_LOCKED_MESSAGE}（ほかの理由）`)
    })

    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})
