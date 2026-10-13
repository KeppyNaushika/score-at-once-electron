// @vitest-environment jsdom
/**
 * データ読み込みのページ。データ書き出しと対になり、ファイルを1つ選ぶと拡張子で取り込み画面へ
 * 振り分ける（中身は一覧の「取り込み」と同じ `useArchiveImportLauncher`）。
 *
 * - 「ファイルを選んで読み込む」でファイルを選ばせる
 * - ファイルを開いている間は押せない
 * - 読み込めるファイルの種類を出す（web 版では統合アーカイブだけ）
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import DataImportPage from "@/app/(app)/data-import/page"

const { launcher, webRuntime } = vi.hoisted(() => ({
  launcher: {
    start: vi.fn(),
    isOpening: false,
    opened: null,
    close: vi.fn(),
  },
  webRuntime: { value: false },
}))

vi.mock("@/components/archive-import/hooks/useArchiveImportLauncher", () => ({
  useArchiveImportLauncher: () => launcher,
}))

vi.mock("@/components/archive-import/ArchiveImportScreens", () => ({
  ArchiveImportScreens: () => null,
}))

vi.mock("@/hooks/useIsWebRuntime", () => ({
  useIsWebRuntime: () => webRuntime.value,
}))

vi.mock("@/components/layout/PageHeader", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

describe("データ読み込みのページ", () => {
  afterEach(() => {
    cleanup()
    launcher.start.mockReset()
    launcher.isOpening = false
    webRuntime.value = false
  })

  it("「ファイルを選んで読み込む」で、ファイルを選ばせる", () => {
    render(<DataImportPage />)

    expect(
      screen.getByRole("heading", { name: "データ読み込み" })
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "ファイルを選んで読み込む" })
    )
    expect(launcher.start).toHaveBeenCalledTimes(1)
  })

  it("ファイルを開いている間は押せない", () => {
    launcher.isOpening = true
    render(<DataImportPage />)

    expect(screen.getByRole("button", { name: /開いています/ })).toBeDisabled()
  })

  it("デスクトップ版では旧形式と他のアプリのファイルも読み込めると出す", () => {
    render(<DataImportPage />)

    for (const extension of [
      ".sao",
      ".score",
      ".students",
      ".coursework",
      ".grade",
      ".asb",
      ".hsz・.dat",
    ]) {
      expect(screen.getByText(extension)).toBeInTheDocument()
    }
  })

  it("web 版では統合アーカイブだけを出す", () => {
    webRuntime.value = true
    render(<DataImportPage />)

    expect(screen.getByText(".sao")).toBeInTheDocument()
    expect(screen.queryByText(".score")).not.toBeInTheDocument()
    expect(
      screen.getByText(/デスクトップ版で取り込んでから/)
    ).toBeInTheDocument()
  })
})
