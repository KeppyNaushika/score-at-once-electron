/**
 * 1段目（答案ごとの判定）の文面・出力の形・検証（docs/vlm-grading-design.md §3-3・§6-1）。
 * 入力はすべて合成データ。
 */

import { describe, expect, it } from "vitest"

import {
  parseRubricItemIds,
  toRubricItemForPrompt,
} from "@/lib/shared/aiGrading/rubricItemsText"
import {
  buildStage1OutputSchema,
  buildStage1RequestParts,
  STAGE1_OBSERVATION_MAX_LENGTH,
  STAGE1_SYSTEM_TEXT,
} from "@/lib/shared/aiGrading/stage1Grading"
import { validateStage1Response } from "@/lib/shared/aiGrading/stage1ResponseValidator"
import type { RubricItemForPrompt } from "@/types/rubric.types"

const PROMPT = {
  questionText: "x + 3 = 5 を解け。",
  modelAnswerText: "x = 2",
  rubricText: "",
}

const RUBRIC_ITEMS: RubricItemForPrompt[] = [
  {
    id: "0f8b8c1e-4a8d-4c47-9a4e-2c1f6b9d1a01",
    label: "移項で符号を誤った",
    effectKind: "adjust",
    pointDelta: -1,
    setStatus: null,
    setScore: null,
  },
  {
    id: "0f8b8c1e-4a8d-4c47-9a4e-2c1f6b9d1a02",
    label: "答えのみ",
    effectKind: "set",
    pointDelta: null,
    setStatus: "partial",
    setScore: 1,
  },
]

const textOf = (parts: ReturnType<typeof buildStage1RequestParts>) =>
  parts.fixedParts
    .map((part) => (part.kind === "text" ? part.text : "<image>"))
    .join("\n")

describe("1段目の文面", () => {
  it("同じ入力からは同じ固定部になる", () => {
    const input = {
      prompt: PROMPT,
      points: 3,
      rubricItems: RUBRIC_ITEMS,
      teacherInstructions: ["途中式が無ければ誤答"],
    }
    expect(JSON.stringify(buildStage1RequestParts(input))).toBe(
      JSON.stringify(buildStage1RequestParts(input))
    )
  })

  it("朱書き・コメントを返させる指示を含まない", () => {
    expect(STAGE1_SYSTEM_TEXT).not.toMatch(/annotation|comment/)
    expect(STAGE1_SYSTEM_TEXT).toContain("observation")
    expect(STAGE1_SYSTEM_TEXT).toContain("matchedRubricItemIds")
  })

  it("項目があれば id・効き目・名前の節を載せ、無ければ節ごと省く", () => {
    const withItems = textOf(
      buildStage1RequestParts({
        prompt: PROMPT,
        points: 3,
        rubricItems: RUBRIC_ITEMS,
        teacherInstructions: [],
      })
    )
    expect(withItems).toContain("## ルーブリック項目")
    expect(withItems).toContain(
      `${RUBRIC_ITEMS[0].id} ／ −1点 ／ 移項で符号を誤った`
    )
    expect(withItems).toContain("判定を部分点（1点）にする")

    const withoutItems = textOf(
      buildStage1RequestParts({
        prompt: PROMPT,
        points: 3,
        rubricItems: [],
        teacherInstructions: [],
      })
    )
    expect(withoutItems).not.toContain("ルーブリック項目")
  })

  it("模範解答の画像は文の間に置き、答案の画像は含めない", () => {
    const parts = buildStage1RequestParts({
      prompt: PROMPT,
      points: 3,
      rubricItems: [],
      teacherInstructions: [],
      modelAnswerImage: { mediaType: "image/png", base64Data: "bW9kZWw=" },
    })
    expect(parts.fixedParts.map((part) => part.kind)).toEqual([
      "text",
      "image",
      "text",
    ])
  })
})

describe("教員の指示と、送った項目の一覧", () => {
  it("「その他」に書いた指示は「教員の指示」の節として入り、無ければ節ごと省く", () => {
    const withInstructions = textOf(
      buildStage1RequestParts({
        prompt: PROMPT,
        points: 3,
        rubricItems: [],
        teacherInstructions: ["単位が無ければ誤答", " 途中式は問わない "],
      })
    )
    expect(withInstructions).toContain(
      "## 教員の指示\n- 単位が無ければ誤答\n- 途中式は問わない"
    )
    expect(STAGE1_SYSTEM_TEXT).toContain("「教員の指示」の節")
    const withoutInstructions = textOf(
      buildStage1RequestParts({
        prompt: PROMPT,
        points: 3,
        rubricItems: [],
        teacherInstructions: [],
      })
    )
    expect(withoutInstructions).not.toContain("教員の指示")
  })

  it("送った項目の一覧の文から、項目の id を送った順に読み戻せる", () => {
    const rendered = textOf(
      buildStage1RequestParts({
        prompt: PROMPT,
        points: 3,
        rubricItems: RUBRIC_ITEMS,
        teacherInstructions: [],
      })
    )
    expect(parseRubricItemIds(rendered)).toEqual(
      RUBRIC_ITEMS.map((rubricItem) => rubricItem.id)
    )
    expect(parseRubricItemIds("")).toEqual([])
  })

  it("項目の行の種類・判定を値の集合へ絞る（知らない判定は null）", () => {
    expect(
      toRubricItemForPrompt({
        id: "item",
        label: "x",
        effectKind: "set",
        pointDelta: null,
        setStatus: "double_mark",
        setScore: null,
      })
    ).toMatchObject({ effectKind: "set", setStatus: null })
  })
})

describe("1段目の出力の形", () => {
  it("項目を送ったときは、当てはまる項目の id を送った id の enum で縛る", () => {
    const schema = buildStage1OutputSchema(RUBRIC_ITEMS.map((item) => item.id))
    expect(schema.properties?.matchedRubricItemIds.items?.enum).toEqual(
      RUBRIC_ITEMS.map((item) => item.id)
    )
    expect(
      buildStage1OutputSchema([]).properties?.matchedRubricItemIds.items?.enum
    ).toBeUndefined()
  })

  it("朱書きとコメントの項目を持たない", () => {
    expect(
      Object.keys(buildStage1OutputSchema([]).properties ?? {}).sort()
    ).toEqual(
      [
        "confidence",
        "matchedRubricItemIds",
        "observation",
        "partialScore",
        "status",
        "transcription",
      ].sort()
    )
  })
})

const VALID_RESPONSE = {
  transcription: "x = 8",
  observation: "3 を移項するとき符号を変えず x=8 とした。",
  status: "incorrect",
  partialScore: null,
  matchedRubricItemIds: [RUBRIC_ITEMS[0].id],
  confidence: "high",
}
const CONTEXT = {
  maxPoints: 3,
  rubricItemIds: RUBRIC_ITEMS.map((item) => item.id),
}

describe("1段目の応答の検証", () => {
  it("正しい応答を通す", () => {
    const result = validateStage1Response(VALID_RESPONSE, CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchedRubricItemIds).toEqual([RUBRIC_ITEMS[0].id])
  })

  it("重なった項目の id は1つにまとめて notes に残す", () => {
    const result = validateStage1Response(
      {
        ...VALID_RESPONSE,
        matchedRubricItemIds: [RUBRIC_ITEMS[0].id, RUBRIC_ITEMS[0].id],
      },
      CONTEXT
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchedRubricItemIds).toHaveLength(1)
    expect(result.notes).toHaveLength(1)
  })

  it("満点の partial は correct に寄せる", () => {
    const result = validateStage1Response(
      { ...VALID_RESPONSE, status: "partial", partialScore: 3 },
      CONTEXT
    )
    expect(result.ok && result.value.status).toBe("correct")
  })

  it.each([
    ["送っていない項目の id", { matchedRubricItemIds: ["unknown"] }],
    [
      "所見が上限を超える",
      { observation: "あ".repeat(STAGE1_OBSERVATION_MAX_LENGTH + 1) },
    ],
    ["partial なのに点が null", { status: "partial", partialScore: null }],
    ["点が配点を超える", { status: "partial", partialScore: 4 }],
    ["incorrect に点がある", { partialScore: 1 }],
    ["知らない判定", { status: "unscored" }],
    ["知らない確信度", { confidence: "certain" }],
    ["朱書きの項目が混ざる", { annotation: "単位を書こう" }],
  ])("%s は外す", (_label, override) => {
    const result = validateStage1Response(
      { ...VALID_RESPONSE, ...override },
      CONTEXT
    )
    expect(result.ok).toBe(false)
  })

  it("項目が足りないときは理由を返す", () => {
    const { observation: _omitted, ...withoutObservation } = VALID_RESPONSE
    const result = validateStage1Response(withoutObservation, CONTEXT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reasons.join(" ")).toContain("observation")
  })
})
