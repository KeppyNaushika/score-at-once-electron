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
  keySceneOf,
  resolveKeyBindings,
  sceneWhen,
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

  it("選択の場面のキーは、採点中・部分点の入力欄のキーと重ねられる", () => {
    // 数字は採点中は部分点の入力、入力欄の中は数字の入力、選択の場面は項目の番号
    expect(canShareKey("choice.select1", "scoring.openPartialWith1")).toBe(true)
    expect(canShareKey("choice.select1", "modal.input1")).toBe(true)
    // ↑↓ は採点中は生徒の移動、選択の場面は項目の移動
    expect(canShareKey("choice.prev", "navigation.prevStudentArrow")).toBe(true)
    // Esc は入力欄を閉じる・選択の場面を抜ける
    expect(canShareKey("choice.exit", "modal.cancel")).toBe(true)
    // 英字の採点キーは AI の問いかけの選択の場面でも効くので、場面のキーとは重ねない
    expect(canShareKey("choice.select1", "scoring.partial")).toBe(false)
    expect(canShareKey("choice.nextQuestion", "scoring.correct")).toBe(false)
    // 数字は、ルーブリックでは項目の番号、AI の問いかけでは部分点（画面が分かれている）
    expect(canShareKey("choice.select1", "scoring.openPartialWith1")).toBe(true)
    expect(canShareKey("choice.other", "scoring.openPartialWith0")).toBe(true)
    // 場面に入るキーは採点中のキーなので、採点中のキーとは重ねない
    expect(canShareKey("choice.open", "scoring.correct")).toBe(false)
    expect(keySceneOf("choice.open")).toBe("scoring")
    expect(keySceneOf("choice.confirm")).toBe("choice")
  })

  it("問いかけの移りは Ctrl/⌘+Enter（次へ）と Ctrl/⌘+Shift+Enter（前へ）で、素の Enter とは別", () => {
    expect(DEFAULT_KEYBINDINGS["choice.confirm"]).toBe("Enter")
    expect(DEFAULT_KEYBINDINGS["choice.nextQuestion"]).toBe("Ctrl+Enter")
    expect(DEFAULT_KEYBINDINGS["choice.prevQuestion"]).toBe("Ctrl+Shift+Enter")
    expect(keySceneOf("choice.nextQuestion")).toBe("choice")
  })

  it("問いかけの移りだけは、問いかけの場面（選択の場面の外・入力欄の中でも。ダイアログを除く）にも登録できる", () => {
    expect(sceneWhen("choice.nextQuestion", { scene: "questioning" })).toBe(
      "!modalOpen && !textEditorActive"
    )
    expect(sceneWhen("choice.prevQuestion", { scene: "questioning" })).toBe(
      "!modalOpen && !textEditorActive"
    )
    expect(() =>
      sceneWhen("choice.confirm", { scene: "questioning" })
    ).toThrow()
    expect(() =>
      sceneWhen("scoring.correct", { scene: "questioning" })
    ).toThrow()
    // 採点中にも選択の場面にもまたがって効くので、どちらの場面のキーとも重ねない
    expect(canShareKey("choice.nextQuestion", "navigation.nextQuestion")).toBe(
      false
    )
    expect(canShareKey("choice.prevQuestion", "choice.confirm")).toBe(false)
    expect(
      canShareKey("navigation.prevStudentArrow", "choice.nextQuestion")
    ).toBe(false)
    // 部分点の入力欄の中だけのキーとは重ねてよい（入力欄を開いている間は効かない）
    expect(canShareKey("choice.nextQuestion", "modal.input1")).toBe(true)
  })

  it("選択の場面にも登録できるのは、そう決めた採点キーだけ", () => {
    expect(sceneWhen("scoring.correct", { scene: "choice" })).toContain(
      "choiceSceneOpen &&"
    )
    expect(
      sceneWhen("scoring.openPartialWith1", { scene: "choice" })
    ).toContain("choiceSceneOpen &&")
    expect(() => sceneWhen("scoring.comment", { scene: "choice" })).toThrow()
    expect(() => sceneWhen("filter.refresh", { scene: "choice" })).toThrow()
  })

  it("効く場面は既定の置き場所で決まり、名前の付け方からは推し量らない", () => {
    expect(keySceneOf("modal.input0")).toBe("partialInput")
    expect(keySceneOf("modal.cancel")).toBe("partialInput")
    expect(keySceneOf("scoring.partial")).toBe("both")
    expect(keySceneOf("scoring.pending")).toBe("both")
    expect(keySceneOf("scoring.correct")).toBe("scoring")
    expect(keySceneOf("tool.text")).toBe("scoring")
  })

  it("when 句は場面の土台に登録ごとの条件をつなぐ", () => {
    expect(
      sceneWhen("scoring.correct", { condition: "hasSelectedAnswers" })
    ).toBe(
      "!inputFocus && !modalOpen && !textEditorActive && !choiceSceneOpen && hasSelectedAnswers"
    )
    expect(sceneWhen("choice.select1")).toBe(
      "choiceSceneOpen && !inputFocus && !modalOpen && !textEditorActive"
    )
    expect(sceneWhen("modal.input1")).toBe("partialScoreModalOpen")
    expect(sceneWhen("scoring.partial", { scene: "partialInput" })).toBe(
      "partialScoreModalOpen"
    )
  })

  it("場面の食い違う登録は誤りとして投げる", () => {
    // 両方の場面で効くコマンドは、登録ごとに場面を選ばせる
    expect(() => sceneWhen("scoring.partial")).toThrow()
    // 入力欄の中だけのコマンドを、採点中の場面へ登録しない
    expect(() => sceneWhen("modal.input1", { scene: "scoring" })).toThrow()
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
