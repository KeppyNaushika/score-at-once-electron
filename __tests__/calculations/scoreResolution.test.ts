/**
 * 有効スコアリゾルバのテスト
 *
 * テスト対象:
 * - resolveEffectiveScores: 確定（ScoreDecision）> 提案合意 > 競合 の決定的解決
 * - calculateEffectiveScoreValue: 有効スコアの得点計算
 */
import { describe, expect, it } from "vitest"

import {
  calculateEffectiveScoreValue,
  type ResolvableQuestionScore,
  type ResolvableScoreDecision,
  resolveEffectiveScores,
} from "@/electron-src/lib/shared/calculations/scoreResolution"
import { toScoringStatus } from "@/types/scoringStatus.types"

// ================== ヘルパー ==================

// リゾルバは「シリアライズ後の行」を受ける。行の全列が揃っている前提なので、
// ヘルパーも Prisma の行と同じ列を全部持つ（欠けた列を作れないようにするため、
// 部分的な形を作らずリゾルバの入力の型で名乗る）。類型は読む側が同梱する。
let seq = 0

function score(
  overrides: Partial<ResolvableQuestionScore> = {}
): ResolvableQuestionScore {
  seq++
  return {
    id: `id-${String(seq).padStart(4, "0")}`,
    examStudentId: "student-1",
    cropRegionId: "region-1",
    status: "correct",
    partialScore: null,
    comment: "",
    userId: "user-1",
    overridesRubric: false,
    scaleLevelId: null,
    scaleLevel: null,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    updatedAt: new Date("2026-06-01T10:00:00Z"),
    ...overrides,
  }
}

function decision(
  overrides: Partial<ResolvableScoreDecision> = {}
): ResolvableScoreDecision {
  return {
    id: "decision-1",
    examStudentId: "student-1",
    cropRegionId: "region-1",
    verdict: "partial",
    score: 5,
    comment: null,
    scaleLevelId: null,
    scaleLevel: null,
    decidedByUserId: "user-1",
    decidedAt: new Date("2026-06-02T10:00:00Z"),
    createdAt: new Date("2026-06-02T10:00:00Z"),
    updatedAt: new Date("2026-06-02T10:00:00Z"),
    ...overrides,
  }
}

const pointsRegion = { points: 10, scoringMethod: "points" }

// リゾルバは行の設問の採点方式を必ず受け取る（方式と合わない採点を未採点として読むため）
const pointsCropRegions = ["region-1", "r1", "r2"].map((cropRegionId) => ({
  id: cropRegionId,
  scoringMethod: "points",
}))
const scaleCropRegions = [{ id: "region-1", scoringMethod: "scale" }]

// ================== resolveEffectiveScores: 提案のみ ==================

describe("resolveEffectiveScores - 提案のみ", () => {
  it("単一の提案はそのまま解決される", () => {
    const scoreRow = score({ status: "correct" })
    const { resolved, conflicts } = resolveEffectiveScores(
      [scoreRow],
      [],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      examStudentId: "student-1",
      cropRegionId: "region-1",
      status: "correct",
      partialScore: null,
      annotationQuestionScoreIds: [scoreRow.id],
      source: "proposal",
      isStale: false,
    })
    expect(conflicts).toEqual([])
  })

  it("生徒×設問ごとに独立して解決される", () => {
    const scoreA = score({ examStudentId: "s1", cropRegionId: "r1" })
    const scoreB = score({ examStudentId: "s1", cropRegionId: "r2" })
    const scoreC = score({ examStudentId: "s2", cropRegionId: "r1" })
    const { resolved, conflicts } = resolveEffectiveScores(
      [scoreA, scoreB, scoreC],
      [],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(3)
    expect(conflicts).toEqual([])
  })

  it("unscored行は採点済み行があれば無視される", () => {
    // 注釈をぶら下げるために用意された行（採点の意思表示ではない）を想定
    const initRow = score({ status: "unscored" })
    const scored = score({ status: "correct" })
    const { resolved, conflicts } = resolveEffectiveScores(
      [initRow, scored],
      [],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0].annotationQuestionScoreIds).toEqual([scored.id])
    expect(conflicts).toEqual([])
  })

  it("全行unscoredなら1件だけ残る", () => {
    const scoreA = score({ status: "unscored" })
    const scoreB = score({ status: "unscored" })
    const { resolved, conflicts } = resolveEffectiveScores(
      [scoreA, scoreB],
      [],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0].status).toBe("unscored")
    expect(conflicts).toEqual([])
  })

  it("複数採点者の判定と点数が一致していれば合意として解決される", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "partial", partialScore: 3 })
    const { resolved, conflicts } = resolveEffectiveScores(
      [teacherA, teacherB],
      [],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0].partialScore).toBe(3)
    expect(conflicts).toEqual([])
  })

  it("点数が一致してもstatusが異なれば競合になる", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "pending", partialScore: 3 })
    const { resolved, conflicts } = resolveEffectiveScores(
      [teacherA, teacherB],
      [],
      pointsCropRegions
    )
    expect(resolved).toEqual([])
    expect(conflicts).toHaveLength(1)
  })

  it("複数採点者の点数が食い違えば競合になり値を出さない", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "partial", partialScore: 7 })
    const { resolved, conflicts } = resolveEffectiveScores(
      [teacherA, teacherB],
      [],
      pointsCropRegions
    )
    expect(resolved).toEqual([])
    expect(conflicts).toEqual([
      {
        examStudentId: "student-1",
        cropRegionId: "region-1",
        candidateCount: 2,
      },
    ])
  })

  it("updatedAtが同時刻ならidで決定的に選択される", () => {
    const timestamp = new Date("2026-06-01T10:00:00Z")
    const scoreA = score({
      id: "id-aaa",
      status: "correct",
      updatedAt: timestamp,
    })
    const scoreB = score({
      id: "id-zzz",
      status: "correct",
      updatedAt: timestamp,
    })
    const result1 = resolveEffectiveScores(
      [scoreA, scoreB],
      [],
      pointsCropRegions
    )
    const result2 = resolveEffectiveScores(
      [scoreB, scoreA],
      [],
      pointsCropRegions
    )
    expect(result1.resolved[0].annotationQuestionScoreIds).toEqual(["id-zzz"])
    expect(result2.resolved[0].annotationQuestionScoreIds).toEqual(["id-zzz"])
  })

  // 行を作る側（`toSerializedQuestionScore`）は、DB の判定の文字列を `toScoringStatus` で
  // 7値へ絞る。判定を `string` で受けていた頃は、得点化が想定外の値を黙って0点にしており、
  // 欠測であるべきものが成績に0点として算入されていた。想定外の値は未採点に倒し、
  // 欠測（null）として扱うことを固定する
  it("想定外の判定の文字列は未採点に倒し、0点ではなく欠測として扱う", () => {
    const unknownStatusRow = score({
      status: toScoringStatus("not-a-scoring-status"),
      partialScore: 5,
    })
    const { resolved, conflicts } = resolveEffectiveScores(
      [unknownStatusRow],
      [],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0].status).toBe("unscored")
    expect(conflicts).toEqual([])
    expect(calculateEffectiveScoreValue(resolved[0], pointsRegion)).toBeNull()
  })
})

// ================== resolveEffectiveScores: 確定あり ==================

describe("resolveEffectiveScores - 確定（ScoreDecision）", () => {
  it("確定があれば提案の食い違いに関わらず確定が採用される", () => {
    const teacherA = score({ status: "partial", partialScore: 3 })
    const teacherB = score({ status: "partial", partialScore: 7 })
    const decisionRow = decision({ verdict: "partial", score: 5 })
    const { resolved, conflicts } = resolveEffectiveScores(
      [teacherA, teacherB],
      [decisionRow],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      status: "partial",
      partialScore: 5,
      source: "decision",
    })
    // 確定済みセルは競合として報告しない
    expect(conflicts).toEqual([])
  })

  it("提案が無いセルの確定も解決される", () => {
    const decisionRow = decision()
    const { resolved } = resolveEffectiveScores(
      [],
      [decisionRow],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0].source).toBe("decision")
    expect(resolved[0].annotationQuestionScoreIds).toEqual([])
  })

  it("確定したセルの注釈は、そのセルの全採点行から引く（採用元は記録していない）", () => {
    // 2人が同じ「正答」を出していたら、どちらを採ったのかは決まらない。
    // よって印刷する注釈も絞れず、当面すべて表示する
    const teacherA = score({ id: "qs-a", userId: "user-a", status: "correct" })
    const teacherB = score({ id: "qs-b", userId: "user-b", status: "correct" })
    const decisionRow = decision({ verdict: "correct", score: null })
    const { resolved } = resolveEffectiveScores(
      [teacherA, teacherB],
      [decisionRow],
      pointsCropRegions
    )
    expect(resolved[0].annotationQuestionScoreIds).toEqual(["qs-a", "qs-b"])
  })

  it("確定より新しい提案があればisStaleが立つ", () => {
    const newer = score({
      status: "partial",
      partialScore: 9,
      updatedAt: new Date("2026-06-03T10:00:00Z"),
    })
    const decisionRow = decision({
      decidedAt: new Date("2026-06-02T10:00:00Z"),
    })
    const { resolved } = resolveEffectiveScores(
      [newer],
      [decisionRow],
      pointsCropRegions
    )
    expect(resolved[0].isStale).toBe(true)
    // 値は確定のまま
    expect(resolved[0].partialScore).toBe(5)
  })

  it("確定より古い提案しか無ければisStaleは立たない", () => {
    const older = score({
      status: "partial",
      partialScore: 3,
      updatedAt: new Date("2026-06-01T10:00:00Z"),
    })
    const decisionRow = decision({
      decidedAt: new Date("2026-06-02T10:00:00Z"),
    })
    const { resolved } = resolveEffectiveScores(
      [older],
      [decisionRow],
      pointsCropRegions
    )
    expect(resolved[0].isStale).toBe(false)
  })

  it("確定の無い他のセルは通常通り解決される", () => {
    const decided = score({ cropRegionId: "r1", status: "correct" })
    const undecided = score({ cropRegionId: "r2", status: "incorrect" })
    const decisionRow = decision({ cropRegionId: "r1" })
    const { resolved } = resolveEffectiveScores(
      [decided, undecided],
      [decisionRow],
      pointsCropRegions
    )
    expect(resolved).toHaveLength(2)
    const region2Score = resolved.find(
      (resolvedScore) => resolvedScore.cropRegionId === "r2"
    )
    expect(region2Score?.source).toBe("proposal")
    expect(region2Score?.status).toBe("incorrect")
  })
})

// ================== resolveEffectiveScores: 類型評価 ==================

describe("resolveEffectiveScores - 類型評価", () => {
  const levelA = { label: "A", score: 10 }

  it("付けた類型を有効スコアへ運ぶ", () => {
    const scoreRow = score({
      status: "evaluated",
      scaleLevelId: "level-a",
      scaleLevel: levelA,
    })
    const { resolved } = resolveEffectiveScores(
      [scoreRow],
      [],
      scaleCropRegions
    )
    expect(resolved[0]).toMatchObject({
      status: "evaluated",
      scaleLevelId: "level-a",
      scaleLevel: levelA,
    })
  })

  it("同じ類型なら合意、類型が違えば点数が同じでも競合", () => {
    const agreed = resolveEffectiveScores(
      [
        score({
          status: "evaluated",
          scaleLevelId: "level-a",
          scaleLevel: levelA,
        }),
        score({
          status: "evaluated",
          scaleLevelId: "level-a",
          scaleLevel: levelA,
        }),
      ],
      [],
      scaleCropRegions
    )
    expect(agreed.conflicts).toEqual([])
    expect(agreed.resolved[0].scaleLevel).toEqual(levelA)

    const disagreed = resolveEffectiveScores(
      [
        score({
          status: "evaluated",
          scaleLevelId: "level-a",
          scaleLevel: levelA,
        }),
        score({
          status: "evaluated",
          scaleLevelId: "level-s",
          scaleLevel: { label: "S", score: 10 },
        }),
      ],
      [],
      scaleCropRegions
    )
    expect(disagreed.resolved).toEqual([])
    expect(disagreed.conflicts).toHaveLength(1)
  })

  it("確定の類型も有効スコアへ運ぶ", () => {
    const { resolved } = resolveEffectiveScores(
      [],
      [
        decision({
          verdict: "evaluated",
          score: null,
          scaleLevelId: "level-a",
          scaleLevel: levelA,
        }),
      ],
      scaleCropRegions
    )
    expect(resolved[0]).toMatchObject({
      source: "decision",
      scaleLevelId: "level-a",
      scaleLevel: levelA,
    })
  })
})

// ================== resolveEffectiveScores: 方式と合わない採点 ==================

// 方式と合わない採点（類型評価の設問の ○×△、点数の設問の類型）は DB に残るだけで、
// 未採点と同じに読む。方式を戻せば元の採点として表に出る（docs/vlm-grading-design.md §4-8-8）
describe("resolveEffectiveScores - 方式と合わない採点", () => {
  const levelA = { label: "A", score: 10 }

  it("方式と合わない提案だけなら未採点として解決される（点数・類型も空）", () => {
    const pointVerdict = score({ status: "partial", partialScore: 3 })
    const { resolved, conflicts } = resolveEffectiveScores(
      [pointVerdict],
      [],
      scaleCropRegions
    )
    expect(conflicts).toEqual([])
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      status: "unscored",
      partialScore: null,
      scaleLevelId: null,
      scaleLevel: null,
      source: "proposal",
    })
  })

  it("点数の設問に付いた類型も未採点として読む", () => {
    const evaluated = score({
      status: "evaluated",
      scaleLevelId: "level-a",
      scaleLevel: levelA,
    })
    const { resolved } = resolveEffectiveScores(
      [evaluated],
      [],
      pointsCropRegions
    )
    expect(resolved[0]).toMatchObject({
      status: "unscored",
      scaleLevelId: null,
      scaleLevel: null,
    })
  })

  it("合う提案と並べても競合にならず、合う提案が採用される", () => {
    const pointVerdict = score({ status: "correct", userId: "user-a" })
    const evaluated = score({
      status: "evaluated",
      userId: "user-b",
      scaleLevelId: "level-a",
      scaleLevel: levelA,
    })
    const { resolved, conflicts } = resolveEffectiveScores(
      [pointVerdict, evaluated],
      [],
      scaleCropRegions
    )
    expect(conflicts).toEqual([])
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      status: "evaluated",
      scaleLevel: levelA,
      annotationQuestionScoreIds: [evaluated.id],
    })

    // 方式を戻すと、今度は類型の行が読まれなくなり、元の正答が採用される
    const switchedBack = resolveEffectiveScores(
      [pointVerdict, evaluated],
      [],
      pointsCropRegions
    )
    expect(switchedBack.conflicts).toEqual([])
    expect(switchedBack.resolved[0]).toMatchObject({
      status: "correct",
      annotationQuestionScoreIds: [pointVerdict.id],
    })
  })

  it("方式と合わない確定は無かったものとして読み、セルは提案から解決する。方式を戻せば確定がまた勝つ", () => {
    const evaluated = score({
      status: "evaluated",
      scaleLevelId: "level-a",
      scaleLevel: levelA,
      updatedAt: new Date("2026-06-03T10:00:00Z"),
    })
    const pointDecision = decision({ verdict: "partial", score: 5 })

    const onScale = resolveEffectiveScores(
      [evaluated],
      [pointDecision],
      scaleCropRegions
    )
    expect(onScale.resolved).toHaveLength(1)
    expect(onScale.resolved[0]).toMatchObject({
      source: "proposal",
      status: "evaluated",
      scaleLevel: levelA,
      isStale: false,
    })

    const onPoints = resolveEffectiveScores(
      [evaluated],
      [pointDecision],
      pointsCropRegions
    )
    expect(onPoints.resolved).toHaveLength(1)
    expect(onPoints.resolved[0]).toMatchObject({
      source: "decision",
      status: "partial",
      partialScore: 5,
      // 類型の提案は点数の設問では採点として読まないので、確定より新しくても stale にしない
      isStale: false,
    })
  })

  it("方式と合わない確定しか無いセルは解決結果に現れない", () => {
    const { resolved, conflicts } = resolveEffectiveScores(
      [],
      [decision({ verdict: "correct", score: null })],
      scaleCropRegions
    )
    expect(resolved).toEqual([])
    expect(conflicts).toEqual([])
  })

  it("設問の採点方式が渡されていない行は黙って読まずに止める", () => {
    expect(() =>
      resolveEffectiveScores([score({ cropRegionId: "missing" })], [], [])
    ).toThrow()
  })
})

// ================== calculateEffectiveScoreValue ==================

describe("calculateEffectiveScoreValue", () => {
  it("correctは満点を返す", () => {
    expect(
      calculateEffectiveScoreValue(
        { status: "correct", partialScore: null, scaleLevel: null },
        pointsRegion
      )
    ).toBe(10)
  })

  it("incorrect/no_answer/double_markは0を返す", () => {
    const zeroStatuses = ["incorrect", "no_answer", "double_mark"] as const
    for (const status of zeroStatuses) {
      expect(
        calculateEffectiveScoreValue(
          { status, partialScore: null, scaleLevel: null },
          pointsRegion
        )
      ).toBe(0)
    }
  })

  it("unscoredはnullを返す", () => {
    expect(
      calculateEffectiveScoreValue(
        { status: "unscored", partialScore: null, scaleLevel: null },
        pointsRegion
      )
    ).toBeNull()
  })

  it("partial/pendingはpartialScoreを返す", () => {
    expect(
      calculateEffectiveScoreValue(
        { status: "partial", partialScore: 3, scaleLevel: null },
        pointsRegion
      )
    ).toBe(3)
    expect(
      calculateEffectiveScoreValue(
        { status: "pending", partialScore: 6, scaleLevel: null },
        pointsRegion
      )
    ).toBe(6)
  })
})
