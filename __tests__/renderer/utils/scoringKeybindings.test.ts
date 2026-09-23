/**
 * 採点画面のキー割り当ての固定。
 *
 * - 既定どうしが同じ場面で重ならない（重なると when 句の && の数と登録順で片方だけが
 *   勝ち、もう片方が黙って効かなくなる。0 がズームリセットと部分点の入力で重なっていた）
 * - 既定を変える前に保存された割り当て（設定画面は1つ変えると全部を保存する）のうち、
 *   重なって使えなくなったものだけが新しい既定へ移る
 * - 設定画面・キーボード一覧・キーが重なったときの案内に、内部の名前が出ない
 */
import { describe, expect, it } from "vitest"

import {
  canShareKey,
  DEFAULT_KEYBINDINGS,
  filterCommandIdOf,
  findConflictingCommand,
  resolveKeyBindings,
  scoringCommandIdOf,
} from "@/components/exams/07-score-at-once/constants/scoringKeybindings"
import {
  formatKeyForDisplay,
  SHORTCUT_CATEGORIES,
  SHORTCUT_LABELS,
} from "@/components/exams/07-score-at-once/constants/shortcutCatalog"
import { SCORING_STATUSES } from "@/types/scoringStatus.types"

/** 旧既定のまま全部を保存した利用者の割り当て（W マーク t・ズームリセット 0 の頃） */
const LEGACY_SNAPSHOT = {
  ...DEFAULT_KEYBINDINGS,
  "scoring.doubleMark": "t",
  "filter.toggleDoubleMark": "Alt+t",
  "navigation.resetZoom": "0",
}

describe("既定のキー割り当て", () => {
  it("同じ場面で効くコマンドどうしが同じキーを使っていない", () => {
    const commandIds = Object.keys(DEFAULT_KEYBINDINGS)
    const conflicts = commandIds.flatMap((commandId) => {
      const other = findConflictingCommand(
        DEFAULT_KEYBINDINGS,
        commandId,
        DEFAULT_KEYBINDINGS[commandId]
      )
      return other ? [`${commandId} と ${other}`] : []
    })
    expect(conflicts).toEqual([])
  })

  it("部分点の入力欄の中だけ／外だけのコマンドは同じキーを使える", () => {
    expect(canShareKey("modal.input0", "scoring.openPartialWith0")).toBe(true)
    // 部分点・保留は入力欄の中でも確定キーとして効く
    expect(canShareKey("modal.cancel", "scoring.partial")).toBe(false)
    expect(
      canShareKey("navigation.resetZoom", "scoring.openPartialWith0")
    ).toBe(false)
  })

  it("全コマンドに表示名があり、設定画面の分類は実在するコマンドだけを指す", () => {
    for (const commandId of Object.keys(DEFAULT_KEYBINDINGS)) {
      expect(SHORTCUT_LABELS[commandId], commandId).toBeTruthy()
    }
    for (const category of Object.values(SHORTCUT_CATEGORIES)) {
      for (const commandId of category.keys) {
        expect(DEFAULT_KEYBINDINGS[commandId], commandId).toBeDefined()
      }
    }
  })

  it("採点状態からコマンドを引ける（no_answer / double_mark を含む）", () => {
    for (const status of SCORING_STATUSES) {
      expect(
        DEFAULT_KEYBINDINGS[scoringCommandIdOf(status)],
        status
      ).toBeDefined()
      expect(
        DEFAULT_KEYBINDINGS[filterCommandIdOf(status)],
        status
      ).toBeDefined()
    }
    expect(scoringCommandIdOf("double_mark")).toBe("scoring.doubleMark")
    expect(filterCommandIdOf("no_answer")).toBe("filter.toggleNoAnswer")
  })
})

describe("resolveKeyBindings", () => {
  it("何も保存していなければ既定そのもの", () => {
    expect(resolveKeyBindings(undefined)).toEqual(DEFAULT_KEYBINDINGS)
    expect(resolveKeyBindings({})).toEqual(DEFAULT_KEYBINDINGS)
  })

  it("旧既定のまま重なっている割り当ては新しい既定へ移す", () => {
    const resolved = resolveKeyBindings(LEGACY_SNAPSHOT)
    expect(resolved["scoring.doubleMark"]).toBe(
      DEFAULT_KEYBINDINGS["scoring.doubleMark"]
    )
    expect(resolved["filter.toggleDoubleMark"]).toBe(
      DEFAULT_KEYBINDINGS["filter.toggleDoubleMark"]
    )
    expect(resolved["navigation.resetZoom"]).toBe(
      DEFAULT_KEYBINDINGS["navigation.resetZoom"]
    )
    // 相手の側はそのまま
    expect(resolved["tool.text"]).toBe("t")
    expect(resolved["scoring.openPartialWith0"]).toBe("0")
  })

  it("重なっていなければ、旧既定のキーでも利用者の割り当てとして残す", () => {
    const resolved = resolveKeyBindings({
      ...LEGACY_SNAPSHOT,
      // 利用者がテキストツールを別のキーへ移していた
      "tool.text": "i",
    })
    expect(resolved["scoring.doubleMark"]).toBe("t")
    expect(resolved["filter.toggleDoubleMark"]).toBe("Alt+t")
  })

  it("W マークだけ移し、利用者が自分で変えたフィルタのキーは残す", () => {
    const resolved = resolveKeyBindings({
      ...LEGACY_SNAPSHOT,
      "filter.toggleDoubleMark": "Alt+w",
    })
    expect(resolved["scoring.doubleMark"]).toBe(
      DEFAULT_KEYBINDINGS["scoring.doubleMark"]
    )
    expect(resolved["filter.toggleDoubleMark"]).toBe("Alt+w")
  })

  it("移す先の既定キーを別のコマンドが使っていれば移さない（別の重なりを作らない）", () => {
    const resolved = resolveKeyBindings({
      ...LEGACY_SNAPSHOT,
      "scoring.correct": DEFAULT_KEYBINDINGS["scoring.doubleMark"],
    })
    expect(resolved["scoring.doubleMark"]).toBe("t")
  })
})

describe("formatKeyForDisplay", () => {
  it("修飾キーは環境の呼び名に、1文字は大文字に、矢印は記号にする", () => {
    expect(formatKeyForDisplay("Alt+u", "Option")).toBe("Option+U")
    expect(formatKeyForDisplay("Shift+d", "Alt")).toBe("Shift+D")
    expect(formatKeyForDisplay("ArrowUp", "Alt")).toBe("↑")
    expect(formatKeyForDisplay("Escape", "Alt")).toBe("Esc")
    expect(formatKeyForDisplay("Shift++", "Alt")).toBe("Shift++")
    expect(formatKeyForDisplay(undefined, "Alt")).toBe("未設定")
  })
})
