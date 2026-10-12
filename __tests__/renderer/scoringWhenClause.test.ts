/**
 * 採点画面（07・08）のショートカットの when 句の評価を固定する。
 *
 * when 句は以前 `new Function` で JavaScript の式として評価していた。CSP で画面の
 * `'unsafe-eval'` を外すため、閉じた文法で読んで評価する形（`whenClause.ts`）に変えた。
 * キーの生死は 07 の機能そのものなので、**実際に登録される when 句のすべてについて、
 * ありうるコンテキストの全組み合わせで、以前の評価（JavaScript の式）と同じ真偽になる**
 * ことを縛る。以前の評価の写しはこのテストの中にだけ置く（画面のコードには残さない）。
 */
import { describe, expect, it, vi } from "vitest"

import {
  evaluateWhenClause,
  parseWhenClause,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/whenClause"
import { KEYBOARD_ONLY_CONDITION } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/scoringShortcutConditions"
import type {
  GradingMode,
  ScoringContextState,
} from "@/components/exams/07-score-at-once/types"
import { DEFAULT_KEYBINDINGS, sceneWhen } from "@/lib/scoringKeybindings"
import { SCORING_OPERATION_MODES } from "@/lib/userPreferences"

const GRADING_MODES: readonly GradingMode[] = ["grid", "individual", "ai"]

const BOOLEAN_CONTEXT_KEYS = [
  "inputFocus",
  "textEditorActive",
  "modalOpen",
  "partialScoreModalOpen",
  "hasSelectedAnswers",
  "choiceSceneOpen",
  "aiQuestioningManual",
] as const satisfies readonly (keyof ScoringContextState)[]

/** 真偽のキー7つ × 採点モード3つ × 操作モード2つ = 768 通り */
function allContexts(): ScoringContextState[] {
  const booleanCombinations = Array.from(
    { length: 2 ** BOOLEAN_CONTEXT_KEYS.length },
    (_, combinationIndex) =>
      Object.fromEntries(
        BOOLEAN_CONTEXT_KEYS.map((contextKey, bitIndex) => [
          contextKey,
          (combinationIndex & (1 << bitIndex)) !== 0,
        ])
      )
  )
  return booleanCombinations.flatMap((booleans) =>
    GRADING_MODES.flatMap((gradingMode) =>
      SCORING_OPERATION_MODES.map(
        (scoringOperationMode): ScoringContextState => ({
          inputFocus: booleans.inputFocus === true,
          textEditorActive: booleans.textEditorActive === true,
          modalOpen: booleans.modalOpen === true,
          partialScoreModalOpen: booleans.partialScoreModalOpen === true,
          hasSelectedAnswers: booleans.hasSelectedAnswers === true,
          choiceSceneOpen: booleans.choiceSceneOpen === true,
          aiQuestioningManual: booleans.aiQuestioningManual === true,
          gradingMode,
          scoringOperationMode,
        })
      )
    )
  )
}

/** 以前の評価（`ShortcutProvider` が `new Function` で行っていたもの）の写し */
function evaluateAsJavaScript(
  when: string,
  context: ScoringContextState
): boolean {
  const evaluateWhen = new Function(
    "inputFocus",
    "textEditorActive",
    "gradingMode",
    "modalOpen",
    "partialScoreModalOpen",
    "hasSelectedAnswers",
    "scoringOperationMode",
    "choiceSceneOpen",
    "aiQuestioningManual",
    `return ${when}`
  )
  return Boolean(
    evaluateWhen(
      context.inputFocus,
      context.textEditorActive,
      context.gradingMode,
      context.modalOpen,
      context.partialScoreModalOpen,
      context.hasSelectedAnswers,
      context.scoringOperationMode,
      context.choiceSceneOpen,
      context.aiQuestioningManual
    )
  )
}

/**
 * 07・08 の登録が `sceneWhen` に渡している条件（`condition`）。
 * 07 の各 hook（`useScoringCommandShortcuts`・`useViewNavigationShortcuts`・
 * `useDrawingToolShortcuts`・`usePartialScoreShortcuts`・`useChoiceScene`・
 * `useQuestioningFlow`・`useQuestioningManualKeys`・`useAiGradingShortcuts`）と
 * 08（`useFinalizeShortcuts`・`SelectedCellDetail`）が書いている形
 */
const REGISTERED_CONDITIONS: readonly (string | undefined)[] = [
  undefined,
  "false",
  "hasSelectedAnswers",
  "gradingMode == 'individual'",
  "gradingMode == 'grid'",
  "gradingMode == 'ai'",
  `gradingMode == 'grid' && ${KEYBOARD_ONLY_CONDITION}`,
  `hasSelectedAnswers && ${KEYBOARD_ONLY_CONDITION}`,
  "gradingMode == 'ai' && aiQuestioningManual",
]

const REGISTRATION_SCENES = [
  undefined,
  "scoring",
  "partialInput",
  "choice",
  "questioning",
] as const

/** 実際に登録されうる when 句の全部（`useCommand` の既定の "true" を含む） */
function registeredWhenClauses(): string[] {
  const whenClauses = new Set<string>(["true"])
  for (const commandId of Object.keys(DEFAULT_KEYBINDINGS)) {
    for (const scene of REGISTRATION_SCENES) {
      for (const condition of REGISTERED_CONDITIONS) {
        try {
          whenClauses.add(sceneWhen(commandId, { scene, condition }))
        } catch {
          // その場面には登録できないコマンド（sceneWhen が投げる組）は登録されない
        }
      }
    }
  }
  return [...whenClauses]
}

describe("when 句の評価は、以前の JavaScript の式としての評価と同じ", () => {
  const contexts = allContexts()
  const whenClauses = registeredWhenClauses()

  it("場面の土台をすべて含んでいる（集め方が空回りしていない）", () => {
    expect(contexts).toHaveLength(768)
    expect(whenClauses).toEqual(
      expect.arrayContaining([
        "true",
        "!inputFocus && !modalOpen && !textEditorActive && !choiceSceneOpen",
        "partialScoreModalOpen",
        "choiceSceneOpen && !inputFocus && !modalOpen && !textEditorActive",
        "!modalOpen && !textEditorActive",
        "!inputFocus && !modalOpen && !textEditorActive && !choiceSceneOpen && hasSelectedAnswers && scoringOperationMode == 'keyboard'",
        "partialScoreModalOpen && gradingMode == 'ai' && aiQuestioningManual",
        "!modalOpen && !textEditorActive && false",
      ])
    )
  })

  it.each(registeredWhenClauses())("%s", (when) => {
    const mismatches = contexts.filter(
      (context) =>
        evaluateWhenClause(when, context) !==
        evaluateAsJavaScript(when, context)
    )
    expect(mismatches).toEqual([])
  })
})

describe("when 句の文法", () => {
  const context: ScoringContextState = {
    inputFocus: false,
    textEditorActive: false,
    gradingMode: "grid",
    modalOpen: true,
    partialScoreModalOpen: false,
    hasSelectedAnswers: true,
    scoringOperationMode: "keyboard",
    choiceSceneOpen: false,
    aiQuestioningManual: false,
  }

  it.each([
    "modalOpen || inputFocus",
    "!(inputFocus || textEditorActive) && hasSelectedAnswers",
    "gradingMode != 'individual'",
    'gradingMode === "grid"',
    "gradingMode !== 'ai' && !!hasSelectedAnswers",
    "(gradingMode == 'grid')",
    "true || false",
  ])("JavaScript と同じに読む: %s", (when) => {
    expect(evaluateWhenClause(when, context)).toBe(
      evaluateAsJavaScript(when, context)
    )
  })

  it.each([
    "alert(1)",
    "window",
    "constructor",
    "inputFocus.constructor",
    "gradingMode == 'grid'; alert(1)",
    "unknownKey && modalOpen",
    "`grid` == gradingMode",
    "'a\\'' == gradingMode",
    "!gradingMode == 'grid'",
    "gradingMode == scoringOperationMode",
    "(modalOpen",
    "modalOpen &&",
    "",
  ])("読めない when 句は偽で、コードとしては動かさない: %s", (when) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => parseWhenClause(when)).toThrow()
    expect(evaluateWhenClause(when, context)).toBe(false)
    consoleError.mockRestore()
  })
})
