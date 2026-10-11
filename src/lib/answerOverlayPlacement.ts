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

import { mmToPixels } from "@/lib/paperSize"
import type {
  AnswerOverlayStyle,
  OverlayAnchor,
  OverlayKind,
} from "@/types/scoringOverlay.types"

/**
 * 長さを答案画像の画素で持っていた頃（lengthUnit = "px"）の、採点マーク（画像）を端寄せしたときに
 * 枠から内側へ入れていた余白（px）。設定に出ない隠れた補正だったので、mm の行には持たせない。
 * "px" の行はこの値のまま描き、mm へ変換するときはこの分を offset に含める（見た目を変えないため）。
 * 文字には元から余白が無い
 */
const LEGACY_IMAGE_EDGE_PADDING_PX = 5

/**
 * 答案の画像が1枚も無い試験を mm へ変換するときに使う、1mm あたりの画素数（144dpi 相当）。
 * 答案が無ければ重ねて描く先も無いので、見た目には効かない
 */
export const FALLBACK_PIXELS_PER_MM = 144 / 25.4

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
 * 旧来の端寄せの余白を足す向き。先頭（左・上）は内側へ +1、末尾（右・下）は -1、中央は 0
 */
function edgePaddingDirection(position: OverlayAnchor): {
  horizontal: number
  vertical: number
} {
  const { horizontal, vertical } = toRatio(position)
  const directionOf = (ratio: number): number =>
    ratio === 0.5 ? 0 : ratio === 0 ? 1 : -1
  return {
    horizontal: directionOf(horizontal),
    vertical: directionOf(vertical),
  }
}

/**
 * 領域内のアンカー点を求める。
 *
 * "px" の行の採点マークだけ、端寄せで枠から内側へ旧来の余白を入れる（中央寄せには効かない）。
 * 長さはすべて答案画像の画素で渡す（{@link resolveOverlayPixelLengths}）。
 */
export function resolveAnchorPoint(
  region: Region,
  position: OverlayAnchor,
  offsetX: number,
  offsetY: number,
  /** 端寄せ時に枠から内側へ入れる余白（画素）。"px" の行の画像だけが持ち、それ以外は 0 */
  imageEdgePadding = 0
): { x: number; y: number } {
  const { horizontal, vertical } = toRatio(position)
  const direction = edgePaddingDirection(position)

  return {
    x:
      region.x +
      region.width * horizontal +
      direction.horizontal * imageEdgePadding +
      offsetX,
    y:
      region.y +
      region.height * vertical +
      direction.vertical * imageEdgePadding +
      offsetY,
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

// =============================================================================
// 長さの単位（lengthUnit）と答案画像の画素の換算
// =============================================================================

/**
 * 答案画像1枚の、1mm あたりの画素数。
 *
 * 注釈の mm 換算（`mmToPixels`）と同じ式（画像の幅 ÷ 向きを考慮した用紙の幅）。
 * 用紙サイズは試験ごとに `resolveExamPaperSize` で決めたものを渡す。
 */
export function overlayPixelsPerMm(
  pageSize: string,
  imageWidth: number,
  imageHeight: number
): number {
  return mmToPixels(1, pageSize, imageWidth, imageHeight)
}

/** 描画1回ぶんの、答案画像の画素に直した長さ */
interface OverlayPixelLengths {
  size: number
  offsetX: number
  offsetY: number
  /** 画像（採点マーク）を端寄せしたときの旧来の余白。"px" の行だけが持ち、mm の行は 0。文字の描画では使わない */
  imageEdgePadding: number
}

/**
 * スタイル1行の長さを、描く答案画像の画素へ直す。
 *
 * "px" の行（mm への変換が保留中）は今までどおり画素のまま描くので、変換の前後で見た目が変わらない。
 */
export function resolveOverlayPixelLengths(
  style: Pick<
    AnswerOverlayStyle,
    "lengthUnit" | "size" | "offsetX" | "offsetY"
  >,
  pixelsPerMm: number
): OverlayPixelLengths {
  if (style.lengthUnit === "px") {
    return {
      size: style.size,
      offsetX: style.offsetX,
      offsetY: style.offsetY,
      imageEdgePadding: LEGACY_IMAGE_EDGE_PADDING_PX,
    }
  }
  return {
    size: style.size * pixelsPerMm,
    offsetX: style.offsetX * pixelsPerMm,
    offsetY: style.offsetY * pixelsPerMm,
    imageEdgePadding: 0,
  }
}

/**
 * 画素で持っていた長さ（lengthUnit = "px"）を mm へ直す。{@link resolveOverlayPixelLengths} のちょうど逆。
 *
 * `pixelsPerMm` に代表の答案画像の値を渡せば、その画像に描かれる画素は変換の前後で一致する
 * （用紙サイズのラベルが実際の画像と食い違っていても、描画と同じ式で戻すので一致する）。
 *
 * 旧来の余白（5px）は mm の行には無いので、採点マーク（画像）の行では、端寄せの向きに応じて
 * その分を offset に含める。
 */
export function convertPixelLengthsToMm(
  style: {
    overlayKind: OverlayKind
    position: OverlayAnchor
    size: number
    offsetX: number
    offsetY: number
  },
  pixelsPerMm: number
): { size: number; offsetX: number; offsetY: number } {
  const direction =
    style.overlayKind === "mark"
      ? edgePaddingDirection(style.position)
      : { horizontal: 0, vertical: 0 }
  const toMmOffset = (offsetPx: number, paddingDirection: number): number =>
    (offsetPx + paddingDirection * LEGACY_IMAGE_EDGE_PADDING_PX) / pixelsPerMm

  return {
    size: style.size / pixelsPerMm,
    offsetX: toMmOffset(style.offsetX, direction.horizontal),
    offsetY: toMmOffset(style.offsetY, direction.vertical),
  }
}
