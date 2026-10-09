/**
 * 次の往復の1段目（項目を送ったとき）の当てはまりの指標（docs/vlm-grading-design.md §3-6・§12）。
 * 純粋な関数。
 *
 * - 2段目との一致: 1段目が返した項目（matchedRubricItemIds）と、2段目がその答案を入れた案から
 *   作った項目を比べる。答案ごとの完全一致の率と、項目単位の適合率・再現率
 * - 教員との一致: 1段目が返した項目を当てたとして、ルーブリックの点の計算（減点方式）で出る
 *   判定が、教員の判定（確定・合意）と一致した率。比べるために、2段目の案をそのまま当てた
 *   ときの率（上限の目安）と、1段目の判定そのものの率も出す
 * - 項目の当たり方: 項目を1つも返さなかった答案の数、判定を決める項目が2つ以上当たった答案の数
 */

import type { RubricItemForPrompt } from "../../src/types/rubric.types"
import { computeRubricScore } from "../../src/components/exams/07-score-at-once/Rubric/utils/rubricScore"

/** 答案1件ぶんの材料 */
export interface RubricMatchCell {
  /** 1段目が返した項目（検証を通ったもの） */
  matchedItemIds: readonly string[]
  /** 2段目がこの答案を入れた案から作った項目 */
  expectedItemIds: readonly string[]
  /** 1段目の判定 */
  aiStatus: string
  /** 教員の判定（確定・合意）。割れた・無いマスは null */
  referenceStatus: string | null
}

export interface RubricMatchQuestion {
  points: number | null
  items: readonly RubricItemForPrompt[]
  cells: readonly RubricMatchCell[]
}

interface Rate {
  n: number
  matched: number
  rate: number | null
}

export interface RubricMatchMetrics {
  cells: number
  /** 2段目と項目の集合が完全に一致した答案 */
  exactMatch: Rate
  /** 1段目が返した項目のうち、2段目もその答案に当てていたもの */
  precision: Rate
  /** 2段目が当てた項目のうち、1段目も返したもの */
  recall: Rate
  /** 項目を1つも返さなかった答案 */
  noMatchCount: number
  /** 判定を決める項目が2つ以上当たった答案 */
  multipleSetCount: number
  /** 1段目の項目から計算した判定と教員の一致 */
  statusFromMatched: Rate
  /** 2段目の案をそのまま当てたときの判定と教員の一致（上限の目安） */
  statusFromExpected: Rate
  /** 1段目の判定そのものと教員の一致 */
  statusFromAi: Rate
}

const toRate = (n: number, matched: number): Rate => ({
  n,
  matched,
  rate: n === 0 ? null : matched / n,
})

/** 当てた項目から、減点方式で判定を求める（項目が無ければ未採点） */
function statusFromItems(
  question: RubricMatchQuestion,
  appliedItemIds: readonly string[]
): string {
  const scoringItems = question.items.map((item, itemIndex) => ({
    id: item.id,
    effectKind: item.effectKind,
    pointDelta: item.pointDelta,
    setStatus: item.setStatus,
    setScore: item.setScore,
    sortOrder: itemIndex,
    createdAt: new Date(0),
  }))
  const outcome = computeRubricScore(
    { scoringMethod: "deduction", points: question.points },
    scoringItems,
    {
      overridesRubric: false,
      rubricApplications: appliedItemIds.map((rubricItemId) => ({
        rubricItemId,
      })),
    }
  )
  return outcome.kind === "computed" ? outcome.result.status : "unscored"
}

export function computeRubricMatchMetrics(
  questions: readonly RubricMatchQuestion[]
): RubricMatchMetrics {
  let cellCount = 0
  let exactMatched = 0
  let matchedTotal = 0
  let expectedTotal = 0
  let overlapTotal = 0
  let noMatchCount = 0
  let multipleSetCount = 0
  const status = {
    matched: { n: 0, matched: 0 },
    expected: { n: 0, matched: 0 },
    ai: { n: 0, matched: 0 },
  }
  questions.forEach((question) => {
    const setItemIds = new Set(
      question.items
        .filter((item) => item.effectKind === "set")
        .map((item) => item.id)
    )
    question.cells.forEach((cell) => {
      cellCount += 1
      const matched = new Set(cell.matchedItemIds)
      const expected = new Set(cell.expectedItemIds)
      const overlap = [...matched].filter((itemId) => expected.has(itemId))
      matchedTotal += matched.size
      expectedTotal += expected.size
      overlapTotal += overlap.length
      if (matched.size === expected.size && overlap.length === matched.size) {
        exactMatched += 1
      }
      if (matched.size === 0) noMatchCount += 1
      if ([...matched].filter((itemId) => setItemIds.has(itemId)).length >= 2) {
        multipleSetCount += 1
      }
      if (cell.referenceStatus === null) return
      const tally = (key: keyof typeof status, candidate: string) => {
        status[key].n += 1
        if (candidate === cell.referenceStatus) status[key].matched += 1
      }
      tally("matched", statusFromItems(question, cell.matchedItemIds))
      tally("expected", statusFromItems(question, cell.expectedItemIds))
      tally("ai", cell.aiStatus)
    })
  })
  return {
    cells: cellCount,
    exactMatch: toRate(cellCount, exactMatched),
    precision: toRate(matchedTotal, overlapTotal),
    recall: toRate(expectedTotal, overlapTotal),
    noMatchCount,
    multipleSetCount,
    statusFromMatched: toRate(status.matched.n, status.matched.matched),
    statusFromExpected: toRate(status.expected.n, status.expected.matched),
    statusFromAi: toRate(status.ai.n, status.ai.matched),
  }
}
