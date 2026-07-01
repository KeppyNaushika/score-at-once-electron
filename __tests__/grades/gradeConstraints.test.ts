/**
 * 観点間の制約ルール評価（src/lib/gradeConstraints.ts）の単体テスト
 *
 * 校内ルール例（3観点 A/B/C, 評定1〜5）を、整合ルール・混在禁止・式で表現し、
 * 不適切な組合せの生徒だけが違反として検出されることを検証する。
 */

import { describe, expect, it } from "vitest"

import {
  evaluateConstraints,
  validateConstraintExpression,
} from "@/lib/gradeConstraints"
import type {
  GradeCalculationResult,
  GradeConstraintData,
  StudentGradeResult,
} from "@/types/grade.types"

const GRADE_ITEMS = [
  { id: "gi-knowledge", name: "知識・技能", order: 0 },
  { id: "gi-thinking", name: "思考・判断・表現", order: 1 },
  { id: "gi-attitude", name: "態度", order: 2 },
]

/** 観点3つのラベルから生徒結果を作る */
function makeStudent(
  id: string,
  labels: [string, string, string]
): StudentGradeResult {
  return {
    studentId: id,
    studentNumber: id,
    lastName: id,
    firstName: "",
    attendanceNumber: null,
    className: null,
    gradeItemResults: GRADE_ITEMS.map((gi, i) => ({
      gradeItemId: gi.id,
      gradeItemName: gi.name,
      isExcluded: false,
      isAllMissing: false,
      sourceScores: [],
      weightedScore: 1,
      weightedMaxScore: 1,
      percentage: 50,
      gradeLabel: labels[i],
      originalGradeLabel: labels[i],
      overrideGradeLabel: null,
    })),
    overallScore: null,
    overallMaxScore: 0,
    overallPercentage: null,
    overallGradeLabel: null,
    originalOverallGradeLabel: null,
    overrideOverallGradeLabel: null,
  }
}

function makeResult(students: StudentGradeResult[]): GradeCalculationResult {
  return {
    gradeId: "g1",
    gradeName: "テスト成績",
    classNames: [],
    gradeItems: GRADE_ITEMS,
    students,
    boundarySets: [],
  }
}

function violatedIds(
  result: GradeCalculationResult,
  constraints: GradeConstraintData[]
): string[] {
  const { violations } = evaluateConstraints(result, constraints)
  return [...violations.keys()].sort()
}

const baseConstraint: Omit<
  GradeConstraintData,
  "kind" | "config" | "expression"
> = {
  id: "c1",
  gradeId: "g1",
  name: "ルール",
  color: "#fecaca",
  message: null,
  enabled: true,
  order: 0,
}

describe("gradeConstraints: 整合ルール（評定は独立したGradeItem）", () => {
  // 実データ構成: 知識・技能/思考・判断・表現/態度(A/B/C) + 評定(5..1) の4項目。
  // すべて GradeItem 同士の比較。評定 GradeItem を比較先にする。
  const ITEMS_WITH_HYOTEI = [
    { id: "gi-k", name: "知識・技能", order: 0 },
    { id: "gi-s", name: "思考・判断・表現", order: 1 },
    { id: "gi-a", name: "態度", order: 2 },
    { id: "gi-h", name: "評定", order: 3 },
  ]

  function makeStudent4(
    id: string,
    k: string,
    s: string,
    a: string,
    hyotei: string
  ): StudentGradeResult {
    const labels: Record<string, string> = {
      "gi-k": k,
      "gi-s": s,
      "gi-a": a,
      "gi-h": hyotei,
    }
    return {
      studentId: id,
      studentNumber: id,
      lastName: id,
      firstName: "",
      attendanceNumber: null,
      className: null,
      gradeItemResults: ITEMS_WITH_HYOTEI.map((gi) => ({
        gradeItemId: gi.id,
        gradeItemName: gi.name,
        isExcluded: false,
        isAllMissing: false,
        sourceScores: [],
        weightedScore: 1,
        weightedMaxScore: 1,
        percentage: 50,
        gradeLabel: labels[gi.id],
        originalGradeLabel: labels[gi.id],
        overrideGradeLabel: null,
      })),
      overallScore: null,
      overallMaxScore: 1,
      overallPercentage: null,
      overallGradeLabel: null, // overall は未設定
      originalOverallGradeLabel: null,
      overrideOverallGradeLabel: null,
    }
  }

  function makeResult4(students: StudentGradeResult[]): GradeCalculationResult {
    return {
      gradeId: "g1",
      gradeName: "1学期末評定",
      classNames: [],
      gradeItems: ITEMS_WITH_HYOTEI,
      students,
      boundarySets: [
        {
          targetType: "grade_item",
          gradeItemId: "gi-h",
          boundaries: [
            { label: "5", minPercentage: 80 },
            { label: "4", minPercentage: 65 },
            { label: "3", minPercentage: 50 },
            { label: "2", minPercentage: 35 },
            { label: "1", minPercentage: 0 },
          ],
        },
      ],
    }
  }

  const consistencyTargetItem: GradeConstraintData = {
    ...baseConstraint,
    kind: "consistency",
    config: JSON.stringify({
      labelValues: { A: 5, B: 3, C: 1 },
      aggregate: "average",
      tolerance: 1,
      target: "評定",
      viewpointItems: ["知識・技能", "思考・判断・表現", "態度"],
    }),
    expression: "",
  }

  it("評定項目と3観点平均の乖離が許容超の生徒だけ違反になる", () => {
    const result = makeResult4([
      makeStudent4("aaa-5", "A", "A", "A", "5"), // 平均5, 評定5 → OK
      makeStudent4("bbb-3", "B", "B", "B", "3"), // 平均3, 評定3 → OK
      makeStudent4("aaa-3", "A", "A", "A", "3"), // 平均5, 評定3 → 乖離2 違反
    ])
    expect(violatedIds(result, [consistencyTargetItem])).toEqual(["aaa-3"])
  })

  it('式で item("評定") と label(観点) を項目名で参照できる', () => {
    // 評定5なのに観点にCがある生徒を検出（スケール非依存の判定）
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      config: "{}",
      expression: 'item("評定") == 5 and has("C")',
    }
    const result = makeResult4([
      makeStudent4("ok", "A", "A", "A", "5"), // 評定5, Cなし → OK
      makeStudent4("bad", "A", "A", "C", "5"), // 評定5なのにC → 違反
    ])
    expect(violatedIds(result, [expr])).toEqual(["bad"])
  })
})

describe("gradeConstraints: 混在禁止（mutual_exclusion）", () => {
  const exclusion: GradeConstraintData = {
    ...baseConstraint,
    kind: "mutual_exclusion",
    config: JSON.stringify({ labels: ["A", "C"] }),
    expression: "",
  }

  it("AとCが混在する生徒だけ違反になる", () => {
    const result = makeResult([
      makeStudent("mix", ["A", "B", "C"]),
      makeStudent("pure-ab", ["A", "A", "B"]),
      makeStudent("pure-bc", ["B", "B", "C"]),
    ])
    expect(violatedIds(result, [exclusion])).toEqual(["mix"])
  })
})

describe("gradeConstraints: 式（expression）", () => {
  it('has("A") and has("C") で A・C混在を検出できる', () => {
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      config: "{}",
      expression: 'has("A") and has("C")',
    }
    const result = makeResult([
      makeStudent("mix", ["A", "B", "C"]),
      makeStudent("nomix", ["A", "A", "B"]),
    ])
    expect(violatedIds(result, [expr])).toEqual(["mix"])
  })

  it('label("態度") で特定観点を参照できる', () => {
    // 態度Aだが知識・技能がC（観点間の不整合）を検出
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      config: "{}",
      expression: 'label("態度") == "A" and label("知識・技能") == "C"',
    }
    const result = makeResult([
      makeStudent("bad", ["C", "C", "A"]), // 知識C・態度A
      makeStudent("ok", ["A", "A", "A"]),
    ])
    expect(violatedIds(result, [expr])).toEqual(["bad"])
  })

  it("不正な式は違反を出さずエラーとして扱う", () => {
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      config: "{}",
      expression: "has(", // 構文エラー
    }
    const result = makeResult([makeStudent("s", ["A", "B", "C"])])
    const { violations, errors } = evaluateConstraints(result, [expr])
    expect(violations.size).toBe(0)
    expect(errors.has("c1")).toBe(true)
  })

  it("存在しない項目名を参照する式は無言失火せずエラーになる", () => {
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      config: "{}",
      // 「知識・技能」の・抜け（タイプミス）
      expression: 'item("知識技能") < 3',
    }
    const result = makeResult([makeStudent("s", ["C", "B", "A"])])
    const { violations, errors } = evaluateConstraints(result, [expr])
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("知識技能")
  })
})

describe("gradeConstraints: 補助", () => {
  it("validateConstraintExpression は妥当な式に null を返す", () => {
    expect(validateConstraintExpression('has("A") and has("C")')).toBeNull()
    expect(
      validateConstraintExpression('abs(item("評定") - mean()) > 1')
    ).toBeNull()
  })

  it("validateConstraintExpression は不正な式にメッセージを返す", () => {
    expect(validateConstraintExpression("has(")).not.toBeNull()
    expect(validateConstraintExpression("")).not.toBeNull()
  })

  it("無効化されたルールは評価されない", () => {
    const disabled: GradeConstraintData = {
      ...baseConstraint,
      kind: "mutual_exclusion",
      config: JSON.stringify({ labels: ["A", "C"] }),
      expression: "",
      enabled: false,
    }
    const result = makeResult([makeStudent("mix", ["A", "B", "C"])])
    expect(violatedIds(result, [disabled])).toEqual([])
  })

  it("整合ルールの比較先(target)が未選択なら無言失火せずエラーになる", () => {
    const noTarget: GradeConstraintData = {
      ...baseConstraint,
      kind: "consistency",
      config: JSON.stringify({
        labelValues: { A: 5, B: 3, C: 1 },
        aggregate: "average",
        tolerance: 1,
        target: "",
      }),
      expression: "",
    }
    const result = makeResult([makeStudent("s", ["A", "A", "A"])])
    const { violations, errors } = evaluateConstraints(result, [noTarget])
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("未選択")
  })

  it("整合ルールの比較先(target)が実在しない項目ならエラーになる", () => {
    const badTarget: GradeConstraintData = {
      ...baseConstraint,
      kind: "consistency",
      config: JSON.stringify({
        labelValues: { A: 5, B: 3, C: 1 },
        aggregate: "average",
        tolerance: 1,
        target: "評定", // makeResult の3項目には存在しない
      }),
      expression: "",
    }
    const result = makeResult([makeStudent("s", ["A", "A", "A"])])
    const { violations, errors } = evaluateConstraints(result, [badTarget])
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("評定")
  })
})
