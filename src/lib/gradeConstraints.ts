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
  ConstraintAggregate,
  ConstraintViolation,
  GradeCalculationResult,
  GradeConstraintData,
  StudentGradeResult,
} from "@/types/grade.types"

/** 整合ルールの既定のラベル→数値対応（Excel流: A=5, B=3, C=1） */
export const DEFAULT_CONSTRAINT_LABEL_VALUES: Record<string, number> = {
  A: 5,
  B: 3,
  C: 1,
}

/** 整合ルールの既定の集計方法 */
export const DEFAULT_CONSTRAINT_AGGREGATE: ConstraintAggregate = "average"

/** 整合ルールの既定の許容差 */
export const DEFAULT_CONSTRAINT_TOLERANCE = 1

/** 混在禁止ルールの既定ラベル（A・C混在禁止） */
export const DEFAULT_EXCLUSION_LABELS = ["A", "C"]

/** 制約ルールの既定色（薄い赤） */
export const DEFAULT_CONSTRAINT_COLOR = "#fecaca"

interface ConstraintEvaluation {
  /** gradeStudentId（成績の対象者）→ 違反ルール一覧。行の主語は人ではなく対象者 */
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
  gradeItemId: string
  name: string
  label: string
}

/**
 * 各 GradeItem の境界ラベルを昇順（弱→強）に並べ、評価項目idで引けるようにする。
 * ラベルが数値でも labelValues にも無い場合の順位換算に使う。
 */
function buildOrderedLabelsMap(
  result: GradeCalculationResult
): Map<string, string[]> {
  const byGradeItemId = new Map<string, string[]>()
  for (const gradeItem of result.gradeItems) {
    // minPercentage 昇順 = 弱い評価が先頭
    const ordered = [...gradeItem.boundaries]
      .sort(
        (boundaryA, boundaryB) =>
          boundaryA.minPercentage - boundaryB.minPercentage
      )
      .map((boundary) => boundary.label)
    byGradeItemId.set(gradeItem.id, ordered)
  }
  return byGradeItemId
}

/** ラベル→数値の対応行を引きやすい形へ畳む。 */
function toLabelValueMap(
  labelValues: GradeConstraintData["labelValues"]
): Record<string, number> {
  return Object.fromEntries(
    labelValues.map((labelValue) => [labelValue.label, labelValue.value])
  )
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
      gradeItemId: gradeItemResult.gradeItemId,
      name: gradeItemResult.gradeItemName,
      label: gradeItemResult.gradeLabel,
    }))
    .filter(
      (viewpoint): viewpoint is ViewpointLabel => viewpoint.label !== null
    )
}

/**
 * 比較先（評定）と集計対象の観点を突き合わせる。
 *
 * 参照は評価項目idで引く。ここで対象が見つからないのは「その生徒では除外/未算出」
 * のときだけで、設定の壊れ（項目の削除など）は evaluateConstraints の事前検証が
 * エラーとして先に捕まえている。
 */
function evalConsistency(
  constraint: GradeConstraintData,
  viewpoints: ViewpointLabel[],
  ordered: Map<string, string[]>
): boolean {
  const { targetGradeItemId } = constraint
  if (!targetGradeItemId) return false

  const targetItem = viewpoints.find(
    (viewpoint) => viewpoint.gradeItemId === targetGradeItemId
  )
  if (!targetItem) return false

  const labelValues = toLabelValueMap(constraint.labelValues)
  const targetVal = labelToValue(
    targetItem.label,
    labelValues,
    ordered.get(targetGradeItemId)
  )
  if (targetVal === null) return false

  // 指定が無ければ比較先以外の全項目を集計対象にする
  const selectedIds = new Set(
    constraint.viewpoints.map((viewpoint) => viewpoint.gradeItemId)
  )
  const aggregationViewpoints =
    selectedIds.size > 0
      ? viewpoints.filter((viewpoint) => selectedIds.has(viewpoint.gradeItemId))
      : viewpoints.filter(
          (viewpoint) => viewpoint.gradeItemId !== targetGradeItemId
        )
  if (aggregationViewpoints.length === 0) return false

  const values = aggregationViewpoints
    .map((viewpoint) =>
      labelToValue(
        viewpoint.label,
        labelValues,
        ordered.get(viewpoint.gradeItemId)
      )
    )
    .filter((value): value is number => value !== null)
  if (values.length === 0) return false

  const sum = values.reduce((acc, value) => acc + value, 0)
  const aggregate = constraint.aggregate === "sum" ? sum : sum / values.length

  return Math.abs(targetVal - aggregate) > constraint.tolerance
}

function evalMutualExclusion(
  constraint: GradeConstraintData,
  viewpoints: ViewpointLabel[]
): boolean {
  const forbidden = constraint.exclusionLabels.map(
    (exclusionLabel) => exclusionLabel.label
  )
  const present = new Set(
    viewpoints
      .map((viewpoint) => viewpoint.label)
      .filter((label) => forbidden.includes(label))
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
  // 各項目の数値（ラベル値: 数値ラベルはそのまま、A/B/C等は弱→強の順位）。
  // ordered は評価項目idで引く（式の中では項目を名前で書くが、順位表のキーはid）。
  const itemValue = (viewpoint: ViewpointLabel) =>
    labelToValue(viewpoint.label, undefined, ordered.get(viewpoint.gradeItemId))

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
  const knownGradeItemIds = new Set(
    result.gradeItems.map((gradeItem) => gradeItem.id)
  )
  const active = constraints
    .filter((constraint) => constraint.enabled)
    .sort((constraintA, constraintB) => constraintA.order - constraintB.order)

  // 事前検証（無言失火を防ぐためルール単位でエラーを記録）
  //  - expression: 構文チェックしてコンパイル
  //  - consistency: 比較先・集計対象の項目が選択済みかつ実在するか
  //  - mutual_exclusion: 禁止ラベルが2つ以上あるか（1つ以下では原理的に違反しえない）
  //
  // 参照はFKで守られているため通常は壊れない。アーカイブ取込直後など、算出対象の
  // 項目集合と食い違う復元経路でだけ起きうる。そのとき黙って「違反なし」に落とさない。
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
      const missingViewpoints = constraint.viewpoints.filter(
        (viewpoint) => !knownGradeItemIds.has(viewpoint.gradeItemId)
      )
      if (!constraint.targetGradeItemId) {
        errors.set(constraint.id, "評定（比較先の項目）が未選択です")
      } else if (!knownGradeItemIds.has(constraint.targetGradeItemId)) {
        errors.set(
          constraint.id,
          "評定（比較先の項目）が算出対象に見つかりません"
        )
      } else if (missingViewpoints.length > 0) {
        errors.set(
          constraint.id,
          `集計対象の観点${missingViewpoints.length}件が算出対象に見つかりません`
        )
      }
    } else if (constraint.kind === "mutual_exclusion") {
      if (constraint.exclusionLabels.length < 2) {
        errors.set(constraint.id, "混在を禁止するラベルを2つ以上選んでください")
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
          violated = evalConsistency(constraint, viewpoints, ordered)
        } else if (constraint.kind === "mutual_exclusion") {
          violated = evalMutualExclusion(constraint, viewpoints)
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
        const list = violations.get(student.gradeStudentId) ?? []
        list.push({
          constraintId: constraint.id,
          name: constraint.name,
          color: constraint.color,
          message: constraint.message,
        })
        violations.set(student.gradeStudentId, list)
        counts.set(constraint.id, (counts.get(constraint.id) ?? 0) + 1)
      }
    }
  }

  return { violations, counts, errors }
}
