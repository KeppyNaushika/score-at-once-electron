// @vitest-environment jsdom
/**
 * 監査ログ一覧（独立ページ `/audit-logs` の中身）の検査。
 *
 * 固定するのは3組。
 *
 * 1. **切るのは main。** 画面は1ページ分しか要求せず（`limit` / `offset` 付き）、
 *    受け取った行だけを描く。保持365日ぶんの行を renderer へ運んでから切る形に
 *    戻ると、`limit` の無い要求として現れる
 * 2. **ページ送り。** ページ番号を押すと `offset` が動き、そのページの行に入れ替わる
 * 3. **絞り込みは先頭のページから。** 3ページ目のまま条件を変えると、一致が
 *    1ページ分しかないときに空の画面へ着地する
 */

import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuditLogList } from "@/app/(app)/audit-logs/components/AuditLogList"
import type {
  AuditLogEntry,
  AuditLogQueryOptions,
} from "@/electron-src/lib/prisma/auditQuery"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const TOTAL_ROWS = 120
const DEFAULT_PAGE_SIZE = 50

const buildEntry = (rowNumber: number): AuditLogEntry => ({
  id: `audit-${rowNumber}`,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
  occurrences: 1,
  action: "exam.create",
  category: "exam",
  verb: "create",
  userId: null,
  actorName: "採点 太郎",
  actorUsername: "taro",
  entityType: "Exam",
  entityId: `exam-${rowNumber}`,
  scopeId: `exam-${rowNumber}`,
  scopeLabel: null,
  summary: `テスト操作 ${rowNumber}`,
  metadata: null,
})

const allEntries = Array.from({ length: TOTAL_ROWS }, (_, i) =>
  buildEntry(i + 1)
)

const getLogs = vi.fn(async (options: AuditLogQueryOptions = {}) => {
  const matched = options.search
    ? allEntries.filter((entry) => entry.summary.includes(options.search ?? ""))
    : allEntries
  const limit = options.limit ?? matched.length
  const offset = options.offset ?? 0
  return {
    entries: matched.slice(offset, offset + limit),
    total: matched.length,
    limit,
    offset,
  }
})

beforeEach(() => {
  getLogs.mockClear()
  Object.defineProperty(window, "electronAPI", {
    value: {
      audit: { getLogs },
      fetchUsers: vi.fn().mockResolvedValue([]),
    },
    writable: true,
    configurable: true,
  })
})

/** 一覧を描いて最初のページが出るまで待つ */
async function renderList() {
  render(<AuditLogList />, { wrapper: createQueryWrapper() })
  await screen.findByText("が テスト操作 1")
}

describe("監査ログ一覧", () => {
  it("1ページ分だけを要求し、受け取った行だけを描く", async () => {
    await renderList()

    // 要求は必ず切られている（全件を運んでから画面で切らない）
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: DEFAULT_PAGE_SIZE, offset: 0 })
    )
    for (const call of getLogs.mock.calls) {
      expect(call[0]?.limit).toBe(DEFAULT_PAGE_SIZE)
    }

    expect(screen.getByText("が テスト操作 50")).toBeInTheDocument()
    expect(screen.queryByText("が テスト操作 51")).not.toBeInTheDocument()
    expect(
      screen.getByText(`${TOTAL_ROWS} 件中 1〜${DEFAULT_PAGE_SIZE} 件`)
    ).toBeInTheDocument()
  })

  it("ページ番号を押すとそのページを取り直して入れ替わる", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(screen.getByRole("link", { name: "2ページ目" }))

    await waitFor(() => {
      expect(screen.getByText("が テスト操作 51")).toBeInTheDocument()
    })
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: DEFAULT_PAGE_SIZE, offset: 50 })
    )
    expect(screen.queryByText("が テスト操作 1")).not.toBeInTheDocument()
    expect(
      screen.getByText(`${TOTAL_ROWS} 件中 51〜100 件`)
    ).toBeInTheDocument()

    // 「次へ」「前へ」も同じ行き先を指す
    await user.click(screen.getByRole("link", { name: "次のページ" }))
    await waitFor(() => {
      expect(screen.getByText("が テスト操作 101")).toBeInTheDocument()
    })
    await user.click(screen.getByRole("link", { name: "前のページ" }))
    await waitFor(() => {
      expect(screen.getByText("が テスト操作 51")).toBeInTheDocument()
    })
  })

  it("最後のページより先、最初のページより前へは進まない", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(screen.getByRole("link", { name: "前のページ" }))
    await waitFor(() => {
      expect(screen.getByText("が テスト操作 1")).toBeInTheDocument()
    })
    for (const call of getLogs.mock.calls) {
      expect(call[0]?.offset).toBe(0)
    }
  })

  it("絞り込むと条件が要求へ乗り、先頭のページから見直す", async () => {
    const user = userEvent.setup()
    await renderList()

    // いったん3ページ目まで進んでから絞り込む
    await user.click(screen.getByRole("link", { name: "3ページ目" }))
    await waitFor(() => {
      expect(screen.getByText("が テスト操作 101")).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText("内容で検索..."), "77")

    await waitFor(() => {
      expect(getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "77", offset: 0 })
      )
    })
    await waitFor(() => {
      expect(screen.getByText("が テスト操作 77")).toBeInTheDocument()
    })
    expect(screen.queryByText("が テスト操作 101")).not.toBeInTheDocument()
    expect(screen.getByText("1 件中 1〜1 件")).toBeInTheDocument()
  })
})
