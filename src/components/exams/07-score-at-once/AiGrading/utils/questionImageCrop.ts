/**
 * プロンプトの問題の画像の切り出し（範囲は画像に対する比 0〜1）。
 *
 * 範囲の計算は純粋関数にし、画像から切り出して PNG にするところだけがブラウザ（canvas）に頼る。
 */

/** 画像に対する比（0〜1）の範囲 */
export interface CropSelection {
  x: number
  y: number
  width: number
  height: number
}

/** 画像全体 */
export const WHOLE_IMAGE_SELECTION: CropSelection = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

/** これより小さい範囲は選んでいないものとみなす（クリックだけで消えないように） */
const MIN_SELECTION_SIZE = 0.01

const clampRatio = (ratio: number) => Math.min(1, Math.max(0, ratio))

/** ドラッグの始点と終点（画像に対する比）から範囲を作る。小さすぎれば null */
export function selectionFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number }
): CropSelection | null {
  const left = clampRatio(Math.min(start.x, end.x))
  const top = clampRatio(Math.min(start.y, end.y))
  const right = clampRatio(Math.max(start.x, end.x))
  const bottom = clampRatio(Math.max(start.y, end.y))
  if (right - left < MIN_SELECTION_SIZE || bottom - top < MIN_SELECTION_SIZE) {
    return null
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** 範囲を動かす（画像の外へははみ出さない） */
export function moveSelection(
  selection: CropSelection,
  dx: number,
  dy: number
): CropSelection {
  return {
    ...selection,
    x: Math.min(1 - selection.width, Math.max(0, selection.x + dx)),
    y: Math.min(1 - selection.height, Math.max(0, selection.y + dy)),
  }
}

/** 範囲の右下を広げる・狭める（左上は動かさない。小さくなりすぎない） */
export function resizeSelection(
  selection: CropSelection,
  dw: number,
  dh: number
): CropSelection {
  return {
    ...selection,
    width: Math.min(
      1 - selection.x,
      Math.max(MIN_SELECTION_SIZE, selection.width + dw)
    ),
    height: Math.min(
      1 - selection.y,
      Math.max(MIN_SELECTION_SIZE, selection.height + dh)
    ),
  }
}

/** 画像全体を選んでいるか */
export function isWholeImage(selection: CropSelection): boolean {
  return (
    selection.x <= 0 &&
    selection.y <= 0 &&
    selection.width >= 1 &&
    selection.height >= 1
  )
}

/** 範囲を画素の矩形にする（少なくとも1画素） */
export function selectionToPixels(
  selection: CropSelection,
  naturalWidth: number,
  naturalHeight: number
): { x: number; y: number; w: number; h: number } {
  const x = Math.round(selection.x * naturalWidth)
  const y = Math.round(selection.y * naturalHeight)
  return {
    x,
    y,
    w: Math.max(1, Math.round(selection.width * naturalWidth)),
    h: Math.max(1, Math.round(selection.height * naturalHeight)),
  }
}

/** 読み込んだ画像の範囲を PNG のバイト列にする */
export async function cropImageToPng(
  image: HTMLImageElement,
  selection: CropSelection
): Promise<Uint8Array> {
  const { x, y, w, h } = selectionToPixels(
    selection,
    image.naturalWidth,
    image.naturalHeight
  )
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext("2d")
  if (!context) throw new Error("画像を切り出せませんでした")
  context.drawImage(image, x, y, w, h, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  )
  if (!blob) throw new Error("画像を切り出せませんでした")
  return new Uint8Array(await blob.arrayBuffer())
}
