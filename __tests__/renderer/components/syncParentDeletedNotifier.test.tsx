// @vitest-environment jsdom
/**
 * 親を他のPCで消されて表から外れた行・戻った行の通知が、起きたことをそのまま伝えること。
 *
 * sqlite-nas-sync v0.21.0 から、親の削除と並行に他のPCで書かれた子は、宣言された
 * `ON DELETE` に従ってアプリの表に入らなくなる（`parentDeleted`）。子の版は残っていて、
 * 親が同じ id で作り直されれば元の形で戻る（`parentReturned`）。
 *
 * ここで固定するのは次の2つ:
 *
 * - **外れたことを「消した」と読ませない。** 中身は残っていて戻りうることを本文に書く
 * - **何の削除に巻き込まれたのかを書く。** 原因になったものの名前が無いと、利用者は
 *   自分の入力がなぜ消えたのか分からない
 */

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SyncParentDeletedNotifier } from "@/components/common/SyncParentDeletedNotifier"
import type {
  SyncParentDeleted,
  SyncParentDeletedReport,
} from "@/electron-src/lib/sync/types"

/** sonner の呼ばれ方。本文（description）を型で引けるよう、使う形だけ名乗る */
type ToastCall = (message: string, options: { description: string }) => void

// `vi.mock` の工場はファイル先頭へ巻き上げられるので、そこから触る変数も
// 一緒に巻き上げる（`vi.hoisted`）
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

let pushReport: ((report: SyncParentDeletedReport) => void) | null = null
vi.mock("@/queries/sync", () => ({
  subscribeSyncParentDeletedChanged: (
    onChanged: (report: SyncParentDeletedReport) => void
  ) => {
    pushReport = onChanged
    return () => {
      pushReport = null
    }
  },
}))

function parentDeleted(
  overrides: Partial<SyncParentDeleted> = {}
): SyncParentDeleted {
  return {
    tableName: "QuestionScore",
    recordId: "score-1",
    content: { id: "score-1" },
    causeTable: "ExamStudent",
    causeId: "exam-student-1",
    ...overrides,
  }
}

/** 画面に出して購読させ、main から押し出された体で1回ぶんの出来事を流し込む */
function emit(report: Partial<SyncParentDeletedReport>): void {
  render(<SyncParentDeletedNotifier />)
  if (!pushReport) throw new Error("購読が張られていない")
  pushReport({ parentDeleted: [], parentReturned: [], ...report })
}

/** トーストの1回目の呼び出しから、本文（description）を取り出す */
function descriptionOf(spy: typeof toastWarning): string {
  const [, options] = spy.mock.calls[0]
  return options.description
}

describe("SyncParentDeletedNotifier", () => {
  beforeEach(() => {
    toastWarning.mockClear()
    toastInfo.mockClear()
    toastError.mockClear()
    pushReport = null
  })

  it("外れた行も戻った行も無ければ何も出さない", () => {
    emit({})
    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("外れた行を、消されたものごと・表ごとにまとめて1つのトーストにする", () => {
    emit({
      parentDeleted: [
        parentDeleted({ tableName: "QuestionScore", recordId: "a" }),
        parentDeleted({ tableName: "QuestionScore", recordId: "b" }),
        parentDeleted({
          tableName: "DrawingAnnotation",
          recordId: "c",
        }),
      ],
    })

    // 3件それぞれではなく、まとめて1回
    expect(toastWarning).toHaveBeenCalledTimes(1)
    const description = descriptionOf(toastWarning)
    expect(description).toContain("試験の受験生徒の削除にともない")
    expect(description).toContain("設問ごとの点数 2件")
    expect(description).toContain("答案への書き込み 1件")
    // 外れただけなので、戻った側のトーストは出さない
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it("消されたものが複数あれば、それぞれ分けて並べる", () => {
    emit({
      parentDeleted: [
        parentDeleted({ causeTable: "ExamStudent", recordId: "a" }),
        parentDeleted({
          causeTable: "Exam",
          causeId: "exam-1",
          tableName: "StudentAnswerImage",
          recordId: "b",
        }),
      ],
    })

    const description = descriptionOf(toastWarning)
    expect(description).toContain(
      "試験の受験生徒の削除にともない 設問ごとの点数 1件"
    )
    expect(description).toContain("試験の削除にともない 答案画像 1件")
  })

  it("外れたことを「消した」と読ませない（残っている・戻りうると書く）", () => {
    emit({ parentDeleted: [parentDeleted()] })

    const [title] = toastWarning.mock.calls[0]
    expect(title).toContain("表示から外しました")
    expect(title).not.toContain("削除しました")
    const description = descriptionOf(toastWarning)
    expect(description).toContain("中身は残してあ")
    expect(description).toContain("表示に戻ります")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("表示に戻った行は、外したときとは別のトーストで出す", () => {
    emit({
      parentReturned: [
        parentDeleted({ tableName: "QuestionScore", recordId: "a" }),
      ],
    })

    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledTimes(1)
    const [title] = toastInfo.mock.calls[0]
    expect(title).toContain("表示に戻しました")
    expect(descriptionOf(toastInfo)).toContain("設問ごとの点数 1件")
  })

  it("同じ同期で外れた行と戻った行があれば、両方を別々に出す", () => {
    emit({
      parentDeleted: [
        parentDeleted({ tableName: "QuestionScore", recordId: "a" }),
      ],
      parentReturned: [
        parentDeleted({ tableName: "StudentAnswerImage", recordId: "b" }),
      ],
    })

    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(descriptionOf(toastWarning)).toContain("設問ごとの点数 1件")
    expect(descriptionOf(toastWarning)).not.toContain("答案画像")
    expect(toastInfo).toHaveBeenCalledTimes(1)
    expect(descriptionOf(toastInfo)).toContain("答案画像 1件")
  })

  it("知らない表の名前は、そのまま出して黙らない", () => {
    emit({
      parentDeleted: [
        parentDeleted({
          tableName: "SomeFutureTable",
          causeTable: "SomeFutureParent",
        }),
      ],
    })

    const description = descriptionOf(toastWarning)
    expect(description).toContain("SomeFutureTable 1件")
    expect(description).toContain("SomeFutureParentの削除にともない")
  })
})
