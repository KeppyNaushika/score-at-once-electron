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
import ts from "typescript"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { useGridNavigation } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridNavigation"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useMasterAnswerHoldRelease } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useMasterAnswerHoldRelease"
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { Checkbox } from "@/components/ui/checkbox"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import { DEFAULT_KEYBINDINGS } from "@/lib/scoringKeybindings"
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
        setUserKeyboardShortcut: vi.fn().mockResolvedValue(undefined),
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

  /**
   * 修飾キー付きの割当（`Shift+d` は既定にもある形）では、keyup が修飾キーと本体に
   * 割れて飛ぶ。Shift を先に離せば届くのは `"shift"` と `"d"` だけで、`"Shift+d"` は
   * 一度も現れない。離す側が修飾キー込みで突き合わせていた頃は、これで模範解答が
   * 出たまま固まった（押せても離せない）。
   */
  describe("修飾キー付きの割当", () => {
    it("Shift を押したまま本体を離しても離せる", async () => {
      await renderScoringKeys({ "view.toggleMasterAnswer": "Shift+d" })

      fireEvent.keyUp(document.body, { key: "D", shiftKey: true })
      expect(hideMasterAnswer).toHaveBeenCalledTimes(1)
    })

    it("Shift を先に離してから本体を離しても離せる", async () => {
      await renderScoringKeys({ "view.toggleMasterAnswer": "Shift+d" })

      // 実際の順序。Shift 単独の keyup は本体ではないので何も起きない
      fireEvent.keyUp(document.body, { key: "Shift" })
      expect(hideMasterAnswer).not.toHaveBeenCalled()

      fireEvent.keyUp(document.body, { key: "d" })
      expect(hideMasterAnswer).toHaveBeenCalledTimes(1)
    })

    it("割当が Shift+d でも、関係ないキーでは離れない", async () => {
      await renderScoringKeys({ "view.toggleMasterAnswer": "Shift+d" })

      fireEvent.keyUp(document.body, { key: "x" })
      expect(hideMasterAnswer).not.toHaveBeenCalled()
    })
  })
})

// =====================================================================
// when 句のコンテキストに書き手が居ること
// =====================================================================

/**
 * when 句を書く場所。07 の画面に加えて、場面ごとの土台（`sceneWhen` の `SCENE_WHEN`）を
 * 持つ `scoringKeybindings.ts` を読む。土台を外すと `textEditorActive`・`choiceSceneOpen`・
 * `partialScoreModalOpen` を読んでいることが見えず、検査が空回りする（以前は 07 の
 * `when:` 行だけを読んでいて、拾えていたのは `useCommand.ts` の**註釈**だけだった）
 */
const WHEN_SOURCE_ROOTS = [
  path.join(process.cwd(), "src/components/exams/07-score-at-once"),
  path.join(process.cwd(), "src/lib/scoringKeybindings.ts"),
]

/** .ts / .tsx を全部集める（ファイルを渡せばそれだけ） */
function collectWhenSourceFiles(entryPath: string): string[] {
  if (!fs.statSync(entryPath).isDirectory()) return [entryPath]
  return fs
    .readdirSync(entryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const childPath = path.join(entryPath, entry.name)
      if (entry.isDirectory()) return collectWhenSourceFiles(childPath)
      return /\.tsx?$/.test(entry.name) ? [childPath] : []
    })
}

/** 演算子を含む文字列は、どこに書いてあっても when 句の式とみなす */
const WHEN_OPERATOR = /&&|\|\||[!=]=|^\s*!/
/** when 句の式に現れる文字だけでできている（文言や id を拾わない） */
const WHEN_EXPRESSION = /^[\sA-Za-z0-9_!&|=()']*$/

/**
 * 演算子の無い文字列（`"partialScoreModalOpen"` のような単独のキー）を when 句と
 * みなす置き場所: `when:` / `condition:` の値、名前が when / condition で終わる変数、
 * 名前が when で終わる変数の表（`SCENE_WHEN`）の値。三項演算子の枝も含む
 */
function isInWhenSlot(node: ts.Node): boolean {
  let current = node
  while (
    current.parent &&
    (ts.isConditionalExpression(current.parent) ||
      ts.isParenthesizedExpression(current.parent))
  ) {
    current = current.parent
  }
  const parent = current.parent
  if (!parent) return false
  if (ts.isPropertyAssignment(parent)) {
    if (/^(when|condition)$/.test(parent.name.getText())) return true
    const table = parent.parent.parent
    return (
      ts.isObjectLiteralExpression(parent.parent) &&
      ts.isVariableDeclaration(table) &&
      /when$/i.test(table.name.getText())
    )
  }
  return (
    ts.isVariableDeclaration(parent) &&
    /(when|condition)$/i.test(parent.name.getText())
  )
}

/** when 句が読むキーと、`setContextValue` / `useContextValue` で書くキー */
function scanContextKeys() {
  const readKeys = new Set<string>()
  const writtenKeys = new Set<string>()
  const sourceFiles = WHEN_SOURCE_ROOTS.flatMap(collectWhenSourceFiles)

  for (const filePath of sourceFiles) {
    const source = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, "utf-8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const visit = (node: ts.Node) => {
      const texts =
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          ? [node.text]
          : ts.isTemplateExpression(node)
            ? [
                node.head.text,
                ...node.templateSpans.map((span) => span.literal.text),
              ]
            : []
      if (texts.length > 0) {
        const inWhenSlot = isInWhenSlot(node)
        for (const text of texts) {
          if (!WHEN_EXPRESSION.test(text)) continue
          if (!inWhenSlot && !WHEN_OPERATOR.test(text)) continue
          // `gradingMode == 'grid'` の比較対象（引用符の中）はキーではない
          const unquoted = text.replace(/'[^']*'/g, "")
          for (const identifier of unquoted.matchAll(/[A-Za-z_]\w*/g)) {
            if (identifier[0] === "true" || identifier[0] === "false") continue
            readKeys.add(identifier[0])
          }
        }
      }
      if (
        ts.isCallExpression(node) &&
        /(^|\.)(set|use)ContextValue$/.test(node.expression.getText()) &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        writtenKeys.add(node.arguments[0].text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return { readKeys, writtenKeys }
}

describe("when 句が読むコンテキストには書き手が居る", () => {
  const { readKeys, writtenKeys } = scanContextKeys()

  it("走査そのものが機能している（場面の土台が読むキーを拾えている）", () => {
    expect([...readKeys]).toEqual(
      expect.arrayContaining([
        "inputFocus",
        "modalOpen",
        "textEditorActive",
        "choiceSceneOpen",
        "partialScoreModalOpen",
        "hasSelectedAnswers",
        "gradingMode",
      ])
    )
  })

  it("読み手だけで書き手が居ないキーがない", () => {
    const readWithoutWriter = [...readKeys].filter(
      (key) => !writtenKeys.has(key)
    )

    expect(readWithoutWriter).toEqual([])
  })
})

// =====================================================================
// テキスト編集モーダルが開いている間は、裏の画面のキーが効かない
// =====================================================================

/** 裏の画面で「設問を移る」「表示を切り替える」「採点する」が起きたことの記録 */
const moveToNextQuestion = vi.fn()
const toggleViewMode = vi.fn()
const scoreSelectedAnswers = vi.fn()

/**
 * 07 の本物のコマンド表（`useScoringShortcuts`）を載せ、テキスト編集モーダルの
 * チェックボックス（`ui/checkbox` ＝ button）にフォーカスを置いた状態を作る。
 *
 * button は入力欄ではないので `inputFocus` は false のまま。止められるのは
 * `textEditorActive` だけ、という状況そのもの。
 */
function ScoringShortcutsWithTextEditor({
  textEditorActive,
}: {
  textEditorActive: boolean
}) {
  useContextValue("hasSelectedAnswers", true)
  useContextValue("gradingMode", "individual")
  useContextValue("textEditorActive", textEditorActive)

  useScoringShortcuts({
    handleToggleStudentNames: vi.fn(),
    handleRefreshFilter: vi.fn(),
    handleNextQuestion: moveToNextQuestion,
    handlePrevQuestion: vi.fn(),
    handleGridNavigation: vi.fn(),
    handleIndividualNavigation: vi.fn(),
    handleZoomIn: vi.fn(),
    handleZoomOut: vi.fn(),
    handleResetZoom: vi.fn(),
    handlePartialScoreInput: vi.fn(),
    handlePartialScoreConfirmPartial: vi.fn(),
    handlePartialScoreConfirmPending: vi.fn(),
    handlePartialScoreCancel: vi.fn(),
    handlePartialScoreBackspace: vi.fn(),
    handleScore: scoreSelectedAnswers,
    handleToggleFilter: vi.fn(),
    handleSelectAll: vi.fn(),
    handleToggleViewMode: toggleViewMode,
  })

  return <Checkbox data-testid="show-background" />
}

async function renderScoringShortcuts(textEditorActive: boolean) {
  const QueryWrapper = createQueryWrapper()
  render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>
          <ScoringShortcutsWithTextEditor textEditorActive={textEditorActive} />
        </ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
  await act(async () => {
    await Promise.resolve()
  })
  act(() => screen.getByTestId("show-background").focus())
}

describe("テキスト編集モーダルのチェックボックスにフォーカスがあるとき", () => {
  beforeEach(() => {
    moveToNextQuestion.mockReset()
    toggleViewMode.mockReset()
    scoreSelectedAnswers.mockReset()
  })

  it("モーダルが開いていれば、矢印キー・表示切替・採点キーは効かない", async () => {
    await renderScoringShortcuts(true)

    fireEvent.keyDown(document.body, { key: "ArrowRight" })
    fireEvent.keyDown(document.body, { key: "v" })
    fireEvent.keyDown(document.body, { key: "e" })

    expect(moveToNextQuestion).not.toHaveBeenCalled()
    expect(toggleViewMode).not.toHaveBeenCalled()
    expect(scoreSelectedAnswers).not.toHaveBeenCalled()
  })

  it("モーダルが閉じていれば、同じキーは効く（button へのフォーカスでは止まらない）", async () => {
    await renderScoringShortcuts(false)

    fireEvent.keyDown(document.body, { key: "ArrowRight" })
    fireEvent.keyDown(document.body, { key: "v" })
    fireEvent.keyDown(document.body, { key: "e" })

    expect(moveToNextQuestion).toHaveBeenCalledTimes(1)
    expect(toggleViewMode).toHaveBeenCalledTimes(1)
    expect(scoreSelectedAnswers).toHaveBeenCalledWith("correct")
  })
})
