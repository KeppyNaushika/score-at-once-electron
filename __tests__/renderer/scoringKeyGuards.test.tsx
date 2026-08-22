// @vitest-environment jsdom
/**
 * 採点画面（07）のキーが「黙って効かなくなる／黙って効いてしまう」ことの検査。
 *
 * 07 はキーボード操作を最優先に設計した画面なので、キーの生死は機能そのもの。
 * 目で見て気づけない壊れ方をするため、3つの型を固定する。
 *
 * 1. **戻る。** 入力欄からフォーカスが `body` へ抜けたら、採点キーはまた効く。
 *    `ShortcutProvider` が `focusout` を `focusin` と同じ処理へ通していた頃は、
 *    離れる側（＝入力欄）を見て `inputFocus` を true のまま据え置き、次に入力欄以外が
 *    フォーカスを取るまで戻らなかった。入力欄をクリックしたあと画面の余白をクリック
 *    する、という普通の操作で採点キーが死ぬ。
 * 2. **行き過ぎない。** `focusout` は `focusin` より先に発火するので、入力欄から別の
 *    入力欄へ移る途中で一度 false へ倒すと、その隙間に届いたキーが採点として通る。
 * 3. **素通しを作らない。** `ShortcutProvider` のコマンド表を通らない直の購読
 *    （`Alt+-` / `Alt+=` / 模範解答の keyup）も、表と同じ入力欄ガードを持つ。
 * 4. **割当に従う。** 表を通らない購読も、キーは表と同じ源から引く。模範解答を離す
 *    キーが直書きだった頃は、割当を変えた利用者が押せても離せなくなった。
 *
 * 加えて、`when` 句が読んでいるコンテキストに**書き手が居ること**を検査する
 * （`textEditorActive` は読み手だけ 21 箇所あって書き手が0だった＝条件として死んでいた）。
 */

import "./setup"

import * as fs from "node:fs"
import * as path from "node:path"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_KEYBINDINGS } from "@/components/exams/07-score-at-once/constants/scoringKeybindings"
import { useCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { useGridNavigation } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridNavigation"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useMasterAnswerHoldRelease } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerHoldRelease"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../helpers/queryWrapper"

const currentUser: PublicUser = {
  id: "user-1",
  username: "testuser",
  name: "テストユーザー",
  role: "admin",
  passcodeType: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

/** グリッドの1行あたり表示件数の初期値（毎レンダー作り直さないよう定数で持つ） */
const INITIAL_ITEMS_PER_ROW = [5]

/** 採点キーが1回発火したことの記録 */
const scoreCorrect = vi.fn()
/** 模範解答を隠す指示が来たことの記録 */
const hideMasterAnswer = vi.fn()
/** DB に保存された「利用者が変えた割当」を返す口 */
const getUserKeyboardShortcuts = vi.fn()

/**
 * 07 の3種類のキー購読を1つに載せた見本。
 *
 * - `scoring.correct`: コマンド表を通る採点キー（`when` 句がガード）
 * - `Alt+-` / `Alt+=`: 表を通らない直の購読（`useGridNavigation`）
 * - 模範解答の keyup: 表を通らない直の購読（`useMasterAnswerHoldRelease`）
 */
function KeySubscriptions() {
  useContextValue("hasSelectedAnswers", true)

  // 割当は DB から非同期に届く。届く前に打つと既定値を試すだけになるので、
  // テストから「いま何が割り当たっているか」を見えるようにしておく
  const { keyBindings } = useShortcutContext()

  useCommand("scoring.correct", scoreCorrect, {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
  })

  const { itemsPerRow } = useGridNavigation({
    externalItemsPerRow: INITIAL_ITEMS_PER_ROW,
  })

  useMasterAnswerHoldRelease({
    masterAnswerKeyBehavior: "hold-to-show",
    gradingMode: "individual",
    onRelease: hideMasterAnswer,
  })

  return (
    <>
      <textarea data-testid="comment-field" />
      <input data-testid="other-field" />
      <button type="button" data-testid="plain-button">
        入力欄ではない何か
      </button>
      <span data-testid="items-per-row">{itemsPerRow[0]}</span>
      <span data-testid="master-answer-key">
        {keyBindings["view.toggleMasterAnswer"]}
      </span>
    </>
  )
}

/**
 * @param storedKeyBindings 利用者が設定で変えた割当（DB に入っている分）
 */
async function renderScoringKeys(
  storedKeyBindings: Record<string, string> = {}
) {
  getUserKeyboardShortcuts.mockResolvedValue(storedKeyBindings)

  const QueryWrapper = createQueryWrapper()
  render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>
          <KeySubscriptions />
        </ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
  // キー割当の取得（非同期）と、コマンド登録・コンテキスト反映の effect を落ち着かせる
  await act(async () => {
    await Promise.resolve()
  })
  // 変えた割当が画面へ届くまで待つ。待たずに打つと既定値のままを試してしまい、
  // 「変えたキーで離せる」検査が検査にならない
  await waitFor(() => {
    expect(masterAnswerKeyText()).toBe(
      storedKeyBindings["view.toggleMasterAnswer"] ??
        DEFAULT_KEYBINDINGS["view.toggleMasterAnswer"]
    )
  })
}

function commentField() {
  return screen.getByTestId("comment-field")
}

function otherField() {
  return screen.getByTestId("other-field")
}

function itemsPerRowText() {
  return screen.getByTestId("items-per-row").textContent
}

function masterAnswerKeyText() {
  return screen.getByTestId("master-answer-key").textContent
}

beforeEach(() => {
  scoreCorrect.mockReset()
  hideMasterAnswer.mockReset()
  getUserKeyboardShortcuts.mockReset()
  getUserKeyboardShortcuts.mockResolvedValue({})
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: {
        getUserKeyboardShortcuts,
        saveUserKeyboardShortcuts: vi.fn().mockResolvedValue(undefined),
        resetUserKeyboardShortcuts: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  })
})

describe("入力欄を離れたあとの採点キー", () => {
  it("フォーカスが body へ抜けたら、採点キーがまた効く", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())
    // 入力欄に居る間は採点キーは死んでいる（打った文字が採点にならない）
    fireEvent.keyDown(document.body, { key: "e" })
    expect(scoreCorrect).not.toHaveBeenCalled()

    // 画面の余白をクリックした、に相当。次に入る要素は無い
    act(() => commentField().blur())

    fireEvent.keyDown(document.body, { key: "e" })
    expect(scoreCorrect).toHaveBeenCalledTimes(1)
  })

  it("入力欄以外がフォーカスを取った場合も、採点キーが戻る", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())
    act(() => screen.getByTestId("plain-button").focus())

    fireEvent.keyDown(document.body, { key: "e" })
    expect(scoreCorrect).toHaveBeenCalledTimes(1)
  })

  it("入力欄から別の入力欄へ移る間に、採点キーが暴発しない", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())

    // `focusout` は `focusin` より先に発火する。その隙間に届いたキーを見たいので、
    // 2つの出来事を分けて起こす（実ブラウザでは同じ処理の中で連続して起きる）
    act(() => {
      commentField().dispatchEvent(
        new FocusEvent("focusout", {
          bubbles: true,
          relatedTarget: otherField(),
        })
      )
    })

    fireEvent.keyDown(document.body, { key: "e" })
    expect(scoreCorrect).not.toHaveBeenCalled()

    // 続きの `focusin` が来ても、当然まだ入力中
    act(() => otherField().focus())
    fireEvent.keyDown(document.body, { key: "e" })
    expect(scoreCorrect).not.toHaveBeenCalled()
  })

  it("入力欄から別の入力欄へ実際に移っても、採点キーは死んだまま", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())
    act(() => otherField().focus())

    fireEvent.keyDown(document.body, { key: "e" })
    expect(scoreCorrect).not.toHaveBeenCalled()
  })
})

describe("コマンド表を通らないキーの入力欄ガード", () => {
  it("入力欄に居る間は Alt+- / Alt+= で表示数が動かない", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())

    fireEvent.keyDown(commentField(), { key: "=", altKey: true })
    expect(itemsPerRowText()).toBe("5")

    fireEvent.keyDown(commentField(), { key: "-", altKey: true })
    expect(itemsPerRowText()).toBe("5")
  })

  it("入力欄を離れれば Alt+- / Alt+= は効く", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())
    act(() => commentField().blur())

    fireEvent.keyDown(document.body, { key: "=", altKey: true })
    expect(itemsPerRowText()).toBe("6")

    fireEvent.keyDown(document.body, { key: "-", altKey: true })
    expect(itemsPerRowText()).toBe("5")
  })

  it("入力欄に居る間は x の keyup で模範解答が隠れない", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())

    fireEvent.keyUp(commentField(), { key: "x" })
    expect(hideMasterAnswer).not.toHaveBeenCalled()
  })

  it("入力欄を離れれば x の keyup は効く", async () => {
    await renderScoringKeys()

    act(() => commentField().focus())
    act(() => commentField().blur())

    fireEvent.keyUp(document.body, { key: "x" })
    expect(hideMasterAnswer).toHaveBeenCalledTimes(1)
  })
})

/**
 * 模範解答の「押している間だけ見せる」は、押す側と離す側で別の購読になっている。
 * 離す側がキーを直書きしていた頃は、割当を変えた利用者が押せても離せなくなり、
 * 模範解答が出たまま固まった（「押している間だけ」が「一度押したら消えない」に化ける）。
 * 押す側と同じ源（`ShortcutProvider` の `keyBindings`）を読んでいることを固定する。
 */
describe("模範解答を離すキーは割当に従う", () => {
  it("割当が既定のままなら x で離せる", async () => {
    await renderScoringKeys()

    fireEvent.keyUp(document.body, { key: "x" })
    expect(hideMasterAnswer).toHaveBeenCalledTimes(1)
  })

  it("割当を m に変えたら m で離せる", async () => {
    await renderScoringKeys({ "view.toggleMasterAnswer": "m" })

    fireEvent.keyUp(document.body, { key: "m" })
    expect(hideMasterAnswer).toHaveBeenCalledTimes(1)
  })

  it("割当を m に変えたら、既定の x では離れない", async () => {
    // これが無いと「両方受け付ける」実装（既定を残したまま割当も見る）で通ってしまう
    await renderScoringKeys({ "view.toggleMasterAnswer": "m" })

    fireEvent.keyUp(document.body, { key: "x" })
    expect(hideMasterAnswer).not.toHaveBeenCalled()
  })
})

// =====================================================================
// when 句のコンテキストに書き手が居ること
// =====================================================================

const SCORING_DIRECTORY = path.join(
  process.cwd(),
  "src/components/exams/07-score-at-once"
)

/** 07 配下の .ts / .tsx を全部読む */
function readScoringSources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return readScoringSources(entryPath)
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) return []
    return [fs.readFileSync(entryPath, "utf-8")]
  })
}

describe("when 句が読むコンテキストには書き手が居る", () => {
  it("読み手だけで書き手が居ないキーがない", () => {
    const sources = readScoringSources(SCORING_DIRECTORY)
    const allSource = sources.join("\n")

    // `when:` の行に現れる語を集める。式が `'grid'` のような文字列リテラルや
    // `${kbOnly}` の差し込みを含むので、括りを解かず行ごと拾って語に割る
    const readKeys = new Set<string>()
    for (const match of allSource.matchAll(/when:\s*(.+)$/gm)) {
      for (const identifier of match[1].matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
        readKeys.add(identifier[0])
      }
    }
    // 集めた語には `true` や比較対象の値も混ざるので、状態のキーだけに絞る
    const contextKeys = [
      "inputFocus",
      "textEditorActive",
      "gradingMode",
      "modalOpen",
      "partialScoreModalOpen",
      "sidePanelVisible",
      "hasSelectedAnswers",
      "scoringOperationMode",
    ]

    const readWithoutWriter = contextKeys
      .filter((key) => readKeys.has(key))
      .filter(
        (key) =>
          !allSource.includes(`setContextValue("${key}"`) &&
          !allSource.includes(`useContextValue("${key}"`)
      )

    expect(readWithoutWriter).toEqual([])
  })
})
