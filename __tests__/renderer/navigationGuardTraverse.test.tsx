// @vitest-environment jsdom
/**
 * 戻る・進む（マウスの第4/第5ボタン）が未保存のガードを通ることの検査。
 *
 * ガードが見ていたのは `GuardedLink` のクリックと `beforeunload` だけで、
 * **履歴の行き来は素通りだった**。ヘッダーの戻る/進むと履歴一覧は `guardedTraverse`
 * で塞いであるが、マウスの戻るはそこを通らない（content 層が mouseup で `GoBack()`
 * を呼ぶので、キー入力を潰す形でも止められない）。
 *
 * **`popstate` では守れない。** あれは遷移が起きた**後**に飛ぶので、そこで出す確認は
 * 「もう消えたデータ」についての確認になる。一度は Next より先に購読して握り潰し、
 * 履歴を引き戻す形にしたが、引き戻しがあるせいで穴が2つできた（引き戻し中の印が
 * 残ると次の戻るを食う／履歴位置の写しがずれると1つ手前へ飛ばす）。
 *
 * Navigation API の `navigate` は遷移の**前**に飛び、`preventDefault()` で取り消せる。
 * 取り消せば何も動かないので、引き戻すものが無い。この検査が固定するのは、
 * **動かさずに止めていること**である。
 *
 * 実機（Electron 43＝Chrome 150）で確かめた前提は `NavigationGuardContext` の
 * 註釈にある。ここは jsdom なので `window.navigation` は自前で置く。
 */

import "./setup"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DirtyDetail } from "@/contexts/NavigationGuardContext"
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext"
import { useNavigationGuard } from "@/hooks/useNavigationGuard"

/** `traverseTo` の決着。テストから解決／拒否させる */
let committed: {
  promise: Promise<unknown>
  resolve: () => void
  reject: () => void
}

const traverseTo = vi.fn(() => ({ committed: committed.promise }))

/** jsdom は Navigation API を持たないので、要る所だけを置く */
class FakeNavigation extends EventTarget {
  traverseTo = traverseTo
}

let navigation: FakeNavigation

/** 実機の `navigate` のうち、ガードが見るところだけを持つ */
function dispatchNavigate({
  navigationType = "traverse",
  cancelable = true,
  destinationKey = "entry-1",
}: {
  navigationType?: string
  cancelable?: boolean
  destinationKey?: string
} = {}) {
  const event = Object.assign(new Event("navigate", { cancelable }), {
    navigationType,
    destination: { key: destinationKey },
  })
  act(() => {
    navigation.dispatchEvent(event)
  })
  return event
}

/** 書きかけを抱えた画面の代役。毎レンダー作り直さないよう定数で持つ */
const dirtyDetails: DirtyDetail[] = [{ label: "未保存の採点", count: 3 }]

function GuardedPage({
  isDirty,
  details = dirtyDetails,
}: {
  isDirty: boolean
  details?: DirtyDetail[]
}) {
  useNavigationGuard(isDirty, details)
  return null
}

function renderGuard(isDirty: boolean) {
  render(
    <NavigationGuardProvider>
      <GuardedPage isDirty={isDirty} />
    </NavigationGuardProvider>
  )
}

const isDialogOpen = () =>
  screen.queryByText("未保存のデータがあります") !== null

beforeEach(() => {
  let resolve = () => {}
  let reject = () => {}
  const promise = new Promise<unknown>((onResolve, onReject) => {
    resolve = () => onResolve(undefined)
    reject = () => onReject(new Error("InvalidStateError"))
  })
  // 拾い手が付くまでの未処理拒否を出さない
  promise.catch(() => undefined)
  committed = { promise, resolve, reject }

  navigation = new FakeNavigation()
  Object.defineProperty(window, "navigation", {
    configurable: true,
    writable: true,
    value: navigation,
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, "navigation")
  vi.clearAllMocks()
})

describe("書きかけを抱えた画面での戻る", () => {
  it("遷移が起きる前に止め、確認を出す", async () => {
    renderGuard(true)

    const event = dispatchNavigate()

    // 本体。`popstate` を握り潰す形では、ここに来た時点で既に画面が
    // 差し替わっている（守るものが無い）
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(isDialogOpen()).toBe(true))
  })

  it("「戻る」を選んでも、履歴を動かさない（動いていないので戻すものが無い）", async () => {
    renderGuard(true)
    dispatchNavigate()
    await waitFor(() => expect(isDialogOpen()).toBe(true))

    await userEvent.click(screen.getByRole("button", { name: "戻る" }))

    await waitFor(() => expect(isDialogOpen()).toBe(false))
    expect(traverseTo).not.toHaveBeenCalled()
  })

  it("Escape で閉じても、履歴を動かさない", async () => {
    renderGuard(true)
    dispatchNavigate()
    await waitFor(() => expect(isDialogOpen()).toBe(true))

    await userEvent.keyboard("{Escape}")

    await waitFor(() => expect(isDialogOpen()).toBe(false))
    expect(traverseTo).not.toHaveBeenCalled()
  })

  it("「離れる」を選ぶと、取り消した行き先へ改めて行く", async () => {
    renderGuard(true)
    dispatchNavigate({ destinationKey: "entry-7" })
    await waitFor(() => expect(isDialogOpen()).toBe(true))

    await userEvent.click(screen.getByRole("button", { name: "離れる" }))

    // 行き先は `destination.key` で覚える。1歩とは限らない
    //（履歴一覧から数歩戻る操作もこの経路に来る）
    await waitFor(() => expect(traverseTo).toHaveBeenCalledWith("entry-7"))
  })

  it("再実行はもう一度止めない", async () => {
    renderGuard(true)
    dispatchNavigate({ destinationKey: "entry-7" })
    await waitFor(() => expect(isDialogOpen()).toBe(true))
    await userEvent.click(screen.getByRole("button", { name: "離れる" }))
    await waitFor(() => expect(traverseTo).toHaveBeenCalled())

    // 再実行が起こす `navigate`。ここで止めると同じ確認が無限に出る
    const replayed = dispatchNavigate({ destinationKey: "entry-7" })

    expect(replayed.defaultPrevented).toBe(false)
    expect(isDialogOpen()).toBe(false)
  })

  it("再実行の途中で書きかけが立て直されても、通す", async () => {
    // 実測: `traverseTo` の `navigate` は同期でもマイクロタスクでもなく
    // マクロタスクの後に飛ぶ。その隙に画面側が `setNavigationGuard(true)` を
    // 打ち直すことがあり、「ガードを外したから素通りする」には頼れない
    const { rerender } = render(
      <NavigationGuardProvider>
        <GuardedPage isDirty={true} />
      </NavigationGuardProvider>
    )
    dispatchNavigate({ destinationKey: "entry-7" })
    await waitFor(() => expect(isDialogOpen()).toBe(true))
    await userEvent.click(screen.getByRole("button", { name: "離れる" }))
    await waitFor(() => expect(traverseTo).toHaveBeenCalled())

    // 画面側が書きかけを打ち直す（別の内訳で effect を走らせる）
    rerender(
      <NavigationGuardProvider>
        <GuardedPage
          isDirty={true}
          details={[{ label: "別の書きかけ", count: 1 }]}
        />
      </NavigationGuardProvider>
    )

    const replayed = dispatchNavigate({ destinationKey: "entry-7" })

    expect(replayed.defaultPrevented).toBe(false)
    expect(isDialogOpen()).toBe(false)
  })

  it("行き先へ行けなかったら黙らない", async () => {
    renderGuard(true)
    dispatchNavigate({ destinationKey: "entry-7" })
    await waitFor(() => expect(isDialogOpen()).toBe(true))
    await userEvent.click(screen.getByRole("button", { name: "離れる" }))
    await waitFor(() => expect(traverseTo).toHaveBeenCalled())

    // `traverseTo` は例外を投げず、`committed` が拒否されるだけ。拾わないと
    // 「押したのに何も起きない画面」になる
    committed.reject()

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "前の画面へ戻れませんでした"
      )
    )
  })

  it("着いたら、通す印を残さない", async () => {
    const { rerender } = render(
      <NavigationGuardProvider>
        <GuardedPage isDirty={true} />
      </NavigationGuardProvider>
    )
    dispatchNavigate({ destinationKey: "entry-7" })
    await waitFor(() => expect(isDialogOpen()).toBe(true))
    await userEvent.click(screen.getByRole("button", { name: "離れる" }))
    committed.resolve()
    await act(async () => {
      await committed.promise
    })

    // 画面側が書きかけを持ち直したあと、同じ行き先へもう一度行こうとしたら、
    // 今度は確認が出る（印が残っていれば素通りしてしまう）
    rerender(
      <NavigationGuardProvider>
        <GuardedPage
          isDirty={true}
          details={[{ label: "別の書きかけ", count: 1 }]}
        />
      </NavigationGuardProvider>
    )
    const again = dispatchNavigate({ destinationKey: "entry-7" })

    expect(again.defaultPrevented).toBe(true)
  })
})

describe("止めないもの", () => {
  it("書きかけが無ければ素通し", () => {
    renderGuard(false)

    const event = dispatchNavigate()

    expect(event.defaultPrevented).toBe(false)
    expect(isDialogOpen()).toBe(false)
  })

  it("行き来でない遷移は見ない（Next が行き来のあとに打つ replace を捕まえない）", () => {
    renderGuard(true)

    const pushed = dispatchNavigate({ navigationType: "push" })
    const replaced = dispatchNavigate({ navigationType: "replace" })

    expect(pushed.defaultPrevented).toBe(false)
    expect(replaced.defaultPrevented).toBe(false)
    expect(isDialogOpen()).toBe(false)
  })

  it("取り消せない行き来では preventDefault を呼ばない", () => {
    renderGuard(true)

    // 別の文書への行き来（履歴の先頭より手前）。`preventDefault()` は例外も
    // 投げず、黙って遷移する。呼ぶ前に `cancelable` を見て諦めるしかない
    const event = dispatchNavigate({ cancelable: false })

    expect(event.defaultPrevented).toBe(false)
    expect(isDialogOpen()).toBe(false)
  })
})
