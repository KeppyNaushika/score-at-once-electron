import type { StudentGradeResult } from "@/types/grade.types"

/**
 * 評定（成績ラベル）の上書きの扱いを1箇所に集める。
 *
 * 結果（05）と境界設定（03）の両方が同じ判断を使う。片方だけで判定すると、
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

/** 評定2つの上下（`resolveGradeLabelDirection`） */
export type GradeLabelDirection = "up" | "down" | "same" | "unknown"

/**
 * 評定2つの上下。`fromLabel` から見て `toLabel` がどちら向きか。
 *
 * 上書きの向き（自動算出値 → 上書き値）と、比較の記号（比較先の評定 → 今回の評定）の
 * 両方がこれを使う。物差しは渡された `boundaries`（上書きならその項目、比較なら
 * 自分側の項目の成績境界）。
 *
 * **要求得点率（minPercentage）の大小で判定し、boundaries の並び順には依存しない。**
 * 「配列の先頭ほど上位の評価」という取り決めはどこにも無いので、並びに寄りかかると
 * 算出側のソートが変わった瞬間に、型もテストも通ったまま矢印だけが逆を向く。
 *
 * 要求得点率が同じ段階が複数ある場合は `order` で比較する。境界エディタは強い評価を
 * 先頭に並べて `order` を振るので、**`order` が小さいほど上位**。同点時にどちらの
 * ラベルを採るかを決めている determineGradeLabel の安定ソートとも向きが一致する。
 *
 * どちらかが境界に無いラベル（教員が任意入力したもの、語彙の違う項目の評定）なら
 * "unknown"。
 */
export function resolveGradeLabelDirection(
  fromLabel: string,
  toLabel: string,
  boundaries: readonly { label: string; minPercentage: number; order: number }[]
): GradeLabelDirection {
  const fromBoundary = boundaries.find(
    (boundary) => boundary.label === fromLabel
  )
  const toBoundary = boundaries.find((boundary) => boundary.label === toLabel)
  if (!fromBoundary || !toBoundary) return "unknown"

  // 上向き＝行き先のほうが要求得点率が高い
  if (toBoundary.minPercentage !== fromBoundary.minPercentage) {
    return toBoundary.minPercentage > fromBoundary.minPercentage ? "up" : "down"
  }

  // 要求得点率が同じなら段階の並び（order が小さいほど上位）で比べる
  if (toBoundary.order !== fromBoundary.order) {
    return toBoundary.order < fromBoundary.order ? "up" : "down"
  }

  // 同じ段階（上書きなら固定用途）
  return "same"
}

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
interface UnknownGradeLabels {
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
