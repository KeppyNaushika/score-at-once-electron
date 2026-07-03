/**
 * 観点間の制約ルール評価
 *
 * 成績算出結果（GradeCalculationResult）に対して、Grade個別に定義された制約ルールを
 * 適用し、各生徒がどのルールに違反しているかを算出する。DB・算出ロジックには非干渉の
 * 純粋関数。結果表（06-results）の行着色と、境界設定（05-boundaries）のライブプレビュー
 * の両方で使用する。
 */

import { Parser, type Value } from "expr-eval"

import type {
  ConsistencyConfig,
  ConstraintViolation,
  GradeCalculationResult,
  GradeConstraintData,
  MutualExclusionConfig,
  StudentGradeResult,
} from "@/types/grade.types"

/** 整合ルールの既定設定（Excel流: A=5, B=3, C=1 の平均、許容±1）。target は項目選択時に設定 */
export const DEFAULT_CONSISTENCY_CONFIG: ConsistencyConfig = {
  labelValues: { A: 5, B: 3, C: 1 },
  aggregate: "average",
  tolerance: 1,
  target: "",
}

/** 混在禁止ルールの既定設定（A・C混在禁止） */
export const DEFAULT_MUTUAL_EXCLUSION_CONFIG: MutualExclusionConfig = {
  labels: ["A", "C"],
}

/** 制約ルールの既定色（薄い赤） */
export const DEFAULT_CONSTRAINT_COLOR = "#fecaca"

export interface ConstraintEvaluation {
  /** studentId → 違反ルール一覧 */
  violations: Map<string, ConstraintViolation[]>
  /** constraintId → 該当生徒数（プレビュー用） */
  counts: Map<string, number>
  /** constraintId → エラーメッセージ（式のパース失敗等） */
  errors: Map<string, string>
}

// 式評価器（安全: eval不使用）。代入・条件演算子は無効化する。
const parser = new Parser({
  operators: {
    assignment: false,
    conditional: false,
    logical: true,
    comparison: true,
    concatenate: false,
    in: false,
    factorial: false,
  },
})

interface ViewpointLabel {
  name: string
  label: string
}

/**
 * 各 GradeItem の境界ラベルを昇順（弱→強）に並べ、項目名で引けるようにする。
 * ラベルが数値でも labelValues にも無い場合の順位換算に使う。
 */
function buildOrderedLabelsMap(
  result: GradeCalculationResult
): Map<string, string[]> {
  const idToName = new Map(
    result.gradeItems.map((gradeItem) => [gradeItem.id, gradeItem.name])
  )
  const byName = new Map<string, string[]>()
  for (const boundarySet of result.boundarySets) {
    if (boundarySet.targetType !== "grade_item" || !boundarySet.gradeItemId)
      continue
    const name = idToName.get(boundarySet.gradeItemId)
    if (!name) continue
    // minPercentage 昇順 = 弱い評価が先頭
    const ordered = [...boundarySet.boundaries]
      .sort(
        (boundaryA, boundaryB) =>
          boundaryA.minPercentage - boundaryB.minPercentage
      )
      .map((boundary) => boundary.label)
    byName.set(name, ordered)
  }
  return byName
}

/**
 * ラベルを数値へ換算する。
 * 1. labelValues に定義があればそれを使う
 * 2. ラベル自体が数値ならその数値
 * 3. 順序リスト（弱→強）内の順位（1始まり）
 * いずれも該当しなければ null。
 */
function labelToValue(
  label: string | null,
  labelValues: Record<string, number> | undefined,
  ordered: string[] | undefined
): number | null {
  if (label === null) return null
  if (labelValues && label in labelValues) return labelValues[label]
  const asNumber = Number(label)
  if (label.trim() !== "" && !Number.isNaN(asNumber)) return asNumber
  if (ordered) {
    const index = ordered.indexOf(label)
    if (index >= 0) return index + 1
  }
  return null
}

/** 生徒の観点ラベル一覧（除外・未算出は含めない） */
function collectViewpointLabels(student: StudentGradeResult): ViewpointLabel[] {
  return student.gradeItemResults
    .filter((gradeItemResult) => !gradeItemResult.isExcluded)
    .map((gradeItemResult) => ({
      name: gradeItemResult.gradeItemName,
      label: gradeItemResult.gradeLabel,
    }))
    .filter(
      (viewpoint): viewpoint is ViewpointLabel => viewpoint.label !== null
    )
}

function evalConsistency(
  config: ConsistencyConfig,
  viewpoints: ViewpointLabel[],
  ordered: Map<string, string[]>
): boolean {
  // 「評定」を担う GradeItem を比較先にし、指定の観点（未指定なら残り全部）を集計対象にする
  const targetItem = viewpoints.find(
    (viewpoint) => viewpoint.name === config.target
  )
  if (!targetItem) return false
  const targetVal = labelToValue(
    targetItem.label,
    config.labelValues,
    ordered.get(config.target)
  )
  if (targetVal === null) return false

  const selected = config.viewpointItems ?? []
  const aggregationViewpoints =
    selected.length > 0
      ? viewpoints.filter((viewpoint) => selected.includes(viewpoint.name))
      : viewpoints.filter((viewpoint) => viewpoint.name !== config.target)
  if (aggregationViewpoints.length === 0) return false

  const values = aggregationViewpoints
    .map((viewpoint) =>
      labelToValue(
        viewpoint.label,
        config.labelValues,
        ordered.get(viewpoint.name)
      )
    )
    .filter((value): value is number => value !== null)
  if (values.length === 0) return false

  const sum = values.reduce((acc, value) => acc + value, 0)
  const aggregate = config.aggregate === "sum" ? sum : sum / values.length

  return Math.abs(targetVal - aggregate) > config.tolerance
}

function evalMutualExclusion(
  config: MutualExclusionConfig,
  viewpoints: ViewpointLabel[]
): boolean {
  const present = new Set(
    viewpoints
      .map((viewpoint) => viewpoint.label)
      .filter((label) => config.labels.includes(label))
  )
  return present.size >= 2
}

/**
 * 式評価用スコープを構築。関数名は英語（label/item/has/count/sum/mean/min/max）。
 * 観点名・ラベルは文字列引数（ダブルクォート）で渡す。
 * 集計関数は引数に項目名を並べるとその項目だけ、無引数なら全項目を対象にする。
 */
function buildExpressionScope(
  viewpoints: ViewpointLabel[],
  ordered: Map<string, string[]>,
  allItemNames: Set<string>
): Record<string, Value> {
  // 各項目の数値（ラベル値: 数値ラベルはそのまま、A/B/C等は弱→強の順位）
  const itemValue = (viewpoint: ViewpointLabel) =>
    labelToValue(viewpoint.label, undefined, ordered.get(viewpoint.name))

  // 存在しない項目名の参照はタイプミスとみなしエラーにする（無言失火を防ぐ）。
  // 実在する項目だが当該生徒が除外されている場合は throw せず未定義扱い。
  const requireKnownItem = (name: string) => {
    if (!allItemNames.has(name)) {
      throw new Error(`項目「${name}」は存在しません`)
    }
  }

  // 対象項目を名前で絞る（名前無し=全項目）
  const selected = (names: Value[]) => {
    if (names.length === 0) return viewpoints
    const wanted = names.map(String)
    wanted.forEach(requireKnownItem)
    return viewpoints.filter((viewpoint) => wanted.includes(viewpoint.name))
  }
  const numericOf = (names: Value[]) =>
    selected(names)
      .map(itemValue)
      .filter((value): value is number => value !== null)

  return {
    label: (name: Value) => {
      requireKnownItem(String(name))
      return (
        viewpoints.find((viewpoint) => viewpoint.name === String(name))
          ?.label ?? ""
      )
    },
    item: (name: Value) => {
      requireKnownItem(String(name))
      const found = viewpoints.find(
        (viewpoint) => viewpoint.name === String(name)
      )
      return found ? (itemValue(found) ?? NaN) : NaN
    },
    has: (labelValue: Value) =>
      viewpoints.some((viewpoint) => viewpoint.label === String(labelValue))
        ? 1
        : 0,
    count: (labelValue: Value) =>
      viewpoints.filter((viewpoint) => viewpoint.label === String(labelValue))
        .length,
    sum: (...names: Value[]) =>
      numericOf(names).reduce((accumulator, value) => accumulator + value, 0),
    mean: (...names: Value[]) => {
      const values = numericOf(names)
      return values.length
        ? values.reduce((accumulator, value) => accumulator + value, 0) /
            values.length
        : NaN
    },
    min: (...names: Value[]) => {
      const values = numericOf(names)
      return values.length ? Math.min(...values) : NaN
    },
    max: (...names: Value[]) => {
      const values = numericOf(names)
      return values.length ? Math.max(...values) : NaN
    },
  }
}

/** kind別の設定JSONを既定値にマージして復元する（不正JSONは既定値にフォールバック） */
export function parseConfig<T>(raw: string, fallback: T): T {
  try {
    return { ...fallback, ...(JSON.parse(raw || "{}") as Partial<T>) }
  } catch {
    return fallback
  }
}

/**
 * 式を検証（構文チェック）。問題なければ null、あればエラーメッセージ。
 */
export function validateConstraintExpression(
  expression: string
): string | null {
  if (!expression.trim()) return "式が空です"
  try {
    parser.parse(expression)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : "式の解析に失敗しました"
  }
}

/**
 * 全生徒 × 全ルールを評価する。
 */
export function evaluateConstraints(
  result: GradeCalculationResult,
  constraints: GradeConstraintData[]
): ConstraintEvaluation {
  const violations = new Map<string, ConstraintViolation[]>()
  const counts = new Map<string, number>()
  const errors = new Map<string, string>()

  const ordered = buildOrderedLabelsMap(result)
  const allItemNames = new Set(
    result.gradeItems.map((gradeItem) => gradeItem.name)
  )
  const active = constraints
    .filter((constraint) => constraint.enabled)
    .sort((constraintA, constraintB) => constraintA.order - constraintB.order)

  // 事前検証（無言失火を防ぐためルール単位でエラーを記録）
  //  - expression: 構文チェックしてコンパイル
  //  - consistency: 比較先（評定）の項目が選択済みかつ実在するか
  const compiled = new Map<string, ReturnType<typeof parser.parse> | null>()
  for (const constraint of active) {
    if (constraint.kind === "expression") {
      try {
        compiled.set(constraint.id, parser.parse(constraint.expression))
      } catch (error) {
        compiled.set(constraint.id, null)
        errors.set(
          constraint.id,
          error instanceof Error ? error.message : "式の解析に失敗しました"
        )
      }
    } else if (constraint.kind === "consistency") {
      const consistencyConfig = parseConfig(
        constraint.config,
        DEFAULT_CONSISTENCY_CONFIG
      )
      if (!consistencyConfig.target) {
        errors.set(constraint.id, "評定（比較先の項目）が未選択です")
      } else if (!allItemNames.has(consistencyConfig.target)) {
        errors.set(
          constraint.id,
          `評定の項目「${consistencyConfig.target}」が見つかりません`
        )
      }
    }
  }

  for (const student of result.students) {
    const viewpoints = collectViewpointLabels(student)

    for (const constraint of active) {
      if (errors.has(constraint.id)) continue // 検証エラー済みのルールは着色しない
      let violated = false
      try {
        if (constraint.kind === "consistency") {
          violated = evalConsistency(
            parseConfig(constraint.config, DEFAULT_CONSISTENCY_CONFIG),
            viewpoints,
            ordered
          )
        } else if (constraint.kind === "mutual_exclusion") {
          violated = evalMutualExclusion(
            parseConfig(constraint.config, DEFAULT_MUTUAL_EXCLUSION_CONFIG),
            viewpoints
          )
        } else if (constraint.kind === "expression") {
          const compiledExpression = compiled.get(constraint.id)
          if (!compiledExpression) continue // パースエラーは着色しない
          const scope = buildExpressionScope(viewpoints, ordered, allItemNames)
          violated = Boolean(compiledExpression.evaluate(scope))
        }
      } catch (error) {
        // 評価時エラー（未定義観点名など）はルール単位で記録し着色しない
        if (!errors.has(constraint.id)) {
          errors.set(
            constraint.id,
            error instanceof Error ? error.message : "式の評価に失敗しました"
          )
        }
        violated = false
      }

      if (violated) {
        const list = violations.get(student.studentId) ?? []
        list.push({
          constraintId: constraint.id,
          name: constraint.name,
          color: constraint.color,
          message: constraint.message,
        })
        violations.set(student.studentId, list)
        counts.set(constraint.id, (counts.get(constraint.id) ?? 0) + 1)
      }
    }
  }

  return { violations, counts, errors }
}
