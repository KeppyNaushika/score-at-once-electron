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
  const idToName = new Map(result.gradeItems.map((gi) => [gi.id, gi.name]))
  const byName = new Map<string, string[]>()
  for (const bs of result.boundarySets) {
    if (bs.targetType !== "grade_item" || !bs.gradeItemId) continue
    const name = idToName.get(bs.gradeItemId)
    if (!name) continue
    // minPercentage 昇順 = 弱い評価が先頭
    const ordered = [...bs.boundaries]
      .sort((a, b) => a.minPercentage - b.minPercentage)
      .map((b) => b.label)
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
    const idx = ordered.indexOf(label)
    if (idx >= 0) return idx + 1
  }
  return null
}

/** 生徒の観点ラベル一覧（除外・未算出は含めない） */
function collectViewpointLabels(student: StudentGradeResult): ViewpointLabel[] {
  return student.gradeItemResults
    .filter((r) => !r.isExcluded)
    .map((r) => ({ name: r.gradeItemName, label: r.gradeLabel }))
    .filter((v): v is ViewpointLabel => v.label !== null)
}

function evalConsistency(
  config: ConsistencyConfig,
  viewpoints: ViewpointLabel[],
  ordered: Map<string, string[]>
): boolean {
  // 「評定」を担う GradeItem を比較先にし、指定の観点（未指定なら残り全部）を集計対象にする
  const targetItem = viewpoints.find((v) => v.name === config.target)
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
      ? viewpoints.filter((v) => selected.includes(v.name))
      : viewpoints.filter((v) => v.name !== config.target)
  if (aggregationViewpoints.length === 0) return false

  const values = aggregationViewpoints
    .map((v) => labelToValue(v.label, config.labelValues, ordered.get(v.name)))
    .filter((v): v is number => v !== null)
  if (values.length === 0) return false

  const sum = values.reduce((acc, v) => acc + v, 0)
  const aggregate = config.aggregate === "sum" ? sum : sum / values.length

  return Math.abs(targetVal - aggregate) > config.tolerance
}

function evalMutualExclusion(
  config: MutualExclusionConfig,
  viewpoints: ViewpointLabel[]
): boolean {
  const present = new Set(
    viewpoints
      .map((v) => v.label)
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
  const itemValue = (vp: ViewpointLabel) =>
    labelToValue(vp.label, undefined, ordered.get(vp.name))

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
    return viewpoints.filter((v) => wanted.includes(v.name))
  }
  const numericOf = (names: Value[]) =>
    selected(names)
      .map(itemValue)
      .filter((v): v is number => v !== null)

  return {
    label: (name: Value) => {
      requireKnownItem(String(name))
      return viewpoints.find((v) => v.name === String(name))?.label ?? ""
    },
    item: (name: Value) => {
      requireKnownItem(String(name))
      const found = viewpoints.find((v) => v.name === String(name))
      return found ? (itemValue(found) ?? NaN) : NaN
    },
    has: (labelValue: Value) =>
      viewpoints.some((v) => v.label === String(labelValue)) ? 1 : 0,
    count: (labelValue: Value) =>
      viewpoints.filter((v) => v.label === String(labelValue)).length,
    sum: (...names: Value[]) => numericOf(names).reduce((acc, v) => acc + v, 0),
    mean: (...names: Value[]) => {
      const vals = numericOf(names)
      return vals.length
        ? vals.reduce((acc, v) => acc + v, 0) / vals.length
        : NaN
    },
    min: (...names: Value[]) => {
      const vals = numericOf(names)
      return vals.length ? Math.min(...vals) : NaN
    },
    max: (...names: Value[]) => {
      const vals = numericOf(names)
      return vals.length ? Math.max(...vals) : NaN
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
  const allItemNames = new Set(result.gradeItems.map((gi) => gi.name))
  const active = constraints
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order)

  // 事前検証（無言失火を防ぐためルール単位でエラーを記録）
  //  - expression: 構文チェックしてコンパイル
  //  - consistency: 比較先（評定）の項目が選択済みかつ実在するか
  const compiled = new Map<string, ReturnType<typeof parser.parse> | null>()
  for (const c of active) {
    if (c.kind === "expression") {
      try {
        compiled.set(c.id, parser.parse(c.expression))
      } catch (error) {
        compiled.set(c.id, null)
        errors.set(
          c.id,
          error instanceof Error ? error.message : "式の解析に失敗しました"
        )
      }
    } else if (c.kind === "consistency") {
      const cfg = parseConfig(c.config, DEFAULT_CONSISTENCY_CONFIG)
      if (!cfg.target) {
        errors.set(c.id, "評定（比較先の項目）が未選択です")
      } else if (!allItemNames.has(cfg.target)) {
        errors.set(c.id, `評定の項目「${cfg.target}」が見つかりません`)
      }
    }
  }

  for (const student of result.students) {
    const viewpoints = collectViewpointLabels(student)

    for (const c of active) {
      if (errors.has(c.id)) continue // 検証エラー済みのルールは着色しない
      let violated = false
      try {
        if (c.kind === "consistency") {
          violated = evalConsistency(
            parseConfig(c.config, DEFAULT_CONSISTENCY_CONFIG),
            viewpoints,
            ordered
          )
        } else if (c.kind === "mutual_exclusion") {
          violated = evalMutualExclusion(
            parseConfig(c.config, DEFAULT_MUTUAL_EXCLUSION_CONFIG),
            viewpoints
          )
        } else if (c.kind === "expression") {
          const expr = compiled.get(c.id)
          if (!expr) continue // パースエラーは着色しない
          const scope = buildExpressionScope(viewpoints, ordered, allItemNames)
          violated = Boolean(expr.evaluate(scope))
        }
      } catch (error) {
        // 評価時エラー（未定義観点名など）はルール単位で記録し着色しない
        if (!errors.has(c.id)) {
          errors.set(
            c.id,
            error instanceof Error ? error.message : "式の評価に失敗しました"
          )
        }
        violated = false
      }

      if (violated) {
        const list = violations.get(student.studentId) ?? []
        list.push({
          constraintId: c.id,
          name: c.name,
          color: c.color,
          message: c.message,
        })
        violations.set(student.studentId, list)
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
      }
    }
  }

  return { violations, counts, errors }
}
