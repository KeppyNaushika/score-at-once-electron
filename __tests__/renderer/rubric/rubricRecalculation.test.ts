/**
 * 点を計算し直す対象の洗い出し（docs/vlm-grading-design.md §4-6）と、項目の値の検証（§6-4）。
 */

import { describe, expect, it } from "vitest"

import type {
  RubricScoredRow,
  RubricScoringItem,
} from "@/components/exams/07-score-at-once/Rubric/types"
import {
  planRubricRecalculation,
  summarizeRubricRecalculation,
  toRubricScoreWrites,
  withEditedRubricItem,
  withoutRubricItem,
} from "@/components/exams/07-score-at-once/Rubric/utils/rubricRecalculation"
import { validateRubricItemEffect } from "@/lib/shared/rubric/rubricItemValidator"

const CREATED_AT = new Date("2026-10-01T00:00:00.000Z")
const ME = "user-me"
const COLLEAGUE = "user-colleague"
const ANOTHER = "user-another"

const unitMissing: RubricScoringItem = {
  id: "unit-missing",
  effectKind: "adjust",
  pointDelta: -2,
  setStatus: null,
  setScore: null,
  sortOrder: 0,
  createdAt: CREATED_AT,
}
const processMissing: RubricScoringItem = {
  ...unitMissing,
  id: "process-missing",
  pointDelta: -3,
}

const row = (
  id: string,
  userId: string,
  rubricItemIds: string[],
  stored: Pick<RubricScoredRow, "status" | "partialScore">,
  overridesRubric = false
): RubricScoredRow => ({
  id,
  userId,
  overridesRubric,
  ...stored,
  rubricApplications: rubricItemIds.map((rubricItemId) => ({ rubricItemId })),
})

const SOURCE = {
  scoringMethod: "deduction",
  points: 10,
  rubricItems: [unitMissing, processMissing],
  questionScores: [
    row("own", ME, ["unit-missing"], { status: "partial", partialScore: 8 }),
    row("colleague-1", COLLEAGUE, ["unit-missing"], {
      status: "partial",
      partialScore: 8,
    }),
    row("colleague-2", COLLEAGUE, ["unit-missing", "process-missing"], {
      status: "partial",
      partialScore: 5,
    }),
    row("another-other-item", ANOTHER, ["process-missing"], {
      status: "partial",
      partialScore: 7,
    }),
    row(
      "another-overridden",
      ANOTHER,
      ["unit-missing"],
      { status: "correct", partialScore: null },
      true
    ),
  ],
}

describe("planRubricRecalculation", () => {
  it("保存された点が今の項目と合っていれば、何も変わらない", () => {
    expect(planRubricRecalculation(SOURCE)).toEqual([])
  })

  it("項目の値を変えると、その項目を当てている行だけが変わる（上書きの行は飛ばす）", () => {
    const edited = withEditedRubricItem(SOURCE.rubricItems, {
      ...unitMissing,
      pointDelta: -1,
    })
    const changes = planRubricRecalculation(
      { ...SOURCE, rubricItems: edited },
      { onlyRubricItemId: "unit-missing" }
    )
    expect(changes).toEqual([
      {
        questionScoreId: "own",
        userId: ME,
        before: { status: "partial", partialScore: 8 },
        after: { status: "partial", partialScore: 9 },
      },
      {
        questionScoreId: "colleague-1",
        userId: COLLEAGUE,
        before: { status: "partial", partialScore: 8 },
        after: { status: "partial", partialScore: 9 },
      },
      {
        questionScoreId: "colleague-2",
        userId: COLLEAGUE,
        before: { status: "partial", partialScore: 5 },
        after: { status: "partial", partialScore: 6 },
      },
    ])
    expect(summarizeRubricRecalculation(changes, ME)).toEqual({
      ownScoreCount: 1,
      otherScoreCount: 2,
      otherUserCount: 1,
    })
    expect(toRubricScoreWrites(changes)[0]).toEqual({
      questionScoreId: "own",
      status: "partial",
      partialScore: 9,
      clearsOverride: false,
    })
  })

  it("項目を消すと、その項目だけが当たっていた行は unscored に戻る", () => {
    const changes = planRubricRecalculation(
      {
        ...SOURCE,
        rubricItems: withoutRubricItem(SOURCE.rubricItems, "unit-missing"),
      },
      { onlyRubricItemId: "unit-missing" }
    )
    expect(
      changes.map((change) => [change.questionScoreId, change.after])
    ).toEqual([
      ["own", { status: "unscored", partialScore: null }],
      ["colleague-1", { status: "unscored", partialScore: null }],
      ["colleague-2", { status: "partial", partialScore: 7 }],
    ])
  })

  it("採点方式を加点に変えると、適用のある行がすべて計算し直される", () => {
    const changes = planRubricRecalculation({
      ...SOURCE,
      scoringMethod: "addition",
    })
    // 加点方式で減点の項目だけなら 0 点＝誤答
    expect(changes.map((change) => change.after.status)).toEqual([
      "incorrect",
      "incorrect",
      "incorrect",
      "incorrect",
    ])
  })

  it("points 方式に変えると、項目からは点を決めないので対象は無い", () => {
    expect(
      planRubricRecalculation({ ...SOURCE, scoringMethod: "points" })
    ).toEqual([])
  })

  it("同期の遅れの直しは、自分の行だけを見る", () => {
    const stale = {
      ...SOURCE,
      questionScores: SOURCE.questionScores.map((questionScore) => ({
        ...questionScore,
        partialScore: 1,
      })),
    }
    expect(
      planRubricRecalculation(stale, { scorerUserId: ME }).map(
        (change) => change.questionScoreId
      )
    ).toEqual(["own"])
  })
})

describe("validateRubricItemEffect", () => {
  it.each([
    [
      "adjust に判定がある",
      {
        effectKind: "adjust",
        pointDelta: -1,
        setStatus: "correct",
        setScore: null,
      },
      10,
    ],
    [
      "adjust の加減が無い",
      {
        effectKind: "adjust",
        pointDelta: null,
        setStatus: null,
        setScore: null,
      },
      10,
    ],
    [
      "adjust の加減が 0",
      { effectKind: "adjust", pointDelta: 0, setStatus: null, setScore: null },
      10,
    ],
    [
      "adjust の加減が配点を超える",
      {
        effectKind: "adjust",
        pointDelta: -11,
        setStatus: null,
        setScore: null,
      },
      10,
    ],
    [
      "adjust の加減が 0.01 より細かい",
      {
        effectKind: "adjust",
        pointDelta: -0.005,
        setStatus: null,
        setScore: null,
      },
      10,
    ],
    [
      "配点の無い設問の adjust",
      { effectKind: "adjust", pointDelta: -1, setStatus: null, setScore: null },
      null,
    ],
    [
      "set に加減がある",
      {
        effectKind: "set",
        pointDelta: -1,
        setStatus: "incorrect",
        setScore: null,
      },
      10,
    ],
    [
      "set の判定が unscored",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "unscored",
        setScore: null,
      },
      10,
    ],
    [
      "部分点の点が無い",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "partial",
        setScore: null,
      },
      10,
    ],
    [
      "満点の部分点",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "partial",
        setScore: 10,
      },
      10,
    ],
    [
      "正答に点がある",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "correct",
        setScore: 3,
      },
      10,
    ],
    [
      "配点の無い設問の点",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "pending",
        setScore: 1,
      },
      null,
    ],
    [
      "知らない種類",
      {
        effectKind: "scale",
        pointDelta: null,
        setStatus: null,
        setScore: null,
      },
      10,
    ],
  ])("拒む: %s", (_name, effect, maxPoints) => {
    expect(validateRubricItemEffect(effect, maxPoints).ok).toBe(false)
  })

  it.each([
    [
      "減点",
      {
        effectKind: "adjust",
        pointDelta: -2.5,
        setStatus: null,
        setScore: null,
      },
      10,
    ],
    [
      "加点",
      { effectKind: "adjust", pointDelta: 1, setStatus: null, setScore: null },
      10,
    ],
    [
      "部分点",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "partial",
        setScore: 2,
      },
      10,
    ],
    [
      "点つきの保留",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "pending",
        setScore: 4,
      },
      10,
    ],
    [
      "配点の無い設問の誤答",
      {
        effectKind: "set",
        pointDelta: null,
        setStatus: "incorrect",
        setScore: null,
      },
      null,
    ],
  ])("通す: %s", (_name, effect, maxPoints) => {
    expect(validateRubricItemEffect(effect, maxPoints).ok).toBe(true)
  })
})
