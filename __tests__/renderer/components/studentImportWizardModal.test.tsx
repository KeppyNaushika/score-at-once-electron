// @vitest-environment jsdom
/**
 * 生徒（.students）の取り込みウィザードの、実行の段の検証（issue #1514）。
 *
 * window.electronAPI.studentArchive をモックし、本物のウィザード（フック）で確かめる。
 *
 * - 取り込んだ後に「戻る」で確認の段へ戻れない（戻って実行し直すと二重に取り込む）
 * - 取り込めた後のフッターは「閉じる」で、押すと実行の段の「閉じる」と同じく完了を知らせる
 * - 失敗はエラーの帯に出さず、実行の段の表示の1か所だけに出る
 * - 帯の ✕ で消しても、実行の段は「取り込み中...」に戻らない
 * - 前提（読み込んだファイル）が欠けていれば、実行中のまま止まらず失敗として理由を出す
 */

import "../setup"

import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StudentImportWizardModal } from "@/components/student-import/StudentImportWizardModal"
import { createAppQueryClient } from "@/queries/queryClient"
import type {
  StudentArchiveImportResult,
  StudentImportWizardState,
} from "@/types/studentArchive.types"
import { INITIAL_STUDENT_IMPORT_WIZARD_STATE } from "@/types/studentArchive.types"

const studentArchive = {
  selectImportFile: vi.fn(),
  analyzeArchive: vi.fn(),
  preMatch: vi.fn(),
  import: vi.fn(),
}

const emptyCounts = { students: 0, classrooms: 0, memberships: 0 }

const importResult: StudentArchiveImportResult = {
  summary: {
    created: { students: 2, classrooms: 1, memberships: 2 },
    updated: emptyCounts,
    skipped: emptyCounts,
    unchanged: { students: 0, classrooms: 0, memberships: 1 },
  },
  warnings: ["同じ警告", "同じ警告"],
}

/** 確認の段（読み込みと事前照合が済んだ状態）から始める */
const confirmState: StudentImportWizardState = {
  ...INITIAL_STUDENT_IMPORT_WIZARD_STATE,
  currentStep: "final_confirm",
  archivePath: "/tmp/test.students",
  fileOverviewData: {
    student: { byId: [], noMatch: [] },
    classroom: { byId: [], noMatch: [] },
  },
}

beforeEach(() => {
  for (const mockFunction of Object.values(studentArchive)) {
    mockFunction.mockReset()
  }
  studentArchive.import.mockResolvedValue(importResult)
  Object.defineProperty(window, "electronAPI", {
    value: { studentArchive },
    writable: true,
    configurable: true,
  })
})

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createAppQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

function renderWizard({
  startState = confirmState,
  onClose = vi.fn(),
  onComplete = vi.fn(),
}: {
  startState?: StudentImportWizardState
  onClose?: () => void
  onComplete?: () => void
} = {}) {
  render(
    <StudentImportWizardModal
      isOpen
      onClose={onClose}
      onComplete={onComplete}
      startState={startState}
    />,
    { wrapper: Wrapper }
  )
  return { onClose, onComplete }
}

describe("生徒の取り込みウィザード（実行の段）", () => {
  it("取り込んだ後は「戻る」を押せず、もう一度取り込めない", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole("button", { name: "取り込みを実行" }))
    expect(
      await screen.findByText("取り込みが完了しました")
    ).toBeInTheDocument()

    expect(screen.getByRole("button", { name: /戻る/ })).toBeDisabled()
    expect(studentArchive.import).toHaveBeenCalledOnce()
  })

  it("完了の画面に生徒・学級・在籍の内訳を出し、同じ文の警告もすべて出す", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole("button", { name: "取り込みを実行" }))
    await screen.findByText("取り込みが完了しました")

    const membershipRow = screen.getByRole("row", { name: /在籍/ })
    // 新規追加・上書き・変更なし・スキップ
    expect(
      within(membershipRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual(["2", "0", "1", "0"])
    expect(screen.getAllByText("同じ警告")).toHaveLength(2)
  })

  it("取り込めた後のフッターは「閉じる」で、押すと完了を知らせて閉じる", async () => {
    const user = userEvent.setup()
    const { onClose, onComplete } = renderWizard()

    await user.click(screen.getByRole("button", { name: "取り込みを実行" }))
    await screen.findByText("取り込みが完了しました")

    expect(
      screen.queryByRole("button", { name: "キャンセル" })
    ).not.toBeInTheDocument()
    // 実行の段とフッターの2つの「閉じる」。フッター（後ろ）を押す
    const closeButtons = screen.getAllByRole("button", { name: "閉じる" })
    expect(closeButtons).toHaveLength(2)
    await user.click(closeButtons[closeButtons.length - 1])

    expect(onComplete).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("失敗はエラーの帯に出さず、実行の段の1か所だけに出す", async () => {
    const user = userEvent.setup()
    studentArchive.import.mockRejectedValue(new Error("DBが壊れています"))
    const { onComplete } = renderWizard()

    await user.click(screen.getByRole("button", { name: "取り込みを実行" }))

    expect(
      await screen.findByText("取り込みに失敗しました")
    ).toBeInTheDocument()
    expect(screen.getAllByText("DBが壊れています")).toHaveLength(1)
    expect(screen.queryByText("エラー")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /戻る/ })).toBeDisabled()

    // 失敗の「閉じる」では完了を知らせない
    await user.click(screen.getAllByRole("button", { name: "閉じる" })[0])
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("前提が欠けていれば実行中のまま止まらず、失敗として理由を出す", async () => {
    renderWizard({
      startState: {
        ...INITIAL_STUDENT_IMPORT_WIZARD_STATE,
        currentStep: "execute",
      },
    })

    expect(
      await screen.findByText("取り込みに失敗しました")
    ).toBeInTheDocument()
    expect(screen.getByText(/読み込まれていません/)).toBeInTheDocument()
    expect(screen.queryByText("取り込み中...")).not.toBeInTheDocument()
    expect(studentArchive.import).not.toHaveBeenCalled()
  })

  it("エラーの帯の ✕ で消しても、実行の段は「取り込み中...」に戻らない", async () => {
    const user = userEvent.setup()
    // 前の段から持ち越したエラーが帯に出ている状態で、実行の段が失敗する
    renderWizard({
      startState: {
        ...INITIAL_STUDENT_IMPORT_WIZARD_STATE,
        currentStep: "execute",
        error: "前の段のエラー",
      },
    })

    await screen.findByText("取り込みに失敗しました")
    expect(screen.getByText("前の段のエラー")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "エラーを閉じる" }))

    expect(screen.queryByText("前の段のエラー")).not.toBeInTheDocument()
    expect(screen.getByText("取り込みに失敗しました")).toBeInTheDocument()
    expect(screen.queryByText("取り込み中...")).not.toBeInTheDocument()
  })
})
