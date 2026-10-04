// @vitest-environment jsdom
/**
 * 監査ログ一覧（独立ページ `/audit-logs` の中身）の検査。
 *
 * 固定するのは6組。
 *
 * 1. **切るのは main。** 画面は1ページ分しか要求せず（`limit` / `offset` 付き）、
 *    受け取った行だけを描く。保持365日ぶんの行を renderer へ運んでから切る形に
 *    戻ると、`limit` の無い要求として現れる
 * 2. **ページ送り。** ページ番号を押すと `offset` が動き、そのページの行に入れ替わる
 * 3. **絞り込みは先頭のページから。** 3ページ目のまま条件を変えると、一致が
 *    1ページ分しかないときに空の画面へ着地する
 * 4. **絞り込みが変わっていないなら書かない。** 検索欄のデバウンスが初回にも走ると、
 *    開いた直後の 300ms のあいだに送ったページが1ページ目へ引き戻される
 * 5. **「自動」は表示領域の高さで決まる。** 高さ ÷ 1行の高さ（`AUDIT_LOG_ROW_HEIGHT`）
 *    が要求の件数になる。行の高さが固定であることが前提なので、行が伸び縮みする
 *    作りへ戻すとこの数は意味を失う
 *
 * 6. **絞り込みの欄（構文 + 補完）。** `student:` と打つと候補が出て、選ぶと chip に
 *    なり、要求の `targets` に乗る。採点領域を選ぶと、その試験の欄も一緒に足される。
 *    操作種別は action の集合へ展開して渡す（DB に verb の列は無い）
 *
 * 7. **操作者の名前が引けないとき。** `userId` が null ならシステム操作、
 *    `userId` があるのに利用者がいなければ削除された利用者。名前は残さない（削除の仕様）
 *
 * jsdom は高さを持たない（`clientHeight` は 0）ので、1〜4 では「自動」が
 * `FALLBACK_PAGE_SIZE` へ落ちる。5 だけが高さを差し込む。
 */

import "../setup"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuditLogItem } from "@/app/(app)/audit-logs/components/AuditLogItem"
import { AuditLogList } from "@/app/(app)/audit-logs/components/AuditLogList"
import { AUDIT_LOG_ROW_HEIGHT } from "@/app/(app)/audit-logs/constants"
import type {
  AuditLogFilter,
  AuditScopeFacet,
  AuditTargetFacet,
} from "@/electron-src/lib/prisma/auditQuery"
import { FALLBACK_PAGE_SIZE } from "@/lib/listPagination"
import { auditActionKeysOfVerb } from "@/lib/shared/auditActions"
import type { AuditLogRow } from "@/types/auditLog.types"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const TOTAL_ROWS = 120

/** 高さが測れないときの件数。1〜3 の期待値はこれで組み立てる */
const PAGE_SIZE = FALLBACK_PAGE_SIZE

/** 検索欄のデバウンス（300ms）を確実に越える待ち時間 */
const DEBOUNCE_WAIT_MS = 400

const buildLog = (rowNumber: number): AuditLogRow => ({
  id: `audit-${rowNumber}`,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
  action: "exam.create",
  category: "exam",
  userId: null,
  entityType: "Exam",
  entityId: `exam-${rowNumber}`,
  scopeId: `exam-${rowNumber}`,
  scopeLabel: null,
  summary: `テスト操作 ${rowNumber}`,
  metadata: null,
  coalesceKey: null,
  targets: [],
})

const allLogs = Array.from({ length: TOTAL_ROWS }, (_, i) => buildLog(i + 1))

const getLogs = vi.fn(
  async (filter: AuditLogFilter, limit: number, offset: number) => {
    const matched = filter.search
      ? allLogs.filter((log) => log.summary.includes(filter.search ?? ""))
      : allLogs
    return {
      logs: matched.slice(offset, offset + limit),
      total: matched.length,
      limit,
      offset,
    }
  }
)

/** 絞り込みの選択肢。採点領域「1-1」は試験Aにだけ現れる */
const scopeFacets: AuditScopeFacet[] = [
  { scopeId: "exam-a", scopeLabel: "試験A", category: "exam" },
  { scopeId: "exam-b", scopeLabel: "試験B", category: "exam" },
]
const targetFacets: AuditTargetFacet[] = [
  {
    targetType: "Student",
    targetId: "student-yamada",
    targetLabel: "山田 太郎",
    scopeId: "exam-a",
    scopeLabel: "試験A",
  },
  {
    targetType: "Student",
    targetId: "student-yamada",
    targetLabel: "山田 太郎",
    scopeId: "exam-b",
    scopeLabel: "試験B",
  },
  {
    targetType: "Student",
    targetId: "student-suzuki",
    targetLabel: "鈴木 花子",
    scopeId: "exam-a",
    scopeLabel: "試験A",
  },
  {
    targetType: "CropRegion",
    targetId: "region-a",
    targetLabel: "1-1",
    scopeId: "exam-a",
    scopeLabel: "試験A",
  },
]
const getScopes = vi.fn(async () => ({
  scopes: scopeFacets,
  targets: targetFacets,
}))

/** 直近の要求の絞り込み条件 */
const lastFilter = (): AuditLogFilter | undefined =>
  getLogs.mock.calls.at(-1)?.[0]

beforeEach(() => {
  getLogs.mockClear()
  getScopes.mockClear()
  Object.defineProperty(window, "electronAPI", {
    value: {
      audit: { getLogs, getScopes },
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
    expect(getLogs).toHaveBeenCalledWith(expect.anything(), PAGE_SIZE, 0)
    for (const call of getLogs.mock.calls) {
      expect(call[1]).toBe(PAGE_SIZE)
    }

    expect(screen.getByText(`が テスト操作 ${PAGE_SIZE}`)).toBeInTheDocument()
    expect(
      screen.queryByText(`が テスト操作 ${PAGE_SIZE + 1}`)
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(`${TOTAL_ROWS} 件中 1〜${PAGE_SIZE} 件`)
    ).toBeInTheDocument()
  })

  it("ページ番号を押すとそのページを取り直して入れ替わる", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(screen.getByRole("link", { name: "2ページ目" }))

    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${PAGE_SIZE + 1}`)
      ).toBeInTheDocument()
    })
    expect(getLogs).toHaveBeenCalledWith(
      expect.anything(),
      PAGE_SIZE,
      PAGE_SIZE
    )
    expect(screen.queryByText("が テスト操作 1")).not.toBeInTheDocument()
    expect(
      screen.getByText(
        `${TOTAL_ROWS} 件中 ${PAGE_SIZE + 1}〜${PAGE_SIZE * 2} 件`
      )
    ).toBeInTheDocument()

    // 「次へ」「前へ」も同じ行き先を指す
    await user.click(screen.getByRole("link", { name: "次のページ" }))
    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${PAGE_SIZE * 2 + 1}`)
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole("link", { name: "前のページ" }))
    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${PAGE_SIZE + 1}`)
      ).toBeInTheDocument()
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
      expect(call[2]).toBe(0)
    }
  })

  it("開いた直後にページを送っても、検索の待機に引き戻されない", async () => {
    // 検索欄のデバウンスが**初回にも走る**と、開いて 300ms 後に「絞り込みを
    // 変えた」ことになり（実際は空のまま）、先頭のページへ戻される。
    // 開いてすぐ2ページ目を押した人だけが1ページ目に着地する
    const user = userEvent.setup()
    await renderList()

    await user.click(screen.getByRole("link", { name: "2ページ目" }))
    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${PAGE_SIZE + 1}`)
      ).toBeInTheDocument()
    })

    // デバウンスの待ち時間（300ms）を越えて待つ
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS))
    })

    expect(
      screen.getByText(`が テスト操作 ${PAGE_SIZE + 1}`)
    ).toBeInTheDocument()
    expect(screen.queryByText("が テスト操作 1")).not.toBeInTheDocument()
    // 一度2ページ目へ移った後で、先頭のページを取り直してもいない
    const offsets = getLogs.mock.calls.map((call) => call[2])
    expect(offsets.lastIndexOf(0)).toBeLessThan(offsets.lastIndexOf(PAGE_SIZE))
  })

  it("絞り込むと条件が要求へ乗り、先頭のページから見直す", async () => {
    const user = userEvent.setup()
    await renderList()

    // いったん3ページ目まで進んでから絞り込む
    await user.click(screen.getByRole("link", { name: "次のページ" }))
    await user.click(screen.getByRole("link", { name: "次のページ" }))
    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${PAGE_SIZE * 2 + 1}`)
      ).toBeInTheDocument()
    })

    await user.type(
      screen.getByRole("textbox", { name: "絞り込み・内容で検索" }),
      "77"
    )

    await waitFor(() => {
      expect(getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "77" }),
        PAGE_SIZE,
        0
      )
    })
    await waitFor(() => {
      expect(screen.getByText("が テスト操作 77")).toBeInTheDocument()
    })
    expect(
      screen.queryByText(`が テスト操作 ${PAGE_SIZE * 2 + 1}`)
    ).not.toBeInTheDocument()
    expect(screen.getByText("1 件中 1〜1 件")).toBeInTheDocument()
  })
})

describe("監査ログの絞り込み欄", () => {
  const filterInput = () =>
    screen.getByRole("textbox", { name: "絞り込み・内容で検索" })

  it("欄の名前を打つと候補が出て、選ぶと chip になり対象の条件が要求に乗る", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(filterInput())
    await user.type(filterInput(), "student:山田")
    await user.click(await screen.findByRole("option", { name: /山田 太郎/ }))

    expect(
      screen.getByRole("button", { name: "生徒「山田 太郎」を外す" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(lastFilter()?.targets).toEqual([
        { targetType: "Student", targetId: "student-yamada" },
      ])
    })
    // 欄の名前を付けて打った文字は全文検索に回らない
    expect(lastFilter()?.search).toBeUndefined()
  })

  it("Tab で欄の名前を補完し、もう一度 Tab で候補を確定する", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(filterInput())
    await user.type(filterInput(), "stu")
    await user.keyboard("{Tab}")
    expect(filterInput()).toHaveValue("student:")

    await user.type(filterInput(), "鈴木")
    await screen.findByRole("option", { name: /鈴木 花子/ })
    await user.keyboard("{Tab}")

    await waitFor(() => {
      expect(lastFilter()?.targets).toEqual([
        { targetType: "Student", targetId: "student-suzuki" },
      ])
    })
    expect(filterInput()).toHaveValue("")
  })

  it("Enter で先頭の候補を確定する", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(filterInput())
    await user.type(filterInput(), "is:作成")
    await screen.findByRole("option", { name: "作成" })
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(lastFilter()?.actions).toEqual(auditActionKeysOfVerb("create"))
    })
  })

  it("試験が未確定のまま採点領域を選ぶと、その試験の欄も一緒に足される", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(filterInput())
    await user.type(filterInput(), "region:1-1")
    // 同じ名前の採点領域を見分けるため、試験名を添えて出す
    await user.click(await screen.findByRole("option", { name: /1-1.*試験A/ }))

    await waitFor(() => {
      expect(lastFilter()).toEqual(
        expect.objectContaining({
          scopeId: "exam-a",
          targets: [{ targetType: "CropRegion", targetId: "region-a" }],
        })
      )
    })
  })

  it("試験を確定すると、採点領域の候補はその試験の中だけになる", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(filterInput())
    await user.type(filterInput(), "scope:試験B")
    await user.click(await screen.findByRole("option", { name: /試験B/ }))
    await user.type(filterInput(), "region:")

    await waitFor(() => {
      expect(screen.getByText("該当する候補がありません")).toBeInTheDocument()
    })
  })

  it("操作種別は action の集合へ展開して渡し、Backspace で直前の chip を外す", async () => {
    const user = userEvent.setup()
    await renderList()

    await user.click(filterInput())
    await user.type(filterInput(), "is:削除")
    await user.click(await screen.findByRole("option", { name: "削除" }))

    await waitFor(() => {
      expect(lastFilter()?.actions).toEqual(auditActionKeysOfVerb("delete"))
    })

    await user.keyboard("{Backspace}")
    await waitFor(() => {
      expect(lastFilter()?.actions).toBeUndefined()
    })
  })
})

describe("監査ログ一覧の「自動」件数", () => {
  const VIEWPORT_HEIGHT = 800
  const originalResizeObserver = global.ResizeObserver

  /** いまの表示領域の高さ。窓の大きさが変わる検査で書き換える */
  let viewportHeight = VIEWPORT_HEIGHT
  /** 監視中のコールバック。窓の大きさが変わったことを後から知らせるために持つ */
  let resizeObserverCallbacks: ResizeObserverCallback[] = []
  const fakeObserver = {
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {},
  } as unknown as ResizeObserver

  beforeEach(() => {
    viewportHeight = VIEWPORT_HEIGHT
    resizeObserverCallbacks = []
    // jsdom はレイアウトを持たないので、表示領域の高さを差し込む
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => viewportHeight,
    })
    // 共通セットアップの ResizeObserver は何も観測しない。
    // 監視を始めた時点で1度呼ぶ本来の挙動に差し替える
    global.ResizeObserver = class implements ResizeObserver {
      private readonly callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        resizeObserverCallbacks.push(callback)
      }
      observe(): void {
        this.callback([], this)
      }
      unobserve(): void {}
      disconnect(): void {}
    }
  })

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight")
  })

  it("窓が広がって件数が増えても、いま見ている行に留まる", async () => {
    // ページ番号を覚えていると、窓を広げた瞬間に総ページ数が縮んで
    // 「12ページ目」が存在しなくなり、空の一覧に着地する（ページャは
    // 縮んだ総数までしか出さないので、いま居るページのボタンさえ無い）
    const user = userEvent.setup()
    viewportHeight = 600
    const smallPageSize = Math.floor(600 / AUDIT_LOG_ROW_HEIGHT)
    const lastPageNumber = Math.ceil(TOTAL_ROWS / smallPageSize)

    render(<AuditLogList />, { wrapper: createQueryWrapper() })
    await screen.findByText("が テスト操作 1")

    await user.click(
      screen.getByRole("link", { name: `${lastPageNumber}ページ目` })
    )
    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${TOTAL_ROWS}`)
      ).toBeInTheDocument()
    })

    // 窓を広げる（サイドバーを畳んだときも同じことが起きる）
    const grownPageSize = Math.floor(1200 / AUDIT_LOG_ROW_HEIGHT)
    act(() => {
      viewportHeight = 1200
      resizeObserverCallbacks.forEach((callback) => callback([], fakeObserver))
    })

    // 見ていた行（最後の1件）は、広い窓でも同じページに含まれている
    await waitFor(() => {
      expect(
        screen.getByText(`が テスト操作 ${TOTAL_ROWS}`)
      ).toBeInTheDocument()
    })
    expect(getLogs).toHaveBeenCalledWith(
      expect.anything(),
      grownPageSize,
      TOTAL_ROWS - grownPageSize
    )
    expect(
      screen.getByText(
        `${TOTAL_ROWS} 件中 ${TOTAL_ROWS - grownPageSize + 1}〜${TOTAL_ROWS} 件`
      )
    ).toBeInTheDocument()
  })

  it("表示領域の高さを1行の高さで割った件数を要求する", async () => {
    const expectedPageSize = Math.floor(VIEWPORT_HEIGHT / AUDIT_LOG_ROW_HEIGHT)
    expect(expectedPageSize).not.toBe(FALLBACK_PAGE_SIZE)

    render(<AuditLogList />, { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(getLogs).toHaveBeenCalledWith(
        expect.anything(),
        expectedPageSize,
        0
      )
    })
    expect(
      await screen.findByText(`が テスト操作 ${expectedPageSize}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`が テスト操作 ${expectedPageSize + 1}`)
    ).not.toBeInTheDocument()
  })
})

describe("監査ログの操作者", () => {
  it("userId が null の操作は「システム」と出す", () => {
    render(<AuditLogItem log={buildLog(1)} actorName={null} />)

    expect(screen.getByText("システム")).toBeInTheDocument()
  })

  it("利用者が見つからない操作は「削除されたユーザー」と出す", () => {
    render(
      <AuditLogItem
        log={{ ...buildLog(1), userId: "deleted-user" }}
        actorName={null}
      />
    )

    expect(screen.getByText("削除されたユーザー")).toBeInTheDocument()
  })
})
