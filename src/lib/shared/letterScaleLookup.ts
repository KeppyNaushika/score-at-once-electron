/**
 * 文字評価の変換表（評語 → 点数）を引く決まりを1箇所に置く。
 *
 * **同じ評語の行が2つ在りうる。** `CourseworkLetterScale` は
 * `(courseworkItemId, label)` の `@@unique` を 2026-08-23 に外した。評語は1行ずつ
 * 人が打ち、「行を追加」は未使用の評語の先頭を取るので、刻みの無い評価項目で2人が
 * 同時に押すと2人とも `A` を作る。**A=100 と A=90 という別の刻み**なので、
 * unique を張ったまま同期のマージに畳ませると、負けた刻みのラベルを持つ点数
 * （`CourseworkScore.letterValue` は FK でない素の文字列なので付け替わらない）が
 * 換算先を失って欠測になる。
 *
 * 外した以上、**引く側が「どちらを採るか」を決めなければならない**。
 * `find`（先頭勝ち）では並びで決まり、同じ `order` の2行は SQLite の行番号順、
 * つまり端末ごとに違う順になる。**同じデータから端末ごとに違う成績が出る。**
 *
 * `id` のいちばん小さい行を採る。uuid はどの端末でも同じ値なので、必ず同じ行が
 * 選ばれる。同 migration が `CropSubtotal` の重複を `MIN(id)` で畳んだのと同じ決まり。
 *
 * **決めても、利用者は重複に気づけない。** 選ばれなかった行は何もしない幽霊として
 * 残る。気づける場所は {@link duplicateLetterLabels} を使う側（03 の変換表と
 * 04. 結果）が出す。
 */

/** 変換表の1行として引くのに要る最小の形 */
interface LetterScaleLike {
  id: string
  label: string
}

/**
 * その評語の行を引く。同じ評語が2行あれば `id` のいちばん小さい方を採る。
 *
 * 呼び出し側の行の型をそのまま返す（点数を持つ側は落とさずに受け取れる）。
 */
export function findLetterScale<Row extends LetterScaleLike>(
  letterScales: readonly Row[],
  letterValue: string
): Row | undefined {
  return letterScales
    .filter((letterScale) => letterScale.label === letterValue)
    .reduce<Row | undefined>(
      (chosen, letterScale) =>
        !chosen || letterScale.id < chosen.id ? letterScale : chosen,
      undefined
    )
}

/** 2行以上ある評語の一覧（変換表に現れる順） */
export function duplicateLetterLabels(
  letterScales: readonly LetterScaleLike[]
): string[] {
  const countByLabel = new Map<string, number>()
  for (const letterScale of letterScales) {
    countByLabel.set(
      letterScale.label,
      (countByLabel.get(letterScale.label) ?? 0) + 1
    )
  }
  return [...countByLabel.entries()]
    .filter(([, count]) => count > 1)
    .map(([label]) => label)
}
