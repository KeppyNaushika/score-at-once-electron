/**
 * 2-in-1 (N-up) レイアウト幾何の計算
 *
 * PDF出力(pdf-lib / メインプロセス)とPNG出力(canvas / レンダラー)で
 * 同一のスロット配置を共有するための純粋関数。
 * 座標系は「左上原点・yTopは上端からの距離」で返す。
 * pdf-lib側(左下原点)は y = pageHeight - (yTop + height) に変換して使う。
 */
import type { NUpLayout } from "@/types/pdfTools.types"

interface NUpSize {
  width: number
  height: number
}

/** スロットに収めた1ページの描画矩形（左上原点） */
interface NUpPlacement {
  x: number
  yTop: number
  width: number
  height: number
}

interface NUpLayoutResult {
  pageWidth: number
  pageHeight: number
  /** items と同じ並び・同じ長さ。null は空スロット（描画しない） */
  placements: (NUpPlacement | null)[]
}

/**
 * 各スロット（配列インデックス = スロット位置）にページを収めた配置を計算する。
 *
 * スロット位置は配列インデックスで固定されるため、途中のページが欠損しても
 * 残りのページが別スロットへずれることはない（null を渡せば空スロットになる）。
 *
 * @param layout 2in1(横)=2x1 / 2in1(縦)=1x2
 * @param items スロット順のページサイズ。null は空スロット
 * @param base 縦向き基準サイズ（A4縦など）
 */
export function computeNUpLayout(
  layout: NUpLayout,
  items: (NUpSize | null)[],
  base: NUpSize
): NUpLayoutResult {
  // 2in1(横)=2x1 は用紙を横向き、2in1(縦)=1x2 は縦向きにする
  const isLandscape = layout === "2x1"
  const pageWidth = isLandscape ? base.height : base.width
  const pageHeight = isLandscape ? base.width : base.height

  const placements = items.map((item, index) => {
    if (!item) return null

    let slotWidth: number
    let slotHeight: number
    let slotX: number
    let slotYTop: number

    if (layout === "2x1") {
      // 横並び: 左スロット(index 0) / 右スロット(index 1)
      slotWidth = pageWidth / 2
      slotHeight = pageHeight
      slotX = index === 0 ? 0 : slotWidth
      slotYTop = 0
    } else {
      // 縦並び: 上スロット(index 0) / 下スロット(index 1)
      slotWidth = pageWidth
      slotHeight = pageHeight / 2
      slotX = 0
      slotYTop = index === 0 ? 0 : slotHeight
    }

    const scale = Math.min(slotWidth / item.width, slotHeight / item.height)
    const width = item.width * scale
    const height = item.height * scale
    const x = slotX + (slotWidth - width) / 2
    const yTop = slotYTop + (slotHeight - height) / 2

    return { x, yTop, width, height }
  })

  return { pageWidth, pageHeight, placements }
}
