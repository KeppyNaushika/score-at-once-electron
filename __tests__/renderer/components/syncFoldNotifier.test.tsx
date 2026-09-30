// @vitest-environment jsdom
/**
 * 同期で隠れた行・表示に戻った行の通知が、起きたことをそのまま伝えること。
 *
 * 同期は別id・同一ユニークキーでかぶった行の片方を**隠す**（sqlite-nas-sync v0.20.0 から。
 * それまでは片方を消して1つへ「畳んで」いた）。隠した方の事実は残り、重なりが解ければ
 * 表示に戻る（表示している方を削除したときは、隠れている方も一緒に消える）。
 *
 * ここで固定するのは次の2つ:
 *
 * - **隠したことを「消した」と読ませない。** 「1つにまとめました」と書くと消えたと読まれる。
 *   消していないこと、戻りうることを本文に書く
 * - **戻ったことも黙らない。** 利用者から見ると、消したはずのもの（あるいは見えなかったもの）が
 *   急に現れる。隠したときとは別のトーストで、何が戻ったかを出す
 */

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SyncFoldNotifier } from "@/components/common/SyncFoldNotifier"
import type {
  SyncRecordFold,
  SyncRecordFoldReport,
} from "@/electron-src/lib/sync/types"

/** sonner の呼ばれ方。本文（description）を型で引けるよう、使う形だけ名乗る */
type ToastCall = (message: string, options: { description: string }) => void

// `vi.mock` の工場はファイル先頭へ巻き上げられるので、そこから触る変数も
// 一緒に巻き上げる（`vi.hoisted`）。素の const だと初期化前に読んで落ちる
const { toastWarning, toastInfo, toastError } = vi.hoisted(() => ({
  toastWarning: vi.fn<ToastCall>(),
  toastInfo: vi.fn<ToastCall>(),
  toastError: vi.fn<ToastCall>(),
}))

vi.mock("sonner", () => ({
  toast: {
    warning: toastWarning,
    info: toastInfo,
    error: toastError,
  },
}))

let pushReport: ((report: SyncRecordFoldReport) => void) | null = null
vi.mock("@/queries/sync", () => ({
  subscribeSyncRecordFoldsChanged: (
    onChanged: (report: SyncRecordFoldReport) => void
  ) => {
    pushReport = onChanged
    return () => {
      pushReport = null
    }
  },
}))

function fold(overrides: Partial<SyncRecordFold> = {}): SyncRecordFold {
  return {
    tableName: "ExamStudent",
    losingId: "losing-1",
    winningId: "winning-1",
    ...overrides,
  }
}

/** 画面に出して購読させ、main から押し出された体で1回ぶんの出来事を流し込む */
function emit(report: Partial<SyncRecordFoldReport>): void {
  render(<SyncFoldNotifier />)
  if (!pushReport) throw new Error("購読が張られていない")
  pushReport({ folds: [], restores: [], ...report })
}

/** トーストの1回目の呼び出しから、本文（description）を取り出す */
function descriptionOf(spy: typeof toastWarning): string {
  const [, options] = spy.mock.calls[0]
  return options.description
}

describe("SyncFoldNotifier", () => {
  beforeEach(() => {
    toastWarning.mockClear()
    toastInfo.mockClear()
    toastError.mockClear()
    pushReport = null
  })

  it("隠れた行も戻った行も無ければ何も出さない", () => {
    emit({})
    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("隠れた行を表ごとにまとめて1つのトーストにする", () => {
    emit({
      folds: [
        fold({ tableName: "ExamStudent", losingId: "a" }),
        fold({ tableName: "ExamStudent", losingId: "b" }),
        fold({ tableName: "Tag", losingId: "c" }),
      ],
    })

    // 3件それぞれではなく、まとめて1回
    expect(toastWarning).toHaveBeenCalledTimes(1)
    const description = descriptionOf(toastWarning)
    expect(description).toContain("試験の受験生徒 2件")
    expect(description).toContain("タグ 1件")
    // 隠れただけなので、戻った側のトーストは出さない
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it("隠したことを「消した」と読ませない（消していない・戻りうると書く）", () => {
    emit({ folds: [fold()] })

    const [title] = toastWarning.mock.calls[0]
    expect(title).toContain("隠しました")
    // 旧方式の「1つにまとめました」は、片方が消えたと読まれる
    expect(title).not.toContain("まとめ")
    const description = descriptionOf(toastWarning)
    expect(description).toContain("消してはいない")
    expect(description).toContain("表示に戻ります")
    // 消失を伝えるエラーのトーストは、もう起きない出来事なので出さない
    expect(toastError).not.toHaveBeenCalled()
  })

  it("表示に戻った行は、隠したときとは別のトーストで表ごとに出す", () => {
    emit({
      restores: [
        fold({ tableName: "Tag", losingId: "a" }),
        fold({ tableName: "Tag", losingId: "b" }),
      ],
    })

    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledTimes(1)
    const [title] = toastInfo.mock.calls[0]
    expect(title).toContain("表示に戻しました")
    expect(descriptionOf(toastInfo)).toContain("タグ 2件")
  })

  it("同じ同期で隠れた行と戻った行があれば、両方を別々に出す", () => {
    emit({
      folds: [fold({ tableName: "ExamStudent", losingId: "a" })],
      restores: [fold({ tableName: "Tag", losingId: "b" })],
    })

    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(descriptionOf(toastWarning)).toContain("試験の受験生徒 1件")
    expect(descriptionOf(toastWarning)).not.toContain("タグ")
    expect(toastInfo).toHaveBeenCalledTimes(1)
    expect(descriptionOf(toastInfo)).toContain("タグ 1件")
    expect(descriptionOf(toastInfo)).not.toContain("試験の受験生徒")
  })

  it("知らない表の名前は、そのまま出して黙らない", () => {
    emit({ folds: [fold({ tableName: "SomeFutureTable" })] })

    expect(descriptionOf(toastWarning)).toContain("SomeFutureTable 1件")
  })
})
