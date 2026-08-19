// @vitest-environment jsdom
/**
 * 答案画像の削除確認が、**数え終わるまで押させない**ことの検証。
 *
 * このダイアログは「消すと何を巻き添えにするか」を数えて見せる。そこが
 * 「まだ採点データがありません」と出ていれば利用者は安心して押すので、**古い値を
 * 見せたまま押せると、実際には在る採点・確定・手書き注釈がまとめて消える**。
 *
 * 関門が `isPending`（初回だけ）だった頃は、2回目以降に開いたとき古い件数を見せた
 * まま押せた（背景で取り直してはいるが、着地前に押せる）。ここで固定するのは
 * 「取り直している間は押せない」ことと「開くたびに数え直す」こと
 * （docs/branch-review-findings.md #13）。
 */

import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeleteConfirmationModal } from "@/components/exams/06-student-answers/student-answer-table/components/DeleteConfirmationModal"
import { createAppQueryClient } from "@/queries/queryClient"

const getSummary = vi.fn()

beforeEach(() => {
  getSummary.mockReset()
  Object.defineProperty(window, "electronAPI", {
    value: { getStudentAnswerScoreSummary: getSummary },
    writable: true,
    configurable: true,
  })
})

/** 採点データがまったく無い答案の要約 */
const noScores = {
  scoredQuestionCount: 0,
  scoreDecisionCount: 0,
  drawingAnnotationCount: 0,
  scoredCompoundAnswerCount: 0,
  hasScoreData: false,
}

/** 採点済みの答案の要約 */
const scored = {
  scoredQuestionCount: 12,
  scoreDecisionCount: 0,
  drawingAnnotationCount: 5,
  scoredCompoundAnswerCount: 0,
  hasScoreData: true,
}

/**
 * **キャッシュを持ち越す**ラッパー。閉じて開き直しても同じ QueryClient なので、
 * 前に開いたときの答えが手元に残る — そこが再現したい状況そのもの。
 * （共通の `createQueryWrapper` は `gcTime: 0` で毎回捨てるので使えない）
 */
function createSharedWrapper() {
  const queryClient = createAppQueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function renderModal(wrapper: ReturnType<typeof createSharedWrapper>) {
  return render(
    <DeleteConfirmationModal
      isOpen
      onClose={() => {}}
      onConfirm={() => {}}
      fileId="answer-1"
      studentName="田中太郎"
      pageNumber={1}
    />,
    { wrapper }
  )
}

const deleteButton = () =>
  screen.getByRole("button", { name: "削除する" }) as HTMLButtonElement

describe("答案の削除確認は、数え終わるまで押させない", () => {
  it("数えている間は押せず、その旨を出す", async () => {
    let land: (value: typeof noScores) => void = () => {}
    getSummary.mockReturnValue(
      new Promise<typeof noScores>((resolve) => {
        land = resolve
      })
    )

    renderModal(createSharedWrapper())

    await waitFor(() => expect(deleteButton().disabled).toBe(true))
    expect(screen.getByText("採点データを確認しています…")).toBeTruthy()

    land(noScores)
    await waitFor(() => expect(deleteButton().disabled).toBe(false))
    expect(
      screen.getByText("この答案にはまだ採点データがありません")
    ).toBeTruthy()
  })

  it("開き直すと数え直す（前に開いたときの答えを見せたまま押させない）", async () => {
    const wrapper = createSharedWrapper()
    getSummary.mockResolvedValueOnce(noScores)
    const first = renderModal(wrapper)
    await waitFor(() =>
      expect(
        screen.getByText("この答案にはまだ採点データがありません")
      ).toBeTruthy()
    )
    // 閉じる＝Radix が中身をアンマウントする
    first.unmount()

    // この間に 07 で採点された
    let land: (value: typeof scored) => void = () => {}
    getSummary.mockReturnValue(
      new Promise<typeof scored>((resolve) => {
        land = resolve
      })
    )

    renderModal(wrapper)

    // 前の答え（採点データなし）を見せたまま押せてはいけない
    await waitFor(() => expect(deleteButton().disabled).toBe(true))

    land(scored)
    await waitFor(() =>
      expect(
        screen.getByText("この答案の採点データも全て削除されます")
      ).toBeTruthy()
    )
    expect(getSummary).toHaveBeenCalledTimes(2)
  })
})
