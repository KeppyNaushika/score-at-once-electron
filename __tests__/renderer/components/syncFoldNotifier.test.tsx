// @vitest-environment jsdom
/**
 * 畳みの通知が、起きたことに見合った重さで出ること。
 *
 * 同期は別id・同一ユニークキーの行を1つへ「畳む」。行が1つ減るだけなら不便で済むが、
 * ぶら下がっていた子を**引き継げずに失う**場合が形として残っている（子が親を主キー
 * 以外の値で握っていて、その参照列を一時的に外せないとき）。ライブラリはその数を
 * 削除の前後の実測として返し、doc で「0 でなければ利用者へ知らせること」と求めている。
 *
 * ここで固定するのは、**失われたぶんが畳みの内訳に紛れないこと**。同じトーストの
 * 数字の並びに混ぜると「2件を1つにまとめました」の一部に見え、取り消せない消失だと
 * 伝わらない。だから別のトーストへ、しかも警告ではなくエラーとして出す。
 */

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SyncFoldNotifier } from "@/components/common/SyncFoldNotifier"
import type { SyncRecordFold } from "@/electron-src/lib/sync/types"

/** sonner の呼ばれ方。本文（description）を型で引けるよう、使う形だけ名乗る */
type ToastCall = (message: string, options: { description: string }) => void

// `vi.mock` の工場はファイル先頭へ巻き上げられるので、そこから触る変数も
// 一緒に巻き上げる（`vi.hoisted`）。素の const だと初期化前に読んで落ちる
const { toastWarning, toastError } = vi.hoisted(() => ({
  toastWarning: vi.fn<ToastCall>(),
  toastError: vi.fn<ToastCall>(),
}))

vi.mock("sonner", () => ({
  toast: {
    warning: toastWarning,
    error: toastError,
  },
}))

let pushFolds: ((folds: SyncRecordFold[]) => void) | null = null
vi.mock("@/queries/sync", () => ({
  subscribeSyncRecordFolds: (onFolded: (folds: SyncRecordFold[]) => void) => {
    pushFolds = onFolded
    return () => {
      pushFolds = null
    }
  },
}))

function fold(overrides: Partial<SyncRecordFold> = {}): SyncRecordFold {
  return {
    tableName: "ExamStudent",
    losingId: "losing-1",
    winningId: "winning-1",
    removedLocalRow: true,
    movedChildren: 0,
    lostChildren: 0,
    ...overrides,
  }
}

/** 画面に出して購読させ、main から押し出された体で畳みを流し込む */
function emit(folds: SyncRecordFold[]): void {
  render(<SyncFoldNotifier />)
  if (!pushFolds) throw new Error("購読が張られていない")
  pushFolds(folds)
}

/** トーストの1回目の呼び出しから、本文（description）を取り出す */
function descriptionOf(spy: typeof toastWarning): string {
  const [, options] = spy.mock.calls[0]
  return options.description
}

describe("SyncFoldNotifier", () => {
  beforeEach(() => {
    toastWarning.mockClear()
    toastError.mockClear()
    pushFolds = null
  })

  it("畳みが無ければ何も出さない", () => {
    emit([])
    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("複数の畳みを表ごとにまとめて1つのトーストにする", () => {
    emit([
      fold({ tableName: "ExamStudent", losingId: "a" }),
      fold({ tableName: "ExamStudent", losingId: "b" }),
      fold({ tableName: "Tag", losingId: "c" }),
    ])

    // 3件それぞれではなく、まとめて1回
    expect(toastWarning).toHaveBeenCalledTimes(1)
    const description = descriptionOf(toastWarning)
    expect(description).toContain("試験の受験生徒 2件")
    expect(description).toContain("タグ 1件")
  })

  it("付け替えた子の数を添える（影響範囲が件数だけでは伝わらないため）", () => {
    emit([
      fold({ movedChildren: 47 }),
      fold({ losingId: "b", movedChildren: 3 }),
    ])

    expect(descriptionOf(toastWarning)).toContain("50件")
  })

  it("引き継げず消えた子が無ければ、消失のトーストは出さない", () => {
    emit([fold({ movedChildren: 5 })])

    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(toastError).not.toHaveBeenCalled()
  })

  it("引き継げず消えた子は、畳みとは別のトーストへ分けて出す", () => {
    emit([
      fold({ tableName: "ExamStudent", losingId: "a", lostChildren: 2 }),
      fold({ tableName: "ExamStudent", losingId: "b", lostChildren: 3 }),
      fold({ tableName: "Tag", losingId: "c" }),
    ])

    // 畳みそのものは従来どおり1つ
    expect(toastWarning).toHaveBeenCalledTimes(1)
    // 消失は別立て。しかも警告ではなくエラー（取り消せないため）
    expect(toastError).toHaveBeenCalledTimes(1)
    const lost = descriptionOf(toastError)
    // 数えているのは子で、名前が付いているのは親。「試験の受験生徒 5件」と書くと
    // 受験生徒が5人消えたように読めるので、ぶら下がりだと分かる文にする
    expect(lost).toContain("試験の受験生徒にぶら下がっていた 5件")
    // 失っていない表は消失の側に出さない
    expect(lost).not.toContain("タグ")
  })

  it("知らない表の名前は、そのまま出して黙らない", () => {
    emit([fold({ tableName: "SomeFutureTable" })])

    expect(descriptionOf(toastWarning)).toContain("SomeFutureTable 1件")
  })
})
