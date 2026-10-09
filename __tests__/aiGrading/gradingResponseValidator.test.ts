/**
 * VLM が返した採点の JSON の検証（docs/vlm-grading-design.md §5）
 */

import { describe, expect, it } from "vitest"

import { validateGradingResponse } from "@/lib/shared/aiGrading/gradingResponseValidator"

/** 検証を通る応答（各ケースはここから1点だけ変える） */
const validResponse = {
  transcription: "x = 3",
  status: "correct",
  partialScore: null,
  comment: "式と答えが合っている",
  annotation: null,
  confidence: "high",
}

const withFields = (fields: Record<string, unknown>) => ({
  ...validResponse,
  ...fields,
})

const withoutField = (field: string) =>
  Object.fromEntries(
    Object.entries(validResponse).filter(([key]) => key !== field)
  )

describe("validateGradingResponse: 通るもの", () => {
  it.each([
    ["正答", withFields({}), 5],
    ["誤答", withFields({ status: "incorrect" }), 5],
    ["無答", withFields({ status: "no_answer", transcription: "" }), 5],
    ["部分点", withFields({ status: "partial", partialScore: 2.5 }), 5],
    [
      "0点の部分点（未完成だが誤りは無い）",
      withFields({ status: "partial", partialScore: 0 }),
      5,
    ],
    ["保留（点つき）", withFields({ status: "pending", partialScore: 3 }), 5],
    ["点の無い保留", withFields({ status: "pending" }), 5],
    ["配点の無い設問の点の無い保留", withFields({ status: "pending" }), null],
    [
      "満点の保留は保留のまま",
      withFields({ status: "pending", partialScore: 5 }),
      5,
    ],
    ["注釈つき", withFields({ annotation: "符号の誤り" }), 5],
    ["配点の無い設問の正答", withFields({}), null],
  ])("%s", (_label, response, maxPoints) => {
    const result = validateGradingResponse(response, { maxPoints })
    expect(result).toEqual({ ok: true, value: response, notes: [] })
  })
})

describe("validateGradingResponse: 直して受け取るもの", () => {
  it("0.01 より細かい点は 0.01 単位に丸め、notes に残す", () => {
    const result = validateGradingResponse(
      withFields({ status: "partial", partialScore: 2.456 }),
      { maxPoints: 5 }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.partialScore).toBe(2.46)
    expect(result.notes).toHaveLength(1)
  })

  it("保留の点も 0.01 単位に丸める", () => {
    const result = validateGradingResponse(
      withFields({ status: "pending", partialScore: 2.456 }),
      { maxPoints: 5 }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe("pending")
    expect(result.value.partialScore).toBe(2.46)
    expect(result.notes).toHaveLength(1)
  })

  it("浮動小数の誤差（0.1 + 0.2）は丸めの対象にしない", () => {
    const result = validateGradingResponse(
      withFields({ status: "partial", partialScore: 0.1 + 0.2 }),
      { maxPoints: 5 }
    )
    expect(result.ok && result.notes).toEqual([])
  })

  it("満点の partial は correct に寄せ、partialScore を null にする", () => {
    const result = validateGradingResponse(
      withFields({ status: "partial", partialScore: 5 }),
      { maxPoints: 5 }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe("correct")
    expect(result.value.partialScore).toBeNull()
    expect(result.notes).toHaveLength(1)
  })

  it("丸めた結果が満点になった partial も correct に寄せる", () => {
    const result = validateGradingResponse(
      withFields({ status: "partial", partialScore: 4.999 }),
      { maxPoints: 5 }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe("correct")
    expect(result.notes).toHaveLength(2)
  })
})

describe("validateGradingResponse: 配点の無い設問の保留", () => {
  it("点の無い保留は、そのまま点の無い保留として受け取る", () => {
    const result = validateGradingResponse(
      withFields({ status: "pending", partialScore: null }),
      { maxPoints: null }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe("pending")
    expect(result.value.partialScore).toBeNull()
    expect(result.notes).toEqual([])
  })
})

describe("validateGradingResponse: 拒むもの", () => {
  it.each([
    ["オブジェクトでない（配列）", [validResponse], 5],
    ["オブジェクトでない（文字列）", "correct", 5],
    ["null", null, 5],
    ["項目が足りない", withoutField("confidence"), 5],
    ["知らない項目がある", withFields({ score: 5 }), 5],
    ["status が未採点", withFields({ status: "unscored" }), 5],
    ["status が二重マーク", withFields({ status: "double_mark" }), 5],
    ["status が知らない値", withFields({ status: "maru" }), 5],
    ["status が文字列でない", withFields({ status: 1 }), 5],
    ["partial なのに点が null", withFields({ status: "partial" }), 5],
    [
      "保留の点が配点を超える",
      withFields({ status: "pending", partialScore: 5.5 }),
      5,
    ],
    ["保留の点が負", withFields({ status: "pending", partialScore: -1 }), 5],
    [
      "配点の無い設問に点つきの保留",
      withFields({ status: "pending", partialScore: 1 }),
      null,
    ],
    ["correct に点がある", withFields({ partialScore: 5 }), 5],
    [
      "incorrect に 0 点がある",
      withFields({ status: "incorrect", partialScore: 0 }),
      5,
    ],
    ["点が負", withFields({ status: "partial", partialScore: -1 }), 5],
    [
      "点が配点を超える",
      withFields({ status: "partial", partialScore: 5.5 }),
      5,
    ],
    [
      "点が数でない（文字列）",
      withFields({ status: "partial", partialScore: "2" }),
      5,
    ],
    [
      "点が有限でない",
      withFields({ status: "partial", partialScore: Infinity }),
      5,
    ],
    [
      "配点の無い設問に部分点",
      withFields({ status: "partial", partialScore: 1 }),
      null,
    ],
    ["配点の無い設問に点の無い部分点", withFields({ status: "partial" }), null],
    ["transcription が文字列でない", withFields({ transcription: null }), 5],
    ["comment が文字列でない", withFields({ comment: 3 }), 5],
    ["annotation が文字列でも null でもない", withFields({ annotation: 3 }), 5],
    ["confidence が知らない値", withFields({ confidence: "certain" }), 5],
  ])("%s", (_label, response, maxPoints) => {
    const result = validateGradingResponse(response, { maxPoints })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it("外れた理由をすべて返す（1つ目で止めない）", () => {
    const result = validateGradingResponse(
      withFields({ comment: 3, confidence: "certain", extra: true }),
      { maxPoints: 5 }
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reasons).toHaveLength(3)
  })
})
