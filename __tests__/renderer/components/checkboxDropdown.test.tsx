// @vitest-environment jsdom
/**
 * CheckboxDropdown（プルダウンの中のチェックで複数を選ぶ部品）。生徒管理の一覧の所属状況の
 * 絞り込みの形で確かめる
 *
 * - ボタンの要約: 全部なら「すべて」、1つならその名前、複数なら先頭＋「ほかN」、無ければ呼び出し側の文言
 * - 開いたまま続けて付け外しできる
 */
import "../setup"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { CheckboxDropdown } from "@/components/common/CheckboxDropdown"
import {
  DEFAULT_STUDENT_MEMBERSHIP_STATUSES,
  STUDENT_MEMBERSHIP_STATUS_LABELS,
  STUDENT_MEMBERSHIP_STATUSES,
  type StudentMembershipStatus,
} from "@/components/student/hooks/useStudentTableRows"

const statusOptions = STUDENT_MEMBERSHIP_STATUSES.map((status) => ({
  value: status,
  label: STUDENT_MEMBERSHIP_STATUS_LABELS[status],
}))

function FilterHarness() {
  const [statuses, setStatuses] = useState<
    ReadonlySet<StudentMembershipStatus>
  >(DEFAULT_STUDENT_MEMBERSHIP_STATUSES)
  return (
    <>
      <CheckboxDropdown
        options={statusOptions}
        selectedValues={statuses}
        onSelectedValuesChange={setStatuses}
        emptyText="所属状況"
        aria-label="所属状況で絞り込む"
      />
      <output data-testid="chosen">{[...statuses].toSorted().join(",")}</output>
    </>
  )
}

/** 開いている間はメニューの外が aria-hidden になる */
const triggerButton = () =>
  screen.getByRole("button", { name: "所属状況で絞り込む", hidden: true })

describe("CheckboxDropdown", () => {
  it("既定は未在籍・在籍中・在籍予定で、ボタンは先頭＋「ほか」の要約", () => {
    render(<FilterHarness />)
    expect(triggerButton()).toHaveTextContent("未在籍ほか2")
  })

  it("開いたまま続けて付け外しでき、全部なら「すべて」、1つならその名前、無ければ呼び出し側の文言", async () => {
    const user = userEvent.setup()
    render(<FilterHarness />)
    await user.click(triggerButton())

    await user.click(screen.getByRole("menuitemcheckbox", { name: "過去在籍" }))
    // 選んでもメニューは閉じない
    expect(
      screen.getByRole("menuitemcheckbox", { name: "未在籍" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("chosen")).toHaveTextContent(
      "current,past,unassigned,upcoming"
    )
    expect(triggerButton()).toHaveTextContent("すべて")

    await user.click(screen.getByRole("menuitemcheckbox", { name: "未在籍" }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "在籍中" }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "在籍予定" }))
    expect(screen.getByTestId("chosen")).toHaveTextContent("past")
    expect(triggerButton()).toHaveTextContent("過去在籍")

    await user.click(screen.getByRole("menuitemcheckbox", { name: "過去在籍" }))
    expect(screen.getByTestId("chosen")).toHaveTextContent("")
    expect(triggerButton()).toHaveTextContent("所属状況")
  })
})
