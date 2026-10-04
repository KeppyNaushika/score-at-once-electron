/**
 * レンダラテスト用セットアップ
 *
 * jsdom環境でReactコンポーネント・フックをテストするための設定
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, configure } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// 各テスト後にReactツリーをクリーンアップ
afterEach(() => {
  cleanup()
})

/**
 * `findBy*` / `waitFor` が待つ上限（Testing Library の既定は 1000ms）。
 *
 * 画面は取得を段で重ねて描く。たとえば評価項目（03）は、資料の詳細が届いてから
 * 項目ごとの点数を取りに行き、両方そろってはじめて「変換表にない評価」が出る。
 * 手元で単独に走らせれば 50ms 前後だが、同じ機械で他の検査や型検査が並走すると
 * 1000ms に届く（CPU を 8 倍に詰めた実測で最大 1040ms）。既定のままだと、
 * 画面は正しいのに待ち時間切れで落ちる。
 *
 * 上限は条件がそろうまでの猶予であって、そろえば即座に先へ進む。表示の誤りは
 * 待っても直らないので、上限を延ばしても見逃しは増えない。テスト1本の上限
 * （`vitest.config.ts` の `testTimeout`）より十分短く保つ
 */
configure({ asyncUtilTimeout: 5000 })

/**
 * Radix UI と `OverflowToolbar` が必要とするグローバルAPI（jsdom は持たない）。
 *
 * **クラスで置く。** 以前は `vi.fn().mockImplementation(() => ({…}))` だったが、
 * アロー関数は `new` で呼べないので、`new ResizeObserver(…)` を書く側から見ると
 * 「コンストラクタではない」と言われて落ちる。Radix は `new` を使わない経路で
 * 触っていたので、これまで表に出ていなかった。
 *
 * 幅の変化は起こさない（何も観測しない）。**幅を伴う検査をしたいテストは、
 * 自前の差し替えを持つこと**（`overflowToolbar.test.tsx` がそうしている）。
 */
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// next/navigation モック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

// sonner (toast) モック
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))
