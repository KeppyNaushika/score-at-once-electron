/**
 * 類型方式の設問の AI採点（docs/vlm-grading-design.md §4-8-6）の文面・出力の形・検証。
 *
 * - 類型の一覧の節と、送った文からの id の読み戻し
 * - 1段目: 判定は evaluated / no_answer / pending で、evaluated は送った類型の id を必ず持つ
 * - 2段目: 選択肢は類型にする set だけ
 *
 * 入力はすべて合成データ。
 */

import { describe, expect, it } from "vitest"

import { formatRubricItemsSection } from "@/lib/shared/aiGrading/rubricItemsText"
import {
  formatScaleLevelsSection,
  parseScaleLevelIds,
} from "@/lib/shared/aiGrading/scaleLevelsText"
import {
  buildStage1OutputSchema,
  buildStage1RequestParts,
  STAGE1_SCALE_SYSTEM_TEXT,
  STAGE1_SYSTEM_TEXT,
} from "@/lib/shared/aiGrading/stage1Grading"
import { validateStage1Response } from "@/lib/shared/aiGrading/stage1ResponseValidator"
import {
  buildStage2OutputSchema,
  buildStage2RequestParts,
  type Stage2AnswerInput,
} from "@/lib/shared/aiGrading/stage2Grouping"
import { validateStage2Response } from "@/lib/shared/aiGrading/stage2ResponseValidator"
import { STAGE2_SCALE_SYSTEM_TEXT } from "@/lib/shared/aiGrading/stage2SystemText"
import type { RubricItemForPrompt } from "@/types/rubric.types"

const SCALE_LEVELS = [
  {
    id: "3a1f6c2e-8b4d-4e5f-9a7b-1c2d3e4f5a01",
    label: "A",
    description: "根拠を2つ以上挙げて説明している",
  },
  {
    id: "3a1f6c2e-8b4d-4e5f-9a7b-1c2d3e4f5a02",
    label: "B",
    description: "根拠を1つ挙げて説明している",
  },
  {
    id: "3a1f6c2e-8b4d-4e5f-9a7b-1c2d3e4f5a03",
    label: "C",
    description: "",
  },
]
const SCALE_LEVEL_IDS = SCALE_LEVELS.map((scaleLevel) => scaleLevel.id)
const UNKNOWN_LEVEL_ID = "3a1f6c2e-8b4d-4e5f-9a7b-1c2d3e4f5aff"

const PROMPT = {
  questionText: "なぜ江戸幕府は鎖国をしたのか、説明しなさい。",
  modelAnswerText: "キリスト教の広まりを防ぎ、貿易の利益を幕府が独占するため。",
  rubricText: "",
}

const textOf = (parts: { fixedParts: { kind: string; text?: string }[] }) =>
  parts.fixedParts
    .map((part) => (part.kind === "text" ? (part.text ?? "") : "<image>"))
    .join("\n")

describe("類型の一覧の節", () => {
  it("1行1類型で id・記号・説明を並べ、点数は載せない。空の説明は（説明なし）にする", () => {
    const section = formatScaleLevelsSection(SCALE_LEVELS)
    expect(section).toContain("## 類型")
    expect(section).toContain(
      `- id: ${SCALE_LEVELS[0].id} ／ A ／ 根拠を2つ以上挙げて説明している`
    )
    expect(section).toContain(
      `- id: ${SCALE_LEVELS[2].id} ／ C ／ （説明なし）`
    )
    expect(section).not.toMatch(/点数|\d+点/)
  })

  it("類型が無ければ節ごと省く（null）", () => {
    expect(formatScaleLevelsSection([])).toBeNull()
  })

  it("送った文から、類型の id を送った順に読み戻せる（空の文からは空）", () => {
    const section = formatScaleLevelsSection(SCALE_LEVELS) ?? ""
    expect(parseScaleLevelIds(section)).toEqual(SCALE_LEVEL_IDS)
    expect(parseScaleLevelIds("")).toEqual([])
  })

  it("同じ入力からは同じ文になる", () => {
    expect(
      formatScaleLevelsSection(SCALE_LEVELS.map((level) => ({ ...level })))
    ).toBe(formatScaleLevelsSection(SCALE_LEVELS))
  })

  it("類型にする採点項目は、効き目を類型の記号で書く（類型の一覧に無ければ未設定）", () => {
    const rubricItems: RubricItemForPrompt[] = [
      {
        id: "7e2a9b10-1c3d-4e5f-8a9b-0c1d2e3f4a01",
        label: "根拠を2つ挙げている",
        effectKind: "set",
        pointDelta: null,
        setStatus: "evaluated",
        setScore: null,
        setScaleLevelId: SCALE_LEVELS[0].id,
      },
      {
        id: "7e2a9b10-1c3d-4e5f-8a9b-0c1d2e3f4a02",
        label: "別の類型表の類型",
        effectKind: "set",
        pointDelta: null,
        setStatus: "evaluated",
        setScore: null,
        setScaleLevelId: UNKNOWN_LEVEL_ID,
      },
    ]
    const section = formatRubricItemsSection(rubricItems, SCALE_LEVELS)
    expect(section).toContain(`${rubricItems[0].id} ／ 類型をAにする ／`)
    expect(section).toContain(`${rubricItems[1].id} ／ 類型（未設定） ／`)
  })
})

describe("類型方式の設問の1段目の文面と出力の形", () => {
  const parts = buildStage1RequestParts({
    prompt: PROMPT,
    points: 10,
    rubricItems: [],
    scaleLevels: SCALE_LEVELS,
    teacherInstructions: [],
  })

  it("類型方式の指示を使い、配点の代わりに類型の節を置く（配点は送らない）", () => {
    expect(parts.systemText).toBe(STAGE1_SCALE_SYSTEM_TEXT)
    const text = textOf(parts)
    expect(text).toContain("## 類型")
    expect(text).not.toContain("## 配点")
    expect(text).not.toContain("10点")
  })

  it("類型を送らなければ、これまでどおりの指示と配点の節になる", () => {
    const pointParts = buildStage1RequestParts({
      prompt: PROMPT,
      points: 10,
      rubricItems: [],
      teacherInstructions: [],
    })
    expect(pointParts.systemText).toBe(STAGE1_SYSTEM_TEXT)
    expect(textOf(pointParts)).toContain("## 配点\n10点")
  })

  it("類型方式の指示は、類型の id を選ばせ、正答・誤答・部分点を使わせない", () => {
    expect(STAGE1_SCALE_SYSTEM_TEXT).toContain("scaleLevelId")
    expect(STAGE1_SCALE_SYSTEM_TEXT).toContain("evaluated")
    expect(STAGE1_SCALE_SYSTEM_TEXT).not.toMatch(/ルーブリック|段階/)
  })

  it("出力の形は status を evaluated / no_answer / pending に絞り、scaleLevelId を足す", () => {
    const schema = buildStage1OutputSchema([], SCALE_LEVEL_IDS)
    expect(schema.properties?.status.enum).toEqual([
      "evaluated",
      "no_answer",
      "pending",
    ])
    expect(schema.properties?.scaleLevelId.type).toEqual(["string", "null"])
    expect(schema.required).toContain("scaleLevelId")
  })

  it("類型方式でない設問の出力の形には scaleLevelId を足さない", () => {
    expect(buildStage1OutputSchema([]).properties?.scaleLevelId).toBeUndefined()
  })
})

/** 類型方式の1段目の、検証を通る応答 */
const SCALE_RESPONSE = {
  transcription: "キリスト教を禁じるため。",
  observation: "答案は根拠を1つ挙げているが、貿易の独占が無い。",
  status: "evaluated",
  scaleLevelId: SCALE_LEVELS[1].id,
  partialScore: null,
  matchedRubricItemIds: [],
  confidence: "medium",
}
const SCALE_CONTEXT = {
  maxPoints: 10,
  rubricItemIds: [],
  scaleLevelIds: SCALE_LEVEL_IDS,
}

describe("類型方式の設問の1段目の応答の検証", () => {
  it("送った類型の id を持つ evaluated を通し、点は null で受け取る", () => {
    const result = validateStage1Response(SCALE_RESPONSE, SCALE_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe("evaluated")
    expect(result.value.scaleLevelId).toBe(SCALE_LEVELS[1].id)
    expect(result.value.partialScore).toBeNull()
  })

  it.each([
    ["無答", "no_answer"],
    ["保留", "pending"],
  ])("%s は類型を null にして通す", (_label, status) => {
    const result = validateStage1Response(
      { ...SCALE_RESPONSE, status, scaleLevelId: null },
      SCALE_CONTEXT
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.scaleLevelId).toBeNull()
  })

  it.each([
    ["evaluated に類型が無い", { scaleLevelId: null }],
    ["送っていない類型の id", { scaleLevelId: UNKNOWN_LEVEL_ID }],
    ["無答に類型がある", { status: "no_answer" }],
    ["保留に類型がある", { status: "pending" }],
    [
      "保留に点がある",
      { status: "pending", scaleLevelId: null, partialScore: 3 },
    ],
    ["evaluated に点がある", { partialScore: 6 }],
    ["正答を返した", { status: "correct", scaleLevelId: null }],
    [
      "部分点を返した",
      { status: "partial", scaleLevelId: null, partialScore: 5 },
    ],
  ])("%s は外す", (_label, override) => {
    const result = validateStage1Response(
      { ...SCALE_RESPONSE, ...override },
      SCALE_CONTEXT
    )
    expect(result.ok).toBe(false)
  })

  it("scaleLevelId が無い応答は項目が足りないとして外す", () => {
    const { scaleLevelId: _omitted, ...withoutScaleLevel } = SCALE_RESPONSE
    const result = validateStage1Response(withoutScaleLevel, SCALE_CONTEXT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reasons.join(" ")).toContain("scaleLevelId")
  })

  it("類型方式でない設問の応答に scaleLevelId や evaluated があれば外す", () => {
    const pointContext = { maxPoints: 10, rubricItemIds: [], scaleLevelIds: [] }
    const { scaleLevelId: _omitted, ...withoutScaleLevel } = SCALE_RESPONSE
    expect(validateStage1Response(withoutScaleLevel, pointContext).ok).toBe(
      false
    )
    expect(
      validateStage1Response(
        { ...withoutScaleLevel, status: "correct" },
        pointContext
      ).ok
    ).toBe(true)
    expect(
      validateStage1Response(
        { ...SCALE_RESPONSE, status: "correct", scaleLevelId: null },
        pointContext
      ).ok
    ).toBe(false)
  })
})

const SCALE_ANSWERS: Stage2AnswerInput[] = [
  {
    status: "evaluated",
    partialScore: null,
    scaleLevelId: SCALE_LEVELS[0].id,
    confidence: "high",
    transcription: "キリスト教を禁じ、貿易を独占するため。",
    observation: "答案は根拠を2つ挙げている。",
    matchedRubricItemIds: [],
  },
  {
    status: "evaluated",
    partialScore: null,
    scaleLevelId: SCALE_LEVELS[1].id,
    confidence: "medium",
    transcription: "キリスト教を禁じるため。",
    observation: "答案は根拠を1つ挙げている。",
    matchedRubricItemIds: [],
  },
  {
    status: "no_answer",
    partialScore: null,
    scaleLevelId: null,
    confidence: "high",
    transcription: "",
    observation: "何も書かれていない。",
    matchedRubricItemIds: [],
  },
]

describe("類型方式の設問の2段目の文面と出力の形", () => {
  const parts = buildStage2RequestParts({
    prompt: { ...PROMPT, annotationInstruction: "" },
    points: 10,
    rubricItems: [],
    scaleLevels: SCALE_LEVELS,
    answers: SCALE_ANSWERS,
  })
  const text = textOf(parts)

  it("類型方式の指示を使い、答案の仮の評価を類型の記号で書く（点は書かない）", () => {
    expect(parts.systemText).toBe(STAGE2_SCALE_SYSTEM_TEXT)
    expect(text).toContain("## 類型")
    expect(text).not.toContain("## 配点")
    expect(text).toContain("[A1] 仮の評価: 類型 A ／ 確信度: 高")
    expect(text).toContain("[A2] 仮の評価: 類型 B")
    expect(text).toContain("[A3] 仮の評価: 無答")
  })

  it("選択肢の形は set だけで、setScaleLevelId を持つ", () => {
    const optionSchema = buildStage2OutputSchema(parts.answerKeys, true)
      .properties?.proposals.items?.properties?.options.items
    expect(optionSchema?.properties?.effectKind.enum).toEqual(["set"])
    expect(optionSchema?.required).toContain("setScaleLevelId")
    expect(
      buildStage2OutputSchema(parts.answerKeys).properties?.proposals.items
        ?.properties?.options.items?.properties?.setScaleLevelId
    ).toBeUndefined()
  })
})

const scaleOption = (override: Record<string, unknown>) => ({
  effectKind: "set",
  pointDelta: null,
  setStatus: "evaluated",
  setScore: null,
  setScaleLevelId: SCALE_LEVELS[1].id,
  rationale: "根拠が1つ",
  recommended: true,
  ...override,
})

const scaleResponseWith = (options: Record<string, unknown>[]) => ({
  proposals: [
    {
      label: "根拠が1つだけ",
      description: "根拠を1つ挙げているが、2つ目が無い。",
      adviceDraft: "もう1つの理由も書き足そう。",
      matchedRubricItemId: null,
      memberAnswerKeys: ["A2"],
      options,
    },
  ],
  notes: "",
})

const SCALE_STAGE2_CONTEXT = {
  maxPoints: 10,
  rubricItemIds: [],
  scaleLevelIds: SCALE_LEVEL_IDS,
  answers: SCALE_ANSWERS,
}

describe("類型方式の設問の2段目の選択肢の検証", () => {
  it("類型にする選択肢と、無答・保留の選択肢を通す", () => {
    const result = validateStage2Response(
      scaleResponseWith([
        scaleOption({}),
        scaleOption({
          setScaleLevelId: SCALE_LEVELS[0].id,
          recommended: false,
        }),
        scaleOption({
          setStatus: "pending",
          setScaleLevelId: null,
          recommended: false,
        }),
      ]),
      SCALE_STAGE2_CONTEXT
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      result.proposals[0].options.map((option) => [
        option.setStatus,
        option.setScaleLevelId,
        option.setScore,
      ])
    ).toEqual([
      ["evaluated", SCALE_LEVELS[1].id, null],
      ["evaluated", SCALE_LEVELS[0].id, null],
      ["pending", null, null],
    ])
  })

  it.each([
    [
      "点を加減する選択肢",
      {
        effectKind: "adjust",
        pointDelta: -1,
        setStatus: null,
        setScaleLevelId: null,
      },
    ],
    ["類型の無い evaluated", { setScaleLevelId: null }],
    ["送っていない類型", { setScaleLevelId: UNKNOWN_LEVEL_ID }],
    ["無答に類型がある", { setStatus: "no_answer" }],
    ["点を持つ", { setScore: 6 }],
    ["正答にする", { setStatus: "correct", setScaleLevelId: null }],
    ["setScaleLevelId が無い", { setScaleLevelId: undefined }],
  ])("%s は外す", (_label, override) => {
    const result = validateStage2Response(
      scaleResponseWith([scaleOption(override)]),
      SCALE_STAGE2_CONTEXT
    )
    expect(result.ok).toBe(false)
  })

  it("類型方式でない設問の選択肢に setScaleLevelId があれば外す", () => {
    const result = validateStage2Response(
      scaleResponseWith([
        scaleOption({ setStatus: "incorrect", setScaleLevelId: null }),
      ]),
      { ...SCALE_STAGE2_CONTEXT, scaleLevelIds: [] }
    )
    expect(result.ok).toBe(false)
  })
})
