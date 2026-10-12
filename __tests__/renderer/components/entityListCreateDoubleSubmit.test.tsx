// @vitest-environment jsdom
/**
 * 一覧4画面の「新規作成」の連打（#1483）。
 *
 * 押すたびに新しい id で既定値の1件を作るので、書き込み中に押し直せると同じ既定値の
 * 行が増える。ここで固定すること:
 *
 * - 2回続けて押しても、作成は1回しか呼ばれない（`isPending` が画面に届く前の
 *   2回目の押下も止める）
 * - 作成中はヘッダーの「新規作成」も、空のときの「最初の〜を作成」も押せない
 * - 作成が済めば、作った1件の概要（解答用紙は作成ページ）へ進む
 * - 失敗したら、また押せる
 *
 * window.electronAPI は偽物で、DB には触れない。
 *
 * ## 共通のレンダラ用セットアップを読み込んでいない理由
 *
 * `entityListPage.test.tsx` と同じ。あちらの `next/navigation` モックは
 * `useRouter()` のたびに新しい `vi.fn()` を返すので、どこへ飛んだかを確かめられない。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CreateDefinitionButton } from "@/components/answer-sheet-builder/components/list/CreateDefinitionButton"
import { useCreateDefinition } from "@/components/answer-sheet-builder/hooks/useCreateDefinition"
import { entityListCreateAction } from "@/components/common/entity-list/entityListToolbarActions"
import { CourseworkListContainer } from "@/components/coursework/list/CourseworkListContainer"
import ExamList from "@/components/exams/list/ExamList"
import { GradeListContainer } from "@/components/grades/list/GradeListContainer"

import { createQueryWrapper } from "../../helpers/queryWrapper"

/** hoist される `vi.mock` の中から参照するので、こちらも hoist して作る */
const { pushSpy } = vi.hoisted(() => ({ pushSpy: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

/** ヘッダー左の戻る／進むは Navigation API が要るので差し替える（見たいのは右の操作） */
vi.mock("@/components/layout/HistoryNavButtons", () => ({
  HistoryNavButtons: () => <div data-testid="history-nav-buttons" />,
}))

vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: "user-1", name: "採点者" }),
}))

/** 外から解決・失敗させられる約束（作成中の状態を保つのに使う） */
function createDeferred<TResult>() {
  let resolvePromise: (result: TResult) => void = () => {}
  let rejectPromise: (error: Error) => void = () => {}
  const promise = new Promise<TResult>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

/** 作成の口。呼ばれるたびに、外から決着を付けられる約束を返す */
let pendingCreations: ReturnType<typeof createDeferred<{ id: string }>>[] = []
const createSpy = vi.fn(() => {
  const creation = createDeferred<{ id: string }>()
  pendingCreations.push(creation)
  return creation.promise
})

/**
 * 一覧の高さの実測が使う（jsdom は持たない）。共通セットアップと同じく何も観測しない。
 * 幅の変化も起きないので、ヘッダーの操作は畳まれずにそのまま並ぶ
 */
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  pushSpy.mockReset()
  createSpy.mockClear()
  pendingCreations = []
  Object.defineProperty(window, "electronAPI", {
    value: {
      fetchExamsSummary: vi.fn(async () => []),
      createExam: createSpy,
      grade: { getAll: vi.fn(async () => []), create: createSpy },
      coursework: { getAll: vi.fn(async () => []), create: createSpy },
      tagGetAll: vi.fn(async () => []),
      answerSheetBuilder: { replaceDefinition: createSpy },
    },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
})

describe("entityListCreateAction", () => {
  it("disabled を渡すと押せないボタンになる", () => {
    const onClick = vi.fn()
    const action = entityListCreateAction({
      label: "新規作成",
      onClick,
      disabled: true,
    })
    render(<>{action.node}</>)
    const button = screen.getByRole("button", { name: "新規作成" })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

const LIST_SCREENS = [
  {
    screenName: "試験",
    renderList: () => <ExamList />,
    createLabel: "新規作成",
    emptyLabel: "最初の試験を作成",
    hrefPrefix: "/exams/",
  },
  {
    screenName: "成績算出",
    renderList: () => <GradeListContainer />,
    createLabel: "新規作成",
    emptyLabel: "最初の成績算出を作成",
    hrefPrefix: "/grades/",
  },
  {
    screenName: "試験外成績資料",
    renderList: () => <CourseworkListContainer />,
    createLabel: "新規作成",
    emptyLabel: "最初の資料を作成",
    hrefPrefix: "/coursework/",
  },
] as const

describe.each(LIST_SCREENS)(
  "$screenName の一覧",
  ({ renderList, createLabel, emptyLabel, hrefPrefix }) => {
    it("連打しても作成は1回で、作成中はどちらの作成ボタンも押せない", async () => {
      render(renderList(), { wrapper: createQueryWrapper() })
      const emptyButton = await screen.findByRole("button", {
        name: emptyLabel,
      })
      const createButton = screen.getByRole("button", { name: createLabel })

      // 同じ描画のまま2回押す（isPending が届く前）
      fireEvent.click(createButton)
      fireEvent.click(createButton)
      fireEvent.click(emptyButton)
      // 作成の口は mutation の中で非同期に呼ばれるので、着くのを待ってから数える
      await vi.waitFor(() => expect(createSpy).toHaveBeenCalled())
      expect(createSpy).toHaveBeenCalledTimes(1)

      expect(
        await screen.findByRole("button", { name: createLabel })
      ).toBeDisabled()
      expect(screen.getByRole("button", { name: emptyLabel })).toBeDisabled()

      pendingCreations[0].resolve({ id: "created" })
      await vi.waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1))
      expect(pushSpy.mock.calls[0][0]).toMatch(hrefPrefix)
      expect(createSpy).toHaveBeenCalledTimes(1)
    })

    it("失敗したら、また押せる", async () => {
      render(renderList(), { wrapper: createQueryWrapper() })
      await screen.findByRole("button", { name: emptyLabel })
      fireEvent.click(screen.getByRole("button", { name: createLabel }))
      expect(
        await screen.findByRole("button", { name: createLabel })
      ).toBeDisabled()

      pendingCreations[0].reject(new Error("書き込めない"))
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: createLabel })
        ).not.toBeDisabled()
      )
      fireEvent.click(screen.getByRole("button", { name: createLabel }))
      await vi.waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2))
      expect(pushSpy).not.toHaveBeenCalled()
    })
  }
)

/**
 * 解答用紙の一覧と同じく、ヘッダーと空のときの作成ボタンが同時に出ている形。
 * 作成中の判定は `useCreateDefinition` 1つで持ち、両方のボタンへ渡す
 */
function DefinitionCreateButtons() {
  const { createAndOpen, isCreating } = useCreateDefinition("user-1")
  return (
    <>
      <CreateDefinitionButton
        onCreate={() => void createAndOpen()}
        isCreating={isCreating}
      >
        新規作成
      </CreateDefinitionButton>
      <CreateDefinitionButton
        onCreate={() => void createAndOpen()}
        isCreating={isCreating}
      >
        最初の解答用紙を作成
      </CreateDefinitionButton>
    </>
  )
}

describe("解答用紙の作成ボタン", () => {
  it("既定値の読み込み中から作成が済むまで、どちらのボタンを連打しても作成は1回", async () => {
    render(<DefinitionCreateButtons />, { wrapper: createQueryWrapper() })
    const headerButton = screen.getByRole("button", { name: "新規作成" })
    const emptyStateButton = screen.getByRole("button", {
      name: "最初の解答用紙を作成",
    })

    // 1回目は既定値の動的 import を待っている間。そこへ両方のボタンを押す
    fireEvent.click(headerButton)
    fireEvent.click(headerButton)
    fireEvent.click(emptyStateButton)
    expect(headerButton).toBeDisabled()
    expect(emptyStateButton).toBeDisabled()

    await vi.waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    fireEvent.click(emptyStateButton)
    expect(emptyStateButton).toBeDisabled()

    pendingCreations[0].resolve({ id: "created" })
    await vi.waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1))
    expect(pushSpy.mock.calls[0][0]).toMatch("/answer-sheet-builder/")
    expect(createSpy).toHaveBeenCalledTimes(1)
  })

  it("失敗したら、また押せる", async () => {
    render(<DefinitionCreateButtons />, { wrapper: createQueryWrapper() })
    const button = screen.getByRole("button", { name: "新規作成" })
    fireEvent.click(button)
    await vi.waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))

    pendingCreations[0].reject(new Error("書き込めない"))
    await vi.waitFor(() => expect(button).not.toBeDisabled())
    fireEvent.click(button)
    await vi.waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2))
    expect(pushSpy).not.toHaveBeenCalled()
  })
})
