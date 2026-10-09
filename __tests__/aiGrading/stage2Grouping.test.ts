/**
 * 2段目（項目の案）の文面・出力の形・検証（docs/vlm-grading-design.md §3-4・§6-2）。
 * 入力はすべて合成データ。
 */

import { describe, expect, it } from "vitest"

import {
  buildStage2OutputSchema,
  buildStage2RequestParts,
  STAGE2_ADVICE_MAX_LENGTH,
  type Stage2AnswerInput,
} from "@/lib/shared/aiGrading/stage2Grouping"
import { validateStage2Response } from "@/lib/shared/aiGrading/stage2ResponseValidator"

const RUBRIC_ITEM_ID = "5c2d7e10-3b4a-4f6e-9d8c-7b6a5f4e3d21"

const ANSWERS: Stage2AnswerInput[] = [
  {
    status: "correct",
    partialScore: null,
    confidence: "high",
    transcription: "50 cm",
    observation: "模範解答と同じ。",
    matchedRubricItemIds: [],
  },
  {
    status: "incorrect",
    partialScore: null,
    confidence: "medium",
    transcription: "50",
    observation: "数値は正しいが単位 cm が無い。",
    matchedRubricItemIds: [],
  },
  {
    status: "incorrect",
    partialScore: null,
    confidence: "low",
    transcription: "5",
    observation: "桁を誤った。",
    matchedRubricItemIds: [RUBRIC_ITEM_ID],
  },
  {
    status: "no_answer",
    partialScore: null,
    confidence: "high",
    transcription: "",
    observation: "何も書かれていない。",
    matchedRubricItemIds: [],
  },
]

const PROMPT = {
  questionText: "",
  modelAnswerText: "50 cm",
  rubricText: "",
  annotationInstruction: "一文で、何をすればよいかを書く。",
}

describe("2段目の文面", () => {
  const parts = buildStage2RequestParts({
    prompt: PROMPT,
    points: 4,
    rubricItems: [],
    answers: ANSWERS,
    teacherInstructions: ["単位の無い答案は誤答にしない"],
  })
  const text = parts.fixedParts
    .map((part) => (part.kind === "text" ? part.text : ""))
    .join("\n")

  it("画像を含まず、答案に仮の番号を振る", () => {
    expect(parts.fixedParts.every((part) => part.kind === "text")).toBe(true)
    expect(parts.answerKeys).toEqual(["A1", "A2", "A3", "A4"])
    expect(text).toContain("[A2] 仮の判定: 誤答 ／ 確信度: 中")
    expect(text).toContain("読み取り: （なし）")
    expect(text).toContain(`当てはまる既存の項目: ${RUBRIC_ITEM_ID}`)
  })

  it("助言の文案の指示と教員の指示を節として載せる", () => {
    expect(text).toContain("## 助言の文案の指示")
    expect(text).toContain("## 教員の指示\n- 単位の無い答案は誤答にしない")
  })

  it("出力の形は、答案の番号を送った番号の enum で縛る", () => {
    const schema = buildStage2OutputSchema(parts.answerKeys)
    expect(
      schema.properties?.proposals.items?.properties?.memberAnswerKeys.items
        ?.enum
    ).toEqual(["A1", "A2", "A3", "A4"])
  })
})

const option = (override: Record<string, unknown>) => ({
  effectKind: "adjust",
  pointDelta: -1,
  setStatus: null,
  setScore: null,
  rationale: "数値は正しい",
  recommended: true,
  ...override,
})

const proposal = (override: Record<string, unknown>) => ({
  label: "単位が無い",
  description: "数値は正しいが単位が書かれていない。",
  adviceDraft: "答えには単位まで書こう。",
  matchedRubricItemId: null,
  memberAnswerKeys: ["A2"],
  options: [option({}), option({ recommended: false, pointDelta: -2 })],
  ...override,
})

const VALID_RESPONSE = {
  proposals: [
    proposal({}),
    proposal({
      label: "無答",
      adviceDraft: "",
      memberAnswerKeys: ["A4"],
      options: [
        option({ effectKind: "set", pointDelta: null, setStatus: "no_answer" }),
      ],
    }),
  ],
  notes: "",
}

const CONTEXT = {
  maxPoints: 4,
  rubricItemIds: [RUBRIC_ITEM_ID],
  answers: ANSWERS,
}

describe("2段目の応答の検証", () => {
  it("正しい応答を通し、correct・既存の項目に当たる答案は取りこぼしに数えない", () => {
    const result = validateStage2Response(VALID_RESPONSE, CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposals).toHaveLength(2)
    expect(result.uncoveredAnswerKeys).toEqual([])
  })

  it("どの案にも入らない correct でない答案を取りこぼしとして返す", () => {
    const result = validateStage2Response(
      { ...VALID_RESPONSE, proposals: [VALID_RESPONSE.proposals[1]] },
      CONTEXT
    )
    expect(result.ok && result.uncoveredAnswerKeys).toEqual(["A2"])
  })

  it("満点の partial を correct に寄せ、直したことを残す", () => {
    const result = validateStage2Response(
      {
        ...VALID_RESPONSE,
        proposals: [
          proposal({
            options: [
              option({
                effectKind: "set",
                pointDelta: null,
                setStatus: "partial",
                setScore: 4,
              }),
            ],
          }),
        ],
      },
      CONTEXT
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposals[0].options[0].setStatus).toBe("correct")
    expect(result.adjustments).toHaveLength(1)
  })

  it.each([
    ["送っていない答案の番号", proposal({ memberAnswerKeys: ["A9"] })],
    ["当てはまる答案が無い", proposal({ memberAnswerKeys: [] })],
    ["送っていない項目の id", proposal({ matchedRubricItemId: "unknown" })],
    ["推奨が2つ", proposal({ options: [option({}), option({})] })],
    ["推奨が無い", proposal({ options: [option({ recommended: false })] })],
    ["選択肢が無い", proposal({ options: [] })],
    [
      "選択肢が多すぎる",
      proposal({
        options: [
          option({}),
          ...Array.from({ length: 4 }, () => option({ recommended: false })),
        ],
      }),
    ],
    ["adjust の加減が 0", proposal({ options: [option({ pointDelta: 0 })] })],
    [
      "adjust の加減が配点を超える",
      proposal({ options: [option({ pointDelta: -5 })] }),
    ],
    [
      "adjust に判定がある",
      proposal({ options: [option({ setStatus: "incorrect" })] }),
    ],
    [
      "set に加減がある",
      proposal({
        options: [option({ effectKind: "set", setStatus: "incorrect" })],
      }),
    ],
    [
      "set の判定が知らない値",
      proposal({
        options: [
          option({
            effectKind: "set",
            pointDelta: null,
            setStatus: "unscored",
          }),
        ],
      }),
    ],
    [
      "set の partial に点が無い",
      proposal({
        options: [
          option({ effectKind: "set", pointDelta: null, setStatus: "partial" }),
        ],
      }),
    ],
    ["助言が二文", proposal({ adviceDraft: "単位を書こう。見直そう。" })],
    ["助言に改行", proposal({ adviceDraft: "単位を\n書こう" })],
    [
      "助言が長すぎる",
      proposal({ adviceDraft: "あ".repeat(STAGE2_ADVICE_MAX_LENGTH + 1) }),
    ],
    ["名前が空", proposal({ label: " " })],
    ["案に知らない項目", { ...proposal({}), extra: 1 }],
  ])("%s は外す", (_label, brokenProposal) => {
    const result = validateStage2Response(
      { proposals: [brokenProposal], notes: "" },
      CONTEXT
    )
    expect(result.ok).toBe(false)
  })

  it("全体の形が外れたら外す", () => {
    expect(validateStage2Response([], CONTEXT).ok).toBe(false)
    expect(
      validateStage2Response({ proposals: {}, notes: "" }, CONTEXT).ok
    ).toBe(false)
    expect(
      validateStage2Response({ ...VALID_RESPONSE, extra: 1 }, CONTEXT).ok
    ).toBe(false)
  })
})
