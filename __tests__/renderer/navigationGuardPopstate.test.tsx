// @vitest-environment jsdom
/**
 * 戻る・進む（Alt+← ・マウスの第4/第5ボタン）が未保存のガードを通ることの検査。
 *
 * ガードが見ていたのは `GuardedLink` のクリックと `beforeunload` だけで、
 * **`popstate` は素通りだった**。ヘッダーの戻る/進むと履歴一覧は `guardedTraverse`
 * で塞いであるが、キーとマウスの戻るはそこを通らない。
 *
 * `popstate` は**遷移が起きた後**に飛ぶので、Next のルータへ届いてしまうと画面が
 * 差し替わり、書きかけを抱えたコンポーネントが外れる ── そのあとで確認を出しても
 * 守るものはもう無い。したがってこの検査の本体は「確認が出ること」ではなく
 * **Next の購読より先に止まっていること**である（ここでは Next の代役を、
 * プロバイダより後に購読を始めた listener として置く）。
 *
 * 固定するのは4点。
 *
 * 1. 書きかけがあるとき、`popstate` は Next へ届かず確認が出る
 * 2. 「戻る」を選ぶと元の履歴位置へ引き戻し、その移動も Next へ渡さない
 * 3. 「離れる」を選ぶと預かった `popstate` を流し直す（履歴は動かさない）
 * 4. 書きかけが無いときは何もしない（素通し・履歴を往復させない）
 */

import "./setup"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DirtyDetail } from "@/contexts/NavigationGuardContext"
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext"
import { useNavigationGuard } from "@/hooks/useNavigationGuard"

import { createQueryWrapper } from "../helpers/queryWrapper"

const getNavigationState = vi.fn()
const goToHistoryIndex = vi.fn()

/** Next の `AppRouter` が持つ popstate 購読の代役（プロバイダより後に並ぶ） */
const nextRouterPopState = vi.fn()

/** 書きかけを抱えた画面の代役。毎レンダー作り直さないよう定数で持つ */
const dirtyDetails: DirtyDetail[] = [{ label: "未保存の採点", count: 3 }]

function GuardedPage({ isDirty }: { isDirty: boolean }) {
  useNavigationGuard(isDirty, dirtyDetails)
  return null
}

/** 履歴の 2 番目（添字1）に居る状態で描く */
async function renderGuard(isDirty: boolean) {
  const QueryWrapper = createQueryWrapper()
  render(
    <QueryWrapper>
      <NavigationGuardProvider>
        <GuardedPage isDirty={isDirty} />
      </NavigationGuardProvider>
    </QueryWrapper>
  )

  // プロバイダが履歴の位置を掴むまで待つ（掴めていないと横取りしない）
  await waitFor(() => expect(getNavigationState).toHaveBeenCalled())
  await act(async () => {})

  // Next の購読はプロバイダより後（`AppRouter` の effect は子より後に流れる）
  window.addEventListener("popstate", nextRouterPopState)
}

/** ブラウザが履歴を動かした後に飛ばしてくる popstate */
function browserPopState() {
  act(() => {
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: { __NA: true } })
    )
  })
}

beforeEach(() => {
  getNavigationState.mockReset()
  goToHistoryIndex.mockReset()
  nextRouterPopState.mockReset()
  getNavigationState.mockResolvedValue({
    canGoBack: true,
    canGoForward: false,
    activeIndex: 1,
    entries: [],
  })
  goToHistoryIndex.mockResolvedValue(undefined)
  Object.defineProperty(window, "electronAPI", {
    value: {
      navigation: { getState: getNavigationState, goToIndex: goToHistoryIndex },
    },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  window.removeEventListener("popstate", nextRouterPopState)
})

describe("戻る・進むが未保存のガードを通ること", () => {
  it("書きかけがあるとき、popstate は Next へ届かず確認が出る", async () => {
    await renderGuard(true)

    browserPopState()

    expect(screen.getByText("未保存のデータがあります")).toBeInTheDocument()
    // ここが本体。届いていたら画面は既に差し替わっていて、確認しても手遅れ
    expect(nextRouterPopState).not.toHaveBeenCalled()
  })

  it("断ると元の履歴位置へ引き戻し、その移動も Next へ渡さない", async () => {
    await renderGuard(true)
    browserPopState()

    await userEvent.click(screen.getByRole("button", { name: "戻る" }))

    // ブラウザだけが行き先へ動いているので、居た位置（添字1）へ戻す
    await waitFor(() => expect(goToHistoryIndex).toHaveBeenCalledWith(1))

    // 引き戻しで飛ぶ popstate は自分で起こしたもの。Next は行き先を知らない
    browserPopState()
    expect(nextRouterPopState).not.toHaveBeenCalled()
  })

  it("Escape で閉じたときも引き戻す", async () => {
    await renderGuard(true)
    browserPopState()

    await userEvent.keyboard("{Escape}")

    await waitFor(() => expect(goToHistoryIndex).toHaveBeenCalledWith(1))
  })

  it("離れると、預かった popstate を流し直す（履歴は動かさない）", async () => {
    await renderGuard(true)
    browserPopState()

    await userEvent.click(screen.getByRole("button", { name: "離れる" }))

    // 履歴は既に行き先に居るので動かさない。Next へ知らせるだけ
    expect(goToHistoryIndex).not.toHaveBeenCalled()
    await waitFor(() => expect(nextRouterPopState).toHaveBeenCalledTimes(1))
    const [replayed] = nextRouterPopState.mock.calls[0]
    expect(replayed.state).toEqual({ __NA: true })
  })

  it("書きかけが無いときは何もしない", async () => {
    await renderGuard(false)

    browserPopState()

    expect(
      screen.queryByText("未保存のデータがあります")
    ).not.toBeInTheDocument()
    expect(nextRouterPopState).toHaveBeenCalledTimes(1)
    // 毎回履歴を往復させない
    expect(goToHistoryIndex).not.toHaveBeenCalled()
  })
})
