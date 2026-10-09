/**
 * 比較先の表示名。結果画面のポップオーバー・出力の画面・Excel の見出し・操作履歴が
 * 同じ書き方で出す（main と renderer の両方が値で引くので `src/lib/shared/` に置く）。
 *
 * 同じ成績算出の項目なら項目名だけ、別の成績算出なら「成績算出名 > 項目名」。
 *
 * @param comparedGradeName 比較先の成績算出名。自分と同じ成績算出なら null
 */
export function formatComparedTargetName(
  comparedGradeName: string | null,
  comparedGradeItemName: string
): string {
  return comparedGradeName === null
    ? comparedGradeItemName
    : `${comparedGradeName} > ${comparedGradeItemName}`
}
