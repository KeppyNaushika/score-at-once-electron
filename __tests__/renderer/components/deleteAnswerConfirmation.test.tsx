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
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeleteConfirmationModal } from "@/components/exams/06-student-answers/student-answer-table/components/DeleteConfirmationModal"
import { createAppQueryClient } from "@/queries/queryClient"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

const getDeletionCounts = vi.fn()

beforeEach(() => {
  getDeletionCounts.mockReset()
  Object.defineProperty(window, "electronAPI", {
    value: { getStudentAnswerDeletionCounts: getDeletionCounts },
    writable: true,
    configurable: true,
  })
})

/** 採点データがまったく無い答案（0件の項目は返さないので空配列） */
const noScores: ConfirmedDeletionCount[] = []

/** 採点済みの答案 */
const scored: ConfirmedDeletionCount[] = [
  { countedName: "採点済みの設問", shownCount: 12 },
  { countedName: "答案への書き込み", shownCount: 5 },
]

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

function renderModal(
  wrapper: ReturnType<typeof createSharedWrapper>,
  handlers: {
    onClose?: () => void
    onConfirm?: (confirmedCounts: ConfirmedDeletionCount[]) => Promise<void>
  } = {}
) {
  return render(
    <DeleteConfirmationModal
      isOpen
      onClose={handlers.onClose ?? (() => {})}
      onConfirm={handlers.onConfirm ?? (async () => {})}
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
    getDeletionCounts.mockReturnValue(
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
    getDeletionCounts.mockResolvedValueOnce(noScores)
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
    getDeletionCounts.mockReturnValue(
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
    expect(getDeletionCounts).toHaveBeenCalledTimes(2)
  })

  it("中止されたら閉じずに、文言を出して数え直した件数を見せる", async () => {
    const user = userEvent.setup()
    const wrapper = createSharedWrapper()
    const onClose = vi.fn()
    // 利用者は「採点データなし」を見た。押した時点で main が数え直して中止する
    getDeletionCounts.mockResolvedValueOnce(noScores)
    const refusal =
      "確認したあとに他の教員が書き足したため、削除を中止しました（採点済みの設問 0件 → 12件）。もう一度確認してください。"
    const onConfirm = vi.fn().mockRejectedValue(new Error(refusal))
    // 数え直しでは、増えたぶんが見える
    getDeletionCounts.mockResolvedValueOnce(scored)

    renderModal(wrapper, { onClose, onConfirm })

    await waitFor(() =>
      expect(
        screen.getByText("この答案にはまだ採点データがありません")
      ).toBeTruthy()
    )
    await user.click(deleteButton())

    // 中止の文言が出る
    expect(await screen.findByText(refusal)).toBeTruthy()
    // ダイアログは閉じない（閉じると数え直した件数を見せられない）
    expect(onClose).not.toHaveBeenCalled()
    // 数え直した結果が出ている
    await waitFor(() =>
      expect(
        screen.getByText("この答案の採点データも全て削除されます")
      ).toBeTruthy()
    )
    expect(screen.getByText("採点済みの設問: 12件")).toBeTruthy()
    expect(getDeletionCounts).toHaveBeenCalledTimes(2)
  })
})
