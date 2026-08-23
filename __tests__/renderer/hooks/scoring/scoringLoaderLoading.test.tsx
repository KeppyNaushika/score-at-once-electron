// @vitest-environment jsdom
/**
 * **採点中に設問が増えても、07 が読み込み画面へ戻らないこと。**
 *
 * 採点行を設問ごとのキーへ割った（段階70）ので、設問が1つ増えると**新品のクエリが
 * 1本生える**。「1本でも未取得なら待つ」のままだと、既に他の設問がそろっていても
 * `loading` が true へ戻り、`ScoringMainView` が画面をまるごと
 * `ScoringLoadingState` に差し替える。採点中の選択・フォーカス・スクロールが消える。
 *
 * 起きるのは、別の教員が 02・03 で設問を足し、同期で届いたとき。採点行を採点領域の
 * 木に載せていた頃は、取り直しでも「もうデータはある」扱いだったので起きなかった。
 */

import { QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useScoringDataLoader } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { questionAnswerRegionsQuery } from "@/queries/cropRegion"
import { createAppQueryClient } from "@/queries/queryClient"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const EXAM_ID = "exam-1"

const region = (id: string) => ({ id, examPageId: "page-1", label: id })

/** 境界の返り値。設問だけはテストの途中で差し替える */
let regions: ReturnType<typeof region>[] = []

const electronAPI = {
  getExamWithPages: vi.fn(async () => ({ id: EXAM_ID, examPages: [] })),
  getStudentAnswerImagesByExamId: vi.fn(async () => []),
  getQuestionAnswerRegionsByExamId: vi.fn(async () => regions),
  getQuestionScoresByCropRegionId: vi.fn(async () => []),
}

beforeEach(() => {
  regions = [region("q1"), region("q2")]
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    value: electronAPI,
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
  vi.clearAllMocks()
})

describe("useScoringDataLoader の待ち方", () => {
  it("設問が1つ増えても、待ち画面へ戻らない", async () => {
    const queryClient = createAppQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    /** 各描画の `loading`。1回でも true へ戻れば画面が外れている */
    const seen: boolean[] = []
    const { result } = renderHook(
      () => {
        const loaded = useScoringDataLoader(EXAM_ID)
        seen.push(loaded.loading)
        return loaded
      },
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.cropRegions).toHaveLength(2)

    // ここから先は「もう画面が出ている」状態。1回でも待ちに戻ったら失敗
    seen.length = 0

    // 別の教員が設問を足し、同期で届いて設問一覧を取り直す
    regions = [region("q1"), region("q2"), region("q3")]
    await queryClient.invalidateQueries({
      queryKey: questionAnswerRegionsQuery(EXAM_ID).queryKey,
    })

    await waitFor(() => expect(result.current.cropRegions).toHaveLength(3))
    await waitFor(() =>
      expect(electronAPI.getQuestionScoresByCropRegionId).toHaveBeenCalledWith(
        "q3"
      )
    )

    expect(seen).not.toContain(true)
  })

  it("初回はそろうまで待つ", async () => {
    const queryClient = createAppQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useScoringDataLoader(EXAM_ID), {
      wrapper,
    })

    // 掛け金は「一度そろったら外す」ものであって、「最初から外れている」もの
    // ではない。ここが false から始まると、空の採点画面が一瞬出る
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
