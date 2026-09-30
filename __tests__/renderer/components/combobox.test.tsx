// @vitest-environment jsdom
/**
 * Combobox（Popover + cmdk の、打って絞り込んで1つ選ぶ部品）のテスト
 *
 * - 絞り込みは label と keywords だけを見る（value = id では引っかからない）
 * - カタカナで持っている語にひらがなで打っても引っかかる
 * - クリックでもキーボードだけでも選べる。閉じるとフォーカスはボタンへ戻る
 * - 日本語入力の変換中の Enter では選ばない
 */

import "../setup"

import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { Combobox, type ComboboxOption } from "@/components/common/Combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

beforeAll(() => {
  // cmdk は選択中の項目を scrollIntoView する。jsdom は持たない
  Element.prototype.scrollIntoView = () => {}
})

const studentOptions: ComboboxOption[] = [
  {
    value: "a1b2c3d4-0001",
    label: "山田 太郎 (1001)",
    keywords: ["1001", "ヤマダ タロウ"],
  },
  {
    value: "a1b2c3d4-0002",
    label: "佐藤 花子 (1002)",
    keywords: ["1002", "サトウ ハナコ"],
  },
  {
    value: "a1b2c3d4-0003",
    label: "鈴木 一郎 (1003)",
    keywords: ["1003", "スズキ イチロウ"],
  },
]

function renderCombobox(
  options: ComboboxOption[] = studentOptions,
  initialValue = ""
) {
  const handleValueChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState(initialValue)
    return (
      <Combobox
        options={options}
        value={value}
        onValueChange={(nextValue) => {
          setValue(nextValue)
          handleValueChange(nextValue)
        }}
        placeholder="生徒を選択"
        searchPlaceholder="氏名で検索"
        emptyText="該当する生徒がいません"
      />
    )
  }
  render(<Harness />)
  return { handleValueChange }
}

/** 一覧に今見えている選択肢の文言 */
function visibleOptionLabels() {
  return within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => option.textContent)
}

describe("Combobox", () => {
  it("未選択なら placeholder を、選択中ならその label をボタンに出す", () => {
    renderCombobox(studentOptions, "a1b2c3d4-0002")
    expect(screen.getByRole("combobox")).toHaveTextContent("佐藤 花子 (1002)")
  })

  it("label で絞り込める", async () => {
    const user = userEvent.setup()
    renderCombobox()
    await user.click(screen.getByRole("combobox"))
    expect(visibleOptionLabels()).toHaveLength(3)

    await user.type(screen.getByPlaceholderText("氏名で検索"), "佐藤")
    expect(visibleOptionLabels()).toEqual(["佐藤 花子 (1002)"])
  })

  it("keywords で絞り込める（カタカナの語にひらがなで打っても当たる）", async () => {
    const user = userEvent.setup()
    renderCombobox()
    await user.click(screen.getByRole("combobox"))

    await user.type(screen.getByPlaceholderText("氏名で検索"), "すずき")
    expect(visibleOptionLabels()).toEqual(["鈴木 一郎 (1003)"])
  })

  it("空白を挟まずに姓名を続けて打っても当たる", async () => {
    const user = userEvent.setup()
    renderCombobox()
    await user.click(screen.getByRole("combobox"))

    await user.type(screen.getByPlaceholderText("氏名で検索"), "山田太郎")
    expect(visibleOptionLabels()).toEqual(["山田 太郎 (1001)"])
  })

  it("value（id）の文字列では引っかからない", async () => {
    const user = userEvent.setup()
    renderCombobox()
    await user.click(screen.getByRole("combobox"))

    // どの id にも含まれるが、label にも keywords にも無い
    await user.type(screen.getByPlaceholderText("氏名で検索"), "a1b2c3d4")
    expect(visibleOptionLabels()).toEqual([])
    expect(screen.getByText("該当する生徒がいません")).toBeInTheDocument()
  })

  it("絞り込んでも並び順は元のまま", async () => {
    const user = userEvent.setup()
    renderCombobox()
    await user.click(screen.getByRole("combobox"))

    await user.type(screen.getByPlaceholderText("氏名で検索"), "100")
    expect(visibleOptionLabels()).toEqual([
      "山田 太郎 (1001)",
      "佐藤 花子 (1002)",
      "鈴木 一郎 (1003)",
    ])
  })

  it("クリックで選ぶと value を渡して閉じる", async () => {
    const user = userEvent.setup()
    const { handleValueChange } = renderCombobox()
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "鈴木 一郎 (1003)" }))

    expect(handleValueChange).toHaveBeenCalledWith("a1b2c3d4-0003")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveTextContent("鈴木 一郎 (1003)")
  })

  it("キーボードだけで、開く・打つ・選ぶができ、閉じるとボタンへ戻る", async () => {
    const user = userEvent.setup()
    const { handleValueChange } = renderCombobox()

    await user.tab()
    expect(screen.getByRole("combobox")).toHaveFocus()

    await user.keyboard("{Enter}")
    const searchInput = screen.getByPlaceholderText("氏名で検索")
    expect(searchInput).toHaveFocus()

    await user.keyboard("100")
    await user.keyboard("{ArrowDown}{Enter}")

    expect(handleValueChange).toHaveBeenCalledWith("a1b2c3d4-0002")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveFocus()
  })

  it("Esc で閉じると何も選ばずボタンへ戻る", async () => {
    const user = userEvent.setup()
    const { handleValueChange } = renderCombobox()
    await user.click(screen.getByRole("combobox"))

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(handleValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole("combobox")).toHaveFocus()
  })

  it("開いたときは選択中の項目が当たっている", async () => {
    const user = userEvent.setup()
    renderCombobox(studentOptions, "a1b2c3d4-0003")
    await user.click(screen.getByRole("combobox"))

    expect(
      screen.getByRole("option", { name: "鈴木 一郎 (1003)" })
    ).toHaveAttribute("aria-selected", "true")
  })

  it("日本語入力の変換中の Enter では選ばない", async () => {
    const user = userEvent.setup()
    const { handleValueChange } = renderCombobox()
    await user.click(screen.getByRole("combobox"))
    const searchInput = screen.getByPlaceholderText("氏名で検索")

    fireEvent.keyDown(searchInput, { key: "Enter", isComposing: true })
    fireEvent.keyDown(searchInput, { key: "Enter", keyCode: 229 })
    expect(handleValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    // 変換を確定したあとの Enter では選ぶ
    fireEvent.keyDown(searchInput, { key: "Enter" })
    expect(handleValueChange).toHaveBeenCalledWith("a1b2c3d4-0001")
  })

  it("変換中の Esc では閉じない", async () => {
    const user = userEvent.setup()
    renderCombobox()
    await user.click(screen.getByRole("combobox"))
    const searchInput = screen.getByPlaceholderText("氏名で検索")

    fireEvent.keyDown(searchInput, { key: "Escape", isComposing: true })
    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })

  it("千件あっても絞り込める", async () => {
    const manyOptions = Array.from({ length: 1000 }, (_, index) => {
      const studentNumber = String(index + 1).padStart(4, "0")
      return {
        value: `student-${studentNumber}`,
        label: `生徒${studentNumber}`,
        keywords: [studentNumber],
      }
    })
    const user = userEvent.setup()
    renderCombobox(manyOptions)
    await user.click(screen.getByRole("combobox"))
    expect(visibleOptionLabels()).toHaveLength(1000)

    const startedAt = performance.now()
    await user.type(screen.getByPlaceholderText("氏名で検索"), "0999")
    const elapsedMilliseconds = performance.now() - startedAt

    expect(visibleOptionLabels()).toEqual(["生徒0999"])
    // jsdom は実ブラウザより遅い。桁が外れていないことだけを見る
    expect(elapsedMilliseconds).toBeLessThan(5000)
  })

  it("ダイアログの中でも、打って選べて、Esc は一覧だけを閉じる", async () => {
    const user = userEvent.setup()
    const handleValueChange = vi.fn()
    function DialogHarness() {
      const [value, setValue] = useState("")
      return (
        <Dialog open>
          <DialogContent>
            <DialogTitle>学級所属を追加</DialogTitle>
            <DialogDescription>生徒を選ぶ</DialogDescription>
            <Combobox
              options={studentOptions}
              value={value}
              onValueChange={(nextValue) => {
                setValue(nextValue)
                handleValueChange(nextValue)
              }}
              placeholder="生徒を選択"
              searchPlaceholder="氏名で検索"
              emptyText="該当する生徒がいません"
            />
          </DialogContent>
        </Dialog>
      )
    }
    render(<DialogHarness />)

    await user.click(screen.getByRole("combobox"))
    expect(screen.getByPlaceholderText("氏名で検索")).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox"))
    await user.keyboard("はなこ{Enter}")
    expect(handleValueChange).toHaveBeenCalledWith("a1b2c3d4-0002")
    expect(screen.getByRole("combobox")).toHaveFocus()
  })

  it("disabled ならボタンを押せない", () => {
    render(
      <Combobox
        options={studentOptions}
        value="a1b2c3d4-0001"
        onValueChange={() => {}}
        placeholder="生徒を選択"
        searchPlaceholder="氏名で検索"
        emptyText="該当する生徒がいません"
        disabled
      />
    )
    expect(screen.getByRole("combobox")).toBeDisabled()
    expect(screen.getByRole("combobox")).toHaveTextContent("山田 太郎 (1001)")
  })
})
