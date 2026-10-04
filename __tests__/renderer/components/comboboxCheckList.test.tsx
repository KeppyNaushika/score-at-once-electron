// @vitest-environment jsdom
/**
 * ComboboxCheckList（開いたままの、複数を選ぶチェック一覧）のテスト
 *
 * - 行そのものを選ぶ（クリック・↑↓ と Enter・空欄での Space）とチェックが入れ替わる
 * - 絞り込みは Combobox と同じ規則（label と keywords・ひらがな・空白を詰めても当たる）
 * - 日本語入力の変換中の Enter・Space では入れ替えない
 * - 今いる行（マウスを当てた・↑↓ で来た）を知らせ、一覧から離れたら null を知らせる
 * - 外せない行は選んでも入れ替わらない
 */

import "../setup"

import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import {
  ComboboxCheckList,
  type ComboboxCheckOption,
} from "@/components/common/ComboboxCheckList"

beforeAll(() => {
  // cmdk は選択中の項目を scrollIntoView する。jsdom は持たない
  Element.prototype.scrollIntoView = () => {}
})

const studentOptions: ComboboxCheckOption[] = [
  {
    value: "a1b2c3d4-0001",
    label: "山田 太郎 (1001)",
    keywords: ["1001", "ヤマダ タロウ"],
    checked: true,
    statusText: "選択中",
  },
  {
    value: "a1b2c3d4-0002",
    label: "佐藤 花子 (1002)",
    keywords: ["1002", "サトウ ハナコ"],
    checked: false,
  },
  {
    value: "a1b2c3d4-0003",
    label: "鈴木 一郎 (1003)",
    keywords: ["1003", "スズキ イチロウ"],
    checked: true,
    lockedReason: "成績算出『期末』が使うため",
  },
]

function renderCheckList(options: ComboboxCheckOption[] = studentOptions) {
  const handleCheckedChange = vi.fn()
  const handleActiveValueChange = vi.fn()
  const handleCheckedChangeMany = vi.fn()
  function Harness() {
    const [checkedValues, setCheckedValues] = useState(
      () =>
        new Set(
          options
            .filter((option) => option.checked)
            .map((option) => option.value)
        )
    )
    return (
      <>
        <ComboboxCheckList
          options={options.map((option) => ({
            ...option,
            checked: checkedValues.has(option.value),
          }))}
          onCheckedChange={(value, checked) => {
            handleCheckedChange(value, checked)
            setCheckedValues((prev) => {
              const next = new Set(prev)
              if (checked) {
                next.add(value)
              } else {
                next.delete(value)
              }
              return next
            })
          }}
          onActiveValueChange={handleActiveValueChange}
          onCheckedChangeMany={(values, checked) => {
            handleCheckedChangeMany(values, checked)
            setCheckedValues((prev) => {
              const next = new Set(prev)
              values.forEach((value) => {
                if (checked) {
                  next.add(value)
                } else {
                  next.delete(value)
                }
              })
              return next
            })
          }}
          selectAllLabel="表示中の生徒を全て選ぶ"
          searchPlaceholder="氏名で検索"
          emptyText="該当する生徒がいません"
          aria-label="生徒の一覧"
        />
        <button type="button">外のボタン</button>
      </>
    )
  }
  render(<Harness />)
  return {
    handleCheckedChange,
    handleActiveValueChange,
    handleCheckedChangeMany,
  }
}

/** 一覧に今見えている行の名前（読み上げ文） */
function visibleOptionNames() {
  return within(screen.getByRole("listbox", { name: "生徒の一覧" }))
    .queryAllByRole("option")
    .map((option) => option.textContent)
}

describe("ComboboxCheckList", () => {
  it("開いたまま全件を並べ、チェックの状態を行の文で伝える。印はフォーカスを受けない", () => {
    renderCheckList()
    expect(visibleOptionNames()).toEqual([
      "山田 太郎 (1001)選択中",
      "佐藤 花子 (1002)",
      "鈴木 一郎 (1003)成績算出『期末』が使うため",
    ])
    // 行の中に操作できる部品を置かない
    expect(
      within(screen.getByRole("listbox")).queryByRole("checkbox")
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole("listbox")).queryByRole("button")
    ).not.toBeInTheDocument()
  })

  it("行をクリックするとチェックが入れ替わる", async () => {
    const user = userEvent.setup()
    const { handleCheckedChange } = renderCheckList()

    await user.click(screen.getByRole("option", { name: /佐藤 花子/ }))
    expect(handleCheckedChange).toHaveBeenLastCalledWith("a1b2c3d4-0002", true)

    await user.click(screen.getByRole("option", { name: /山田 太郎/ }))
    expect(handleCheckedChange).toHaveBeenLastCalledWith("a1b2c3d4-0001", false)
  })

  it("検索欄にフォーカスを置いたまま ↑↓ で移り、Enter で入れ替える。空欄なら Space でも入れ替える", async () => {
    const user = userEvent.setup()
    const { handleCheckedChange } = renderCheckList()
    const searchInput = screen.getByPlaceholderText("氏名で検索")
    await user.click(searchInput)

    // 今いる行が無いところから ↓ で先頭、もう1回で2行目
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(searchInput).toHaveFocus()
    expect(screen.getByRole("option", { name: /佐藤 花子/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.keyboard("{Enter}")
    expect(handleCheckedChange).toHaveBeenLastCalledWith("a1b2c3d4-0002", true)

    await user.keyboard("{ArrowUp} ")
    expect(handleCheckedChange).toHaveBeenLastCalledWith("a1b2c3d4-0001", false)
    expect(searchInput).toHaveValue("")
  })

  it("語を打っているときの Space は区切りの空白として打たれ、入れ替えない", async () => {
    const user = userEvent.setup()
    const { handleCheckedChange } = renderCheckList()
    const searchInput = screen.getByPlaceholderText("氏名で検索")
    await user.click(searchInput)

    await user.keyboard("やまだ たろう")
    expect(searchInput).toHaveValue("やまだ たろう")
    expect(handleCheckedChange).not.toHaveBeenCalled()
    expect(visibleOptionNames()).toEqual(["山田 太郎 (1001)選択中"])
  })

  it("Combobox と同じ規則で絞り込める（keywords・ひらがな・空白を詰めても当たる、id では当たらない）", async () => {
    const user = userEvent.setup()
    renderCheckList()
    const searchInput = screen.getByPlaceholderText("氏名で検索")

    await user.type(searchInput, "すずき")
    expect(visibleOptionNames()).toEqual([
      "鈴木 一郎 (1003)成績算出『期末』が使うため",
    ])

    await user.clear(searchInput)
    await user.type(searchInput, "佐藤花子")
    expect(visibleOptionNames()).toEqual(["佐藤 花子 (1002)"])

    await user.clear(searchInput)
    await user.type(searchInput, "a1b2c3d4")
    expect(visibleOptionNames()).toEqual([])
    expect(screen.getByText("該当する生徒がいません")).toBeInTheDocument()
  })

  it("日本語入力の変換中の Enter・Space では入れ替えない", async () => {
    const user = userEvent.setup()
    const { handleCheckedChange } = renderCheckList()
    const searchInput = screen.getByPlaceholderText("氏名で検索")
    await user.click(searchInput)

    await user.keyboard("{ArrowDown}")

    fireEvent.keyDown(searchInput, { key: "Enter", isComposing: true })
    fireEvent.keyDown(searchInput, { key: "Enter", keyCode: 229 })
    fireEvent.keyDown(searchInput, { key: " ", isComposing: true })
    fireEvent.keyDown(searchInput, { key: " ", keyCode: 229 })
    expect(handleCheckedChange).not.toHaveBeenCalled()

    // 変換を確定したあとの Enter では入れ替える
    fireEvent.keyDown(searchInput, { key: "Enter" })
    expect(handleCheckedChange).toHaveBeenCalledWith("a1b2c3d4-0001", false)
  })

  it("外せない行は、クリックしても Enter でも入れ替わらない", async () => {
    const user = userEvent.setup()
    const { handleCheckedChange } = renderCheckList()

    await user.click(screen.getByRole("option", { name: /鈴木 一郎/ }))
    await user.click(screen.getByPlaceholderText("氏名で検索"))
    await user.keyboard("{End}{Enter} ")

    expect(handleCheckedChange).not.toHaveBeenCalled()
  })

  it("今いる行（マウスを当てた・↑↓ で来た）を知らせ、一覧から離れたら null を知らせる", async () => {
    const user = userEvent.setup()
    const { handleActiveValueChange } = renderCheckList()
    // 一覧に触れる前に cmdk が先頭へ寄せた行は知らせない
    expect(handleActiveValueChange).not.toHaveBeenCalled()

    await user.hover(screen.getByRole("option", { name: /鈴木 一郎/ }))
    expect(handleActiveValueChange).toHaveBeenLastCalledWith("a1b2c3d4-0003")

    await user.unhover(screen.getByRole("listbox"))
    await user.hover(screen.getByRole("button", { name: "外のボタン" }))
    expect(handleActiveValueChange).toHaveBeenLastCalledWith(null)

    // 離れたので今いる行は消えている。↓ で先頭から
    await user.click(screen.getByPlaceholderText("氏名で検索"))
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(handleActiveValueChange).toHaveBeenLastCalledWith("a1b2c3d4-0002")

    // マウスが外へ出ても、フォーカスが一覧にある間は今いる行のまま
    await user.hover(screen.getByRole("button", { name: "外のボタン" }))
    expect(handleActiveValueChange).toHaveBeenLastCalledWith("a1b2c3d4-0002")
    await user.tab()
    expect(handleActiveValueChange).toHaveBeenLastCalledWith(null)
  })

  it("フォーカスを置いただけ・絞り込んだだけでは今いる行を知らせない", async () => {
    const user = userEvent.setup()
    const { handleActiveValueChange } = renderCheckList()

    await user.click(screen.getByPlaceholderText("氏名で検索"))
    expect(handleActiveValueChange).not.toHaveBeenCalled()

    await user.keyboard("{ArrowDown}")
    expect(handleActiveValueChange).toHaveBeenLastCalledWith("a1b2c3d4-0001")
    // 打つと cmdk が先頭へ寄せるが、それは利用者が選んだ行ではない
    await user.keyboard("すずき")
    expect(handleActiveValueChange).toHaveBeenLastCalledWith(null)
    // 1件に絞れて動けなくても、↓ を押せばその行が今いる行になる
    await user.keyboard("{ArrowDown}")
    expect(handleActiveValueChange).toHaveBeenLastCalledWith("a1b2c3d4-0003")
  })

  it("触れるまで今いる行を持たず、一覧から離れると今いる行の強調が消える", async () => {
    const user = userEvent.setup()
    renderCheckList()
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView")
    const selectedOptions = () =>
      screen
        .getAllByRole("option")
        .filter((option) => option.getAttribute("aria-selected") === "true")

    // 開いた直後: 先頭を選ばず、スクロールもしない
    expect(selectedOptions()).toEqual([])
    expect(scrollIntoView).not.toHaveBeenCalled()

    // フォーカスしただけでは選ばない。↓ で先頭へ
    await user.click(screen.getByPlaceholderText("氏名で検索"))
    expect(selectedOptions()).toEqual([])
    await user.keyboard("{ArrowDown}")
    expect(selectedOptions().map((option) => option.textContent)).toEqual([
      "山田 太郎 (1001)選択中",
    ])

    // フォーカスもマウスも外へ出ると消える
    await user.hover(screen.getByRole("button", { name: "外のボタン" }))
    await user.tab()
    expect(selectedOptions()).toEqual([])

    // マウスを当てると、その行が今いる行になり、外へ出ると消える
    await user.hover(screen.getByRole("option", { name: /佐藤 花子/ }))
    expect(selectedOptions().map((option) => option.textContent)).toEqual([
      "佐藤 花子 (1002)",
    ])
    await user.hover(screen.getByRole("button", { name: "外のボタン" }))
    expect(selectedOptions()).toEqual([])
    scrollIntoView.mockRestore()
  })

  it("右端の赤字を出している間、ふだんの状態は見た目だけ隠し、読み上げには両方入れる", () => {
    render(
      <ComboboxCheckList
        options={[
          { ...studentOptions[0], impactText: "2件の選択を解除" },
          {
            ...studentOptions[1],
            checked: true,
            statusText: "関連で入る",
            impactText: "外せません",
            impactDescription: "成績算出『期末』が使うため",
          },
        ]}
        onCheckedChange={vi.fn()}
        searchPlaceholder="氏名で検索"
        emptyText="該当する生徒がいません"
        aria-label="生徒の一覧"
      />
    )
    const yamadaOption = screen.getByRole("option", { name: /山田 太郎/ })
    expect(yamadaOption).toHaveTextContent(
      "山田 太郎 (1001)選択中2件の選択を解除"
    )
    const impact = within(yamadaOption).getByText("2件の選択を解除")
    const status = within(yamadaOption).getByText("選択中")
    expect(impact).toHaveClass("text-destructive")
    expect(status).toHaveClass("opacity-0")
    // 同じ升目に重ねる（行の大きさが変わらない）
    expect(impact.parentElement).toBe(status.parentElement)
    expect(impact).toHaveClass("col-start-1", "row-start-1")
    expect(status).toHaveClass("col-start-1", "row-start-1")

    const satoOption = screen.getByRole("option", { name: /佐藤 花子/ })
    expect(within(satoOption).getByText("外せません")).toHaveAttribute(
      "title",
      "成績算出『期末』が使うため"
    )
    expect(satoOption).toHaveTextContent(
      "佐藤 花子 (1002)関連で入る外せません成績算出『期末』が使うため"
    )
  })

  describe("見出しの全選択", () => {
    const selectAllCheckbox = () =>
      screen.getByRole("checkbox", { name: "表示中の生徒を全て選ぶ" })

    it("一覧の外にあって Tab で届き、一部だけ入っているときは indeterminate", async () => {
      const user = userEvent.setup()
      renderCheckList()
      // 外せない行（鈴木）は数えない。山田だけが入り、佐藤が入っていない
      expect(selectAllCheckbox()).toHaveAttribute("aria-checked", "mixed")
      // 一部のときは横棒を描く（チェックの印ではない）
      expect(
        selectAllCheckbox().querySelector('svg[class*="lucide-minus"]')
      ).not.toBeNull()
      expect(
        selectAllCheckbox().querySelector('svg[class*="lucide-check"]')
      ).toBeNull()
      expect(
        within(screen.getByRole("listbox")).queryByRole("checkbox")
      ).not.toBeInTheDocument()
      await user.tab()
      expect(selectAllCheckbox()).toHaveFocus()
    })

    it("全部選ぶ → 全部外す。外せない行は渡さない", async () => {
      const user = userEvent.setup()
      const { handleCheckedChangeMany } = renderCheckList()

      await user.click(selectAllCheckbox())
      expect(handleCheckedChangeMany).toHaveBeenLastCalledWith(
        ["a1b2c3d4-0002"],
        true
      )
      expect(selectAllCheckbox()).toHaveAttribute("aria-checked", "true")
      expect(
        selectAllCheckbox().querySelector('svg[class*="lucide-check"]')
      ).not.toBeNull()

      await user.click(selectAllCheckbox())
      expect(handleCheckedChangeMany).toHaveBeenLastCalledWith(
        ["a1b2c3d4-0001", "a1b2c3d4-0002"],
        false
      )
      expect(selectAllCheckbox()).toHaveAttribute("aria-checked", "false")
    })

    it("検索で絞っているときは、見えている行だけに効く", async () => {
      const user = userEvent.setup()
      const { handleCheckedChangeMany } = renderCheckList()

      await user.type(screen.getByPlaceholderText("氏名で検索"), "さとう")
      expect(selectAllCheckbox()).toHaveAttribute("aria-checked", "false")
      await user.click(selectAllCheckbox())
      expect(handleCheckedChangeMany).toHaveBeenLastCalledWith(
        ["a1b2c3d4-0002"],
        true
      )

      await user.clear(screen.getByPlaceholderText("氏名で検索"))
      await user.type(screen.getByPlaceholderText("氏名で検索"), "やまだ")
      await user.click(selectAllCheckbox())
      expect(handleCheckedChangeMany).toHaveBeenLastCalledWith(
        ["a1b2c3d4-0001"],
        false
      )
    })

    it("見えている行が外せない行だけなら、押せない", async () => {
      const user = userEvent.setup()
      renderCheckList()
      await user.type(screen.getByPlaceholderText("氏名で検索"), "すずき")
      expect(selectAllCheckbox()).toBeDisabled()
    })
  })

  it("赤枠の行は、読み上げに添えた文言で伝える", () => {
    render(
      <ComboboxCheckList
        options={[
          { ...studentOptions[0], warningText: "外すと一緒に外れます" },
          studentOptions[1],
        ]}
        onCheckedChange={vi.fn()}
        searchPlaceholder="氏名で検索"
        emptyText="該当する生徒がいません"
        aria-label="生徒の一覧"
      />
    )
    expect(
      screen.getByRole("option", { name: /山田 太郎.*外すと一緒に外れます/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "佐藤 花子 (1002)" })
    ).toBeInTheDocument()
  })
})
