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
  {
    id: "gi-knowledge",
    name: "知識・技能",
    order: 0,
    dataSources: [],
    boundaries: [],
  },
  {
    id: "gi-thinking",
    name: "思考・判断・表現",
    order: 1,
    dataSources: [],
    boundaries: [],
  },
  {
    id: "gi-attitude",
    name: "態度",
    order: 2,
    dataSources: [],
    boundaries: [],
  },
]

/** 観点3つのラベルから生徒結果を作る */
function makeStudent(
  id: string,
  labels: [string, string, string]
): StudentGradeResult {
  return {
    gradeStudentId: `gs:${id}`,
    studentId: id,
    studentNumber: id,
    lastName: id,
    firstName: "",
    attendanceNumber: null,
    className: null,
    gradeItemResults: GRADE_ITEMS.map((gradeItem, i) => ({
      gradeItemId: gradeItem.id,
      gradeItemName: gradeItem.name,
      isExcluded: false,
      isAllMissing: false,
      sourceScores: [],
      weightedScore: 1,
      weightedMaxScore: 1,
      percentage: 50,
      gradeLabel: labels[i],
      originalGradeLabel: labels[i],
      overrideGradeLabel: null,
      frozen: null,
    })),
  }
}

function makeResult(students: StudentGradeResult[]): GradeCalculationResult {
  return {
    gradeId: "g1",
    gradeName: "テスト成績",
    classNames: [],
    gradeItems: GRADE_ITEMS,
    students,
  }
}

/**
 * 違反した生徒の id 一覧。
 *
 * 違反は「その成績の対象者」（GradeStudent）でキーされるので、テストの可読性のため
 * 人の id へ1段戻す。対象者 id と人の id が食い違っていれば空になり露見する。
 */
function violatedIds(
  result: GradeCalculationResult,
  constraints: GradeConstraintData[]
): string[] {
  const { violations } = evaluateConstraints(result, constraints)
  return result.students
    .filter((student) => violations.has(student.gradeStudentId))
    .map((student) => student.studentId)
    .sort()
}

const baseConstraint: Omit<GradeConstraintData, "kind" | "expression"> = {
  id: "c1",
  gradeId: "g1",
  name: "ルール",
  color: "#fecaca",
  message: null,
  enabled: true,
  order: 0,
  targetGradeItemId: null,
  aggregate: "average",
  tolerance: 1,
  disabledReason: null,
  viewpoints: [],
  labelValues: [],
  exclusionLabels: [],
}

/** 集計対象の観点行（idは決定論的な合成キー） */
function viewpointRows(
  constraintId: string,
  gradeItemIds: string[]
): GradeConstraintData["viewpoints"] {
  return gradeItemIds.map((gradeItemId, index) => ({
    id: `${constraintId}:${gradeItemId}`,
    gradeItemId,
    order: index,
  }))
}

/** ラベル→数値の対応行 */
function labelValueRows(
  constraintId: string,
  labelValues: Record<string, number>
): GradeConstraintData["labelValues"] {
  return Object.entries(labelValues).map(([label, value], index) => ({
    id: `${constraintId}:${label}`,
    label,
    value,
    order: index,
  }))
}

/** 混在禁止ラベル行 */
function exclusionLabelRows(
  constraintId: string,
  labels: string[]
): GradeConstraintData["exclusionLabels"] {
  return labels.map((label, index) => ({
    id: `${constraintId}:${label}`,
    label,
    order: index,
  }))
}

describe("gradeConstraints: 整合ルール（評定は独立したGradeItem）", () => {
  // 実データ構成: 知識・技能/思考・判断・表現/態度(A/B/C) + 評定(5..1) の4項目。
  // すべて GradeItem 同士の比較。評定 GradeItem を比較先にする。
  const HYOTEI_BOUNDARIES = [
    { label: "5", minPercentage: 80 },
    { label: "4", minPercentage: 65 },
    { label: "3", minPercentage: 50 },
    { label: "2", minPercentage: 35 },
    { label: "1", minPercentage: 0 },
  ]

  const ITEMS_WITH_HYOTEI = [
    {
      id: "gi-k",
      name: "知識・技能",
      order: 0,
      dataSources: [],
      boundaries: [],
    },
    {
      id: "gi-s",
      name: "思考・判断・表現",
      order: 1,
      dataSources: [],
      boundaries: [],
    },
    { id: "gi-a", name: "態度", order: 2, dataSources: [], boundaries: [] },
    {
      id: "gi-h",
      name: "評定",
      order: 3,
      dataSources: [],
      boundaries: HYOTEI_BOUNDARIES,
    },
  ]

  function makeStudent4(
    id: string,
    knowledge: string,
    thinking: string,
    attitude: string,
    hyotei: string
  ): StudentGradeResult {
    const labels: Record<string, string> = {
      "gi-k": knowledge,
      "gi-s": thinking,
      "gi-a": attitude,
      "gi-h": hyotei,
    }
    return {
      gradeStudentId: `gs:${id}`,
      studentId: id,
      studentNumber: id,
      lastName: id,
      firstName: "",
      attendanceNumber: null,
      className: null,
      gradeItemResults: ITEMS_WITH_HYOTEI.map((gradeItem) => ({
        gradeItemId: gradeItem.id,
        gradeItemName: gradeItem.name,
        isExcluded: false,
        isAllMissing: false,
        sourceScores: [],
        weightedScore: 1,
        weightedMaxScore: 1,
        percentage: 50,
        gradeLabel: labels[gradeItem.id],
        originalGradeLabel: labels[gradeItem.id],
        overrideGradeLabel: null,
        frozen: null,
      })),
    }
  }

  function makeResult4(students: StudentGradeResult[]): GradeCalculationResult {
    return {
      gradeId: "g1",
      gradeName: "1学期末評定",
      classNames: [],
      gradeItems: ITEMS_WITH_HYOTEI,
      students,
    }
  }

  const consistencyTargetItem: GradeConstraintData = {
    ...baseConstraint,
    kind: "consistency",
    targetGradeItemId: "gi-h",
    aggregate: "average",
    tolerance: 1,
    viewpoints: viewpointRows("c1", ["gi-k", "gi-s", "gi-a"]),
    labelValues: labelValueRows("c1", { A: 5, B: 3, C: 1 }),
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
    exclusionLabels: exclusionLabelRows("c1", ["A", "C"]),
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
      exclusionLabels: exclusionLabelRows("c1", ["A", "C"]),
      expression: "",
      enabled: false,
    }
    const result = makeResult([makeStudent("mix", ["A", "B", "C"])])
    expect(violatedIds(result, [disabled])).toEqual([])
  })

  it("整合ルールの比較先が未選択なら無言失火せずエラーになる", () => {
    const noTarget: GradeConstraintData = {
      ...baseConstraint,
      kind: "consistency",
      targetGradeItemId: null,
      labelValues: labelValueRows("c1", { A: 5, B: 3, C: 1 }),
      expression: "",
    }
    const result = makeResult([makeStudent("s", ["A", "A", "A"])])
    const { violations, errors } = evaluateConstraints(result, [noTarget])
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("未選択")
  })

  it("整合ルールの比較先が算出対象に無ければエラーになる", () => {
    const badTarget: GradeConstraintData = {
      ...baseConstraint,
      kind: "consistency",
      targetGradeItemId: "gi-missing", // makeResult の3項目には存在しない
      labelValues: labelValueRows("c1", { A: 5, B: 3, C: 1 }),
      expression: "",
    }
    const result = makeResult([makeStudent("s", ["A", "A", "A"])])
    const { violations, errors } = evaluateConstraints(result, [badTarget])
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("見つかりません")
  })
})

describe("gradeConstraints: 参照はidで持つ（issue #1063）", () => {
  /** 弱→強が C, B, A になる境界。順位換算（A/B/C → 3/2/1）の検証に使う */
  const RANK_BOUNDARIES = [
    { label: "C", minPercentage: 0 },
    { label: "B", minPercentage: 50 },
    { label: "A", minPercentage: 80 },
  ]

  /** 評定を含む3項目。名前と境界は呼び出し側から差し替えられる */
  function makeItems(
    knowledgeName: string,
    boundaries: { label: string; minPercentage: number }[] = []
  ) {
    return [
      {
        id: "gi-k",
        name: knowledgeName,
        order: 0,
        dataSources: [],
        boundaries,
      },
      {
        id: "gi-s",
        name: "思考・判断・表現",
        order: 1,
        dataSources: [],
        boundaries,
      },
      { id: "gi-h", name: "評定", order: 2, dataSources: [], boundaries },
    ]
  }

  function makeStudentFor(
    items: ReturnType<typeof makeItems>,
    labels: Record<string, string>
  ): StudentGradeResult {
    return {
      gradeStudentId: "gs:s1",
      studentId: "s1",
      studentNumber: "s1",
      lastName: "s1",
      firstName: "",
      attendanceNumber: null,
      className: null,
      gradeItemResults: items.map((gradeItem) => ({
        gradeItemId: gradeItem.id,
        gradeItemName: gradeItem.name,
        isExcluded: false,
        isAllMissing: false,
        sourceScores: [],
        weightedScore: 1,
        weightedMaxScore: 1,
        percentage: 50,
        gradeLabel: labels[gradeItem.id],
        originalGradeLabel: labels[gradeItem.id],
        overrideGradeLabel: null,
        frozen: null,
      })),
    }
  }

  const consistency: GradeConstraintData = {
    ...baseConstraint,
    kind: "consistency",
    targetGradeItemId: "gi-h",
    aggregate: "average",
    tolerance: 1,
    viewpoints: viewpointRows("c1", ["gi-k", "gi-s"]),
    labelValues: labelValueRows("c1", { A: 5, B: 3, C: 1, "5": 5, "3": 3 }),
    expression: "",
  }

  // 旧実装は評価項目を名前で照合していたため、リネームすると比較先も集計対象も
  // 見失い、黙って「違反なし」に化けていた。idで持てば名前は判定に関与しない。
  it("評価項目をリネームしても判定は変わらない", () => {
    const violatingLabels = { "gi-k": "A", "gi-s": "A", "gi-h": "3" }

    const before = makeItems("知識・技能")
    const beforeResult: GradeCalculationResult = {
      gradeId: "g1",
      gradeName: "1学期",
      classNames: [],
      gradeItems: before,
      students: [makeStudentFor(before, violatingLabels)],
    }

    const after = makeItems("知識・技能（改称）")
    const afterResult: GradeCalculationResult = {
      ...beforeResult,
      gradeItems: after,
      students: [makeStudentFor(after, violatingLabels)],
    }

    // 観点平均5・評定3で乖離2 > 許容1 → どちらも違反として検出される
    expect(violatedIds(beforeResult, [consistency])).toEqual(["s1"])
    expect(violatedIds(afterResult, [consistency])).toEqual(["s1"])
    expect(evaluateConstraints(afterResult, [consistency]).errors.size).toBe(0)
  })

  it("集計対象の観点が算出対象から消えたら無言失火せずエラーになる", () => {
    const items = makeItems("知識・技能")
    const result: GradeCalculationResult = {
      gradeId: "g1",
      gradeName: "1学期",
      classNames: [],
      gradeItems: items,
      students: [
        makeStudentFor(items, { "gi-k": "A", "gi-s": "A", "gi-h": "3" }),
      ],
    }
    const withMissingViewpoint: GradeConstraintData = {
      ...consistency,
      viewpoints: viewpointRows("c1", ["gi-k", "gi-gone"]),
    }

    const { violations, errors } = evaluateConstraints(result, [
      withMissingViewpoint,
    ])
    // 残った観点だけで判定を続けると平均が変わり別の判定に化けるため、着色せず知らせる
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("見つかりません")
  })

  // 旧実装は境界を項目名で引いていた。id引きへ移す際に式評価側の参照を直し忘れると、
  // A/B/C の順位換算が効かなくなり item()/mean() が NaN になる。
  // 既存テストが評定に数値ラベル "5" を使っていたため素通りしていた。
  it("式ルールが非数値ラベル(A/B/C)を順位へ換算できる", () => {
    // 弱→強が C, B, A なので C は順位1
    const items = makeItems("知識・技能", RANK_BOUNDARIES)
    const result: GradeCalculationResult = {
      gradeId: "g1",
      gradeName: "1学期",
      classNames: [],
      gradeItems: items,
      students: [
        makeStudentFor(items, { "gi-k": "C", "gi-s": "A", "gi-h": "A" }),
      ],
    }
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      expression: 'item("知識・技能") == 1',
      viewpoints: [],
    }

    const { errors } = evaluateConstraints(result, [expr])
    expect(errors.size).toBe(0)
    expect(violatedIds(result, [expr])).toEqual(["s1"])
  })

  it("式ルールの mean() が非数値ラベルを集計できる", () => {
    const items = makeItems("知識・技能", RANK_BOUNDARIES)
    const result: GradeCalculationResult = {
      gradeId: "g1",
      gradeName: "1学期",
      classNames: [],
      gradeItems: items,
      students: [
        makeStudentFor(items, { "gi-k": "A", "gi-s": "A", "gi-h": "C" }),
      ],
    }
    // 観点平均3(=A) と評定1(=C) の乖離2 > 1
    const expr: GradeConstraintData = {
      ...baseConstraint,
      kind: "expression",
      expression:
        'abs(item("評定") - mean("知識・技能", "思考・判断・表現")) > 1',
      viewpoints: [],
    }

    const { errors } = evaluateConstraints(result, [expr])
    expect(errors.size).toBe(0)
    expect(violatedIds(result, [expr])).toEqual(["s1"])
  })

  it("混在禁止ラベルが1つ以下なら無言失火せずエラーになる", () => {
    const singleLabel: GradeConstraintData = {
      ...baseConstraint,
      kind: "mutual_exclusion",
      exclusionLabels: exclusionLabelRows("c1", ["A"]),
      expression: "",
    }
    const result = makeResult([makeStudent("mix", ["A", "B", "C"])])
    const { violations, errors } = evaluateConstraints(result, [singleLabel])
    expect(violations.size).toBe(0)
    expect(errors.get("c1")).toContain("2つ以上")
  })
})
