/**
 * レンダラテスト用セットアップ
 *
 * jsdom環境でReactコンポーネント・フックをテストするための設定
 */

import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// 各テスト後にReactツリーをクリーンアップ
afterEach(() => {
  cleanup()
})

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
