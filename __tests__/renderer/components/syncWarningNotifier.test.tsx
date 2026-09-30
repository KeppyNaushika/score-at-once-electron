// @vitest-environment jsdom
/**
 * 同期が出した注意を、利用者が気づける形で知らせること。
 *
 * ライブラリの `SyncResult.warnings` は「アプリケーションの利用者に見える場所へ
 * 出すこと」とされている。ただしトーストは流れて消えるので、ここは**気づかせるだけ**で、
 * 消えない一覧は設定画面の同期タブにある。だから本文には、そこへ行けと書く。
 *
 * ここで固定するのは次の3つ:
 *
 * - **同期由来だと分かる印を付ける。** 同じトーストの並びに他の操作の結果も出るので、
 *   印が無いと自分の操作の結果だと読まれる
 * - **消えない置き場へ案内する。** これ1枚で完結すると読ませると、閉じた時点で終わる
 * - **言い換えられない注意も出す。** 知らないものを握りつぶさない
 */

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SyncWarningNotifier } from "@/components/common/SyncWarningNotifier"
import type { SyncWarningReport } from "@/electron-src/lib/sync/types"

/** sonner の呼ばれ方。本文（description）を型で引けるよう、使う形だけ名乗る */
type ToastCall = (message: string, options: { description: string }) => void

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

let pushReport: ((report: SyncWarningReport) => void) | null = null
vi.mock("@/queries/sync", () => ({
  subscribeSyncWarningsChanged: (
    onChanged: (report: SyncWarningReport) => void
  ) => {
    pushReport = onChanged
    return () => {
      pushReport = null
    }
  },
}))

/** 画面に出して購読させ、main から押し出された体で1回ぶんの注意を流し込む */
function emit(newWarnings: string[]): void {
  render(<SyncWarningNotifier />)
  if (!pushReport) throw new Error("購読が張られていない")
  pushReport({ newWarnings })
}

function descriptionOf(spy: typeof toastWarning): string {
  const [, options] = spy.mock.calls[0]
  return options.description
}

describe("SyncWarningNotifier", () => {
  beforeEach(() => {
    toastWarning.mockClear()
    toastInfo.mockClear()
    toastError.mockClear()
    pushReport = null
  })

  it("新しい注意が無ければ何も出さない", () => {
    emit([])
    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it("同期由来の印を付け、消えない一覧へ案内する", () => {
    emit(["Failed to open remote database: other-pc"])

    expect(toastWarning).toHaveBeenCalledTimes(1)
    const [title] = toastWarning.mock.calls[0]
    expect(title).toContain("同期")
    expect(title).toContain("beta")
    expect(descriptionOf(toastWarning)).toContain("同期設定")
  })

  it("何種類出ても1つのトーストにまとめる", () => {
    emit([
      "Failed to open remote database: pc-a",
      "Sync failed for client pc-b: boom",
      "Unplaceable ExamStudent:x: 理由",
    ])

    expect(toastWarning).toHaveBeenCalledTimes(1)
    const description = descriptionOf(toastWarning)
    expect(description).toContain("読み取れませんでした")
    expect(description).toContain("読み直します")
    expect(description).toContain("試験の受験生徒")
  })

  it("同じ種類が並んだら件数にまとめる", () => {
    emit(["Unplaceable Exam:a: 理由", "Unplaceable Exam:b: 理由"])

    expect(descriptionOf(toastWarning)).toContain("（2件）")
  })

  it("報告だけの知らせは、警告ではなく情報として出す", () => {
    emit(["Rebuild deferred: 書き込み中（見送り 1 回目）"])

    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it("手当ての要るものが1つでも混ざれば警告にする", () => {
    emit([
      "Rebuild deferred: 書き込み中（見送り 1 回目）",
      "Rebuild failed: 外部キーの違反",
    ])

    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it("言い換えられない注意も、原文のまま出して黙らない", () => {
    emit(["Some future warning the app has never seen"])

    expect(descriptionOf(toastWarning)).toContain(
      "Some future warning the app has never seen"
    )
  })
})
