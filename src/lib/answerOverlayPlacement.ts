/**
 * 答案に重ねる要素（採点マーク・点数テキスト）の配置計算
 *
 * 配置は2つの9択で決まる。
 *   position … 領域内のどこに置くか（アンカー点を決める）
 *   anchor   … 描画物のどの点をそのアンカー点に合わせるか
 *
 * 画像（採点マーク）でも文字（点数）でも意味論は同じで、
 * 文字の場合は anchor が canvas の textAlign / textBaseline に対応する。
 */

import type { OverlayAnchor } from "@/types/scoringOverlay.types"

/**
 * 画像を領域の端に置いたときに枠へ密着させないための余白（px）。
 *
 * 文字には適用しない。旧実装（calculatePartialScorePosition）は文字に余白を
 * 持たせておらず、移行で印字位置をずらさないため。
 */
const IMAGE_EDGE_PADDING = 5

interface Region {
  x: number
  y: number
  width: number
  height: number
}

/** 9択を 0（先頭）/ 0.5（中央）/ 1（末尾）の比率へ分解する */
function toRatio(position: OverlayAnchor): {
  horizontal: number
  vertical: number
} {
  const [vertical, horizontal] = position.split("-")
  const ratioOf = (axisPosition: string): number =>
    axisPosition === "left" || axisPosition === "top"
      ? 0
      : axisPosition === "right" || axisPosition === "bottom"
        ? 1
        : 0.5
  return { horizontal: ratioOf(horizontal), vertical: ratioOf(vertical) }
}

/**
 * 領域内のアンカー点を求める。
 *
 * 画像のときだけ、端寄せで枠から内側へ入れる（中央寄せには効かない）。
 */
export function resolveAnchorPoint(
  region: Region,
  position: OverlayAnchor,
  offsetX: number,
  offsetY: number,
  /** 端寄せ時に枠から内側へ入れる余白を使うか（画像のみ true） */
  useEdgePadding = false
): { x: number; y: number } {
  const { horizontal, vertical } = toRatio(position)
  const edgePadding = useEdgePadding ? IMAGE_EDGE_PADDING : 0
  const paddingX =
    horizontal === 0.5 ? 0 : horizontal === 0 ? edgePadding : -edgePadding
  const paddingY =
    vertical === 0.5 ? 0 : vertical === 0 ? edgePadding : -edgePadding

  return {
    x: region.x + region.width * horizontal + paddingX + offsetX,
    y: region.y + region.height * vertical + paddingY + offsetY,
  }
}

/**
 * 画像の描画原点（左上）を求める。
 *
 * anchor が示す画像上の点をアンカー点へ合わせる。
 */
export function resolveImageOrigin(
  anchorPoint: { x: number; y: number },
  anchor: OverlayAnchor,
  size: number
): { x: number; y: number } {
  const { horizontal, vertical } = toRatio(anchor)
  return {
    x: anchorPoint.x - size * horizontal,
    y: anchorPoint.y - size * vertical,
  }
}

/** anchor を canvas の textAlign / textBaseline へ変換する */
export function resolveTextAnchor(anchor: OverlayAnchor): {
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
} {
  const [vertical, horizontal] = anchor.split("-")
  return {
    textAlign:
      horizontal === "left"
        ? "left"
        : horizontal === "right"
          ? "right"
          : "center",
    textBaseline:
      vertical === "top" ? "top" : vertical === "bottom" ? "bottom" : "middle",
  }
}
