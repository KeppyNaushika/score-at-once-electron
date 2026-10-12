import type { ScaleValueDisplay } from "@/types/rubric.types"

/**
 * 類型評価の値を、見せ方（`scaleValueDisplay`）に従って文字にする（docs/vlm-grading-design.md §4-8-8）。
 *
 * points は「8」、label_points は「A (8)」、label は「A」。試験の類型評価と外部資料の文字評価で同じ見せ方を
 * 使う。点数が無い（換算表に当てはまる類型が無い）ときは、どの見せ方でも記号だけを出す。
 *
 * 点数の桁は呼ぶ側が決めて文字で渡す（外部資料は換算点を小数1桁で見せる、など出力ごとに違うため）。
 */
export const formatScaleValue = (
  value: { label: string; pointsText: string | null },
  display: ScaleValueDisplay
): string => {
  if (value.pointsText === null) return value.label
  switch (display) {
    case "points":
      return value.pointsText
    case "label_points":
      return `${value.label} (${value.pointsText})`
    case "label":
      return value.label
  }
}
