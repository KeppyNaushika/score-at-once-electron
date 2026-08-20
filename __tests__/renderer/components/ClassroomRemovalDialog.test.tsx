// @vitest-environment jsdom
/**
 * ClassroomRemovalDialog（学級削除の2段階モーダル）のテスト
 *
 * 設計3章の分岐を検証する:
 * - unlink-only（試験）: 単純確認1段階で deleteStudents=false
 * - can-delete-students（成績/資料）: 登録解除のみ / 専属生徒も削除 を選択。
 *   専属生徒を削除しかつ対象1名以上なら2段階目の最終確認を挟む。
 */

import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ClassroomRemovalDialog } from "@/components/common/classroom-roster/ClassroomRemovalDialog"
import type { ClassroomRosterEntry } from "@/components/common/classroom-roster/types"
import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"

/** 専属生徒 n 名を見せたときの件数（0名なら項目を出さない） */
const exclusiveStudents = (count: number) =>
  count === 0
    ? []
    : [
        {
          countedName: DELETION_COUNT_NAME.exclusiveStudent,
          shownCount: count,
        },
      ]

const entry: ClassroomRosterEntry = {
  id: "c1",
  classroomId: "c1",
  name: "3-A組",
  studentCount: 3,
  order: 0,
}

describe("ClassroomRemovalDialog", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("unlink-only: 単純確認で deleteStudents=false を渡す", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ClassroomRemovalDialog
        entry={entry}
        mode="unlink-only"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole("button", { name: "登録を解除" }))

    expect(onConfirm).toHaveBeenCalledWith(entry, false, [])
  })

  it("can-delete-students: 登録解除のみ選択なら deleteStudents=false（2段階目なし）", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const fetchRemovalPreview = vi.fn().mockResolvedValue(exclusiveStudents(2))

    render(
      <ClassroomRemovalDialog
        entry={entry}
        mode="can-delete-students"
        fetchRemovalPreview={fetchRemovalPreview}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    // プレビュー取得を待つ（既定の「登録を解除」ボタンが有効化される）
    const actionButton = await screen.findByRole("button", {
      name: "登録を解除",
    })
    await user.click(actionButton)

    expect(onConfirm).toHaveBeenCalledWith(entry, false, [])
  })

  it("can-delete-students: 専属生徒削除を選ぶと2段階目を経て deleteStudents=true", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const fetchRemovalPreview = vi.fn().mockResolvedValue(exclusiveStudents(2))

    render(
      <ClassroomRemovalDialog
        entry={entry}
        mode="can-delete-students"
        fetchRemovalPreview={fetchRemovalPreview}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    // 専属生徒も削除を選択
    await waitFor(() => expect(fetchRemovalPreview).toHaveBeenCalled())
    await user.click(screen.getByRole("radio", { name: /専属の生徒も削除/ }))

    // 「次へ」で2段階目へ
    const nextButton = await screen.findByRole("button", { name: "次へ" })
    await user.click(nextButton)

    // 2段階目の最終確認
    const deleteButton = await screen.findByRole("button", { name: "削除する" })
    await user.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledWith(entry, true, exclusiveStudents(2))
  })

  it("can-delete-students: プレビュー取得失敗時は確認なしで専属削除しない", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    // プレビューAPIが失敗（IPCエラー等）
    const fetchRemovalPreview = vi
      .fn()
      .mockRejectedValue(new Error("preview failed"))

    render(
      <ClassroomRemovalDialog
        entry={entry}
        mode="can-delete-students"
        fetchRemovalPreview={fetchRemovalPreview}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    await waitFor(() => expect(fetchRemovalPreview).toHaveBeenCalled())
    // 「専属生徒も削除」を選んでも、件数不明なので確定ボタンは無効
    await user.click(screen.getByRole("radio", { name: /専属の生徒も削除/ }))
    expect(
      screen.getByRole("button", { name: /次へ|登録を解除/ })
    ).toBeDisabled()

    // 「登録解除のみ」に切り替えれば実行可（安全側は通る）
    await user.click(screen.getByRole("radio", { name: /登録だけ解除/ }))
    const unlinkButton = screen.getByRole("button", { name: "登録を解除" })
    expect(unlinkButton).toBeEnabled()
    await user.click(unlinkButton)
    expect(onConfirm).toHaveBeenCalledWith(entry, false, [])
  })

  it("can-delete-students: 専属生徒0名なら2段階目なしで実行", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const fetchRemovalPreview = vi.fn().mockResolvedValue(exclusiveStudents(0))

    render(
      <ClassroomRemovalDialog
        entry={entry}
        mode="can-delete-students"
        fetchRemovalPreview={fetchRemovalPreview}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    await waitFor(() => expect(fetchRemovalPreview).toHaveBeenCalled())
    await user.click(screen.getByRole("radio", { name: /専属の生徒も削除/ }))

    // 削除対象0名 → ボタンは「登録を解除」、押すと直接実行（2段階目なし）
    const actionButton = await screen.findByRole("button", {
      name: "登録を解除",
    })
    await user.click(actionButton)

    expect(onConfirm).toHaveBeenCalledWith(entry, true, [])
    expect(
      screen.queryByRole("button", { name: "削除する" })
    ).not.toBeInTheDocument()
  })
})
