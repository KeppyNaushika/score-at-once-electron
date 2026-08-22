import type { StudentGradeResult } from "@/types/grade.types"

/**
 * 評定（成績ラベル）の上書きの扱いを1箇所に集める。
 *
 * 結果（06）と境界設定（05）の両方が同じ判断を使う。片方だけで判定すると、
 * 「マスは赤いのに境界設定の画面には出ない」のような食い違いが起きる。
 *
 * **上書きは制限しない。** 校長判断の「／」のように、得点率から自動算出できない
 * 評定を与えることがある。だから入力はそのまま受け取り、基準（GradeItemBoundary）と
 * 食い違うことに気づく口だけを2つ置く ── マスが赤いことと、境界設定での列挙。
 *
 * **見るのは上書き（GradeOverride）だけ。** 自動算出値は determineGradeLabel が
 * 境界のラベルから選ぶので、定義上いつでも基準の中にある。確定値
 * （GradeFrozenScore.gradeLabel）はその時点の実効値のスナップショットで、基準を
 * 後から変えても残る約束になっている ── 上書き由来の確定はその上書きの行が
 * まだ在るのでここで数えられ、自動算出由来の確定が現在の基準とずれたことは
 * 確定側の `isStale` が示す。ここで数えると同じ1人を二重に数えるか、
 * 「そのまま残す」と決めたものを基準違反として鳴らすかのどちらかになる。
 */

/** 成績境界のうち、ここで見るのはラベルだけ（結果画面と境界設定で行の形が違う） */
interface GradeBoundaryLabel {
  label: string
}

/** その評価項目に引かれた境界のラベル集合 */
function boundaryLabelsOf(
  boundaries: readonly GradeBoundaryLabel[]
): ReadonlySet<string> {
  return new Set(boundaries.map((boundary) => boundary.label))
}

/**
 * 基準（成績境界）に無い評定か。
 *
 * **境界が1本も無いときは判定しない。** 境界を引く前の段階で全マスが赤くても、
 * 直しようがないので意味がない。
 */
export function isUnknownGradeLabel(
  boundaries: readonly GradeBoundaryLabel[],
  overrideLabel: string | null
): boolean {
  if (overrideLabel === null || overrideLabel === "") return false
  if (boundaries.length === 0) return false
  return !boundaryLabelsOf(boundaries).has(overrideLabel)
}

/** 基準に無い評定の一覧（多い順）と、それを付けられた生徒の人数 */
export interface UnknownGradeLabels {
  /** 上書きされた評定のうち基準に無いもの（多い順） */
  values: string[]
  /** その評定が付いている人数（上書きは生徒×評価項目に1行なので行数＝人数） */
  count: number
}

/**
 * その評価項目で上書きされた評定のうち、基準に無いものを数える。
 *
 * 集計は renderer 側で行う（main は算出結果の行を返すだけ）ので、生徒の行を
 * そのまま受け取ってここで数える。
 */
export function collectUnknownGradeLabels(
  gradeItem: { id: string; boundaries: readonly GradeBoundaryLabel[] },
  students: readonly StudentGradeResult[]
): UnknownGradeLabels {
  const countByLabel = new Map<string, number>()
  for (const student of students) {
    const gradeItemResult = student.gradeItemResults.find(
      (itemResult) => itemResult.gradeItemId === gradeItem.id
    )
    const overrideLabel = gradeItemResult?.overrideGradeLabel ?? null
    if (overrideLabel === null) continue
    if (!isUnknownGradeLabel(gradeItem.boundaries, overrideLabel)) continue
    countByLabel.set(overrideLabel, (countByLabel.get(overrideLabel) ?? 0) + 1)
  }
  const values = [...countByLabel.entries()]
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .map(([overrideLabel]) => overrideLabel)
  const count = [...countByLabel.values()].reduce(
    (total, labelCount) => total + labelCount,
    0
  )
  return { values, count }
}
