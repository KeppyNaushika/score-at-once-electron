/**
 * 採点画面のキー割り当ての固定。
 *
 * - 既定どうしが同じ場面で重ならない（重なると when 句の && の数と登録順で片方だけが
 *   勝ち、もう片方が黙って効かなくなる。0 がズームリセットと部分点の入力で重なっていた）
 * - 保存済みの割り当ては既定に重ねるだけ（旧既定の読み替えはマイグレーション
 *   20261002120000 が DB の側で1回だけ行った。`dropDefaultKeyboardShortcuts.test.ts`）
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
} from "@/lib/scoringKeybindings"
import {
  formatKeyForDisplay,
  SHORTCUT_CATEGORIES,
  SHORTCUT_LABELS,
} from "@/lib/shortcutCatalog"
import { SCORING_STATUSES } from "@/types/scoringStatus.types"

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

  it("保存済みの割り当ては、そのコマンドだけ既定を上書きする", () => {
    const resolved = resolveKeyBindings({ "scoring.correct": "i" })
    expect(resolved).toEqual({ ...DEFAULT_KEYBINDINGS, "scoring.correct": "i" })
  })

  it("旧既定の値でも読み替えない（読み替えはマイグレーションが済ませた）", () => {
    const resolved = resolveKeyBindings({ "scoring.doubleMark": "t" })
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
