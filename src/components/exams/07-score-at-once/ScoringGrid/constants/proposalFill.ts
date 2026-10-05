/**
 * 未確定の提案（AI の判定など）の塗り。確定の塗りつぶしと同じ状態の色を斜線にする。
 *
 * 斜線 = 提案（未確定）、塗り = 確定。色相は同じなので、どちらでも状態は読める。
 * 状態の背景色は淡く、白地の斜線にすると見えなくなるので、状態の濃い色（アイコンの色）を
 * 半透明にして引く
 */
export function hatchedFill(statusColor: string): string {
  const stripeColor = `color-mix(in srgb, ${statusColor} 35%, transparent)`
  return `repeating-linear-gradient(45deg, ${stripeColor} 0 6px, transparent 6px 12px)`
}

/** 塗りの見方（凡例とツールチップで同じ言い方にする） */
export const PROPOSAL_FILL_LEGEND = "斜線 = AI提案（未確定）／塗り = 確定"
