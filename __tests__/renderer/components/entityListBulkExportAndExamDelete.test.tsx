// @vitest-environment jsdom
/**
 * 一覧の「.sao 書き出し（n件）」（#1490）と、試験の一覧の行の「削除」（#1489）。
 *
 * ここで固定すること:
 *
 * - 一括書き出しは4画面とも同じ組み立て（`entityListBulkUnifiedExportAction`）で、
 *   選んだ id をその画面の根の実体として書き出しの入口へ渡す
 * - 試験の行の「削除」は、詳細画面と同じく**試験のオーナーだけ**に出す。
 *   ロールが取れるまでは押せない。押すと確認を開くだけで、消さない
 *
 * window.electronAPI は偽物で、DB には触れない。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { entityListBulkUnifiedExportAction } from "@/components/common/entity-list/entityListToolbarActions"
import { ExamRowMenu } from "@/components/exams/list/ExamRowMenu"
import type { ArchiveRootTable } from "@/electron-src/lib/export/unified-archive/archiveTableRegistry"
import type { ExamSummary } from "@/lib/examStatus"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: "user-1", name: "採点者" }),
}))

afterEach(() => {
  cleanup()
})

describe("entityListBulkUnifiedExportAction", () => {
  const ROOT_TABLES: ArchiveRootTable[] = [
    "Exam",
    "Grade",
    "Coursework",
    "AsbDefinition",
  ]

  it.each(ROOT_TABLES)(
    "%s: 選んだ id を根の実体として書き出しの入口へ渡す",
    (rootTable) => {
      const openUnifiedExport = vi.fn()
      const action = entityListBulkUnifiedExportAction({
        rootTable,
        selectedIds: new Set(["row-a", "row-b"]),
        openUnifiedExport,
      })
      render(<>{action.node}</>)

      fireEvent.click(
        screen.getByRole("button", { name: ".sao 書き出し（2件）" })
      )

      expect(openUnifiedExport).toHaveBeenCalledWith({
        roots: { [rootTable]: ["row-a", "row-b"] },
      })
    }
  )
})

const EXAM: ExamSummary = {
  id: "exam-1",
  examName: "第１回確認テスト",
  referenceDate: null,
  description: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  tags: [],
  examPages: [],
  examStudents: [],
  examSubtotalGroups: [],
}

/** 参加者の取得。呼ばれるたびに、外から決着を付けられる約束を返す */
let resolveMembers: (members: { userId: string; role: string }[]) => void =
  () => {}

beforeEach(() => {
  Object.defineProperty(window, "electronAPI", {
    value: {
      userExam: {
        getMembers: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveMembers = (members) =>
                resolve(
                  members.map((member) => ({
                    ...member,
                    canExportResults: true,
                  }))
                )
            })
        ),
      },
    },
    writable: true,
    configurable: true,
  })
})

/** 行の「…」を開く（Radix はキーボードでも開く） */
function openRowMenu() {
  fireEvent.keyDown(
    screen.getByRole("button", { name: `${EXAM.examName}の操作` }),
    { key: "Enter" }
  )
}

describe("試験の一覧の行の「削除」", () => {
  it("オーナーには出て、押すと確認を開く（ロールが取れるまでは押せない）", async () => {
    const onRequestDelete = vi.fn()
    render(
      <ExamRowMenu
        exam={EXAM}
        onUnifiedExport={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
      { wrapper: createQueryWrapper() }
    )
    openRowMenu()

    const pendingItem = await screen.findByRole("menuitem", { name: "削除" })
    expect(pendingItem).toHaveAttribute("data-disabled")

    resolveMembers([{ userId: "user-1", role: "OWNER" }])
    await vi.waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: "削除" })
      ).not.toHaveAttribute("data-disabled")
    )
    fireEvent.click(screen.getByRole("menuitem", { name: "削除" }))
    expect(onRequestDelete).toHaveBeenCalledTimes(1)
  })

  it.each(["EDITOR", "VIEWER"])("%s には出さない", async (role) => {
    render(
      <ExamRowMenu
        exam={EXAM}
        onUnifiedExport={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
      { wrapper: createQueryWrapper() }
    )
    openRowMenu()
    await screen.findByRole("menuitem", { name: "削除" })

    resolveMembers([{ userId: "user-1", role }])
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "削除" })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("menuitem", { name: ".sao 書き出し" })
    ).toBeInTheDocument()
  })
})
