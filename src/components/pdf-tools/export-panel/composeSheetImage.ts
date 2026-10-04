import {
  A4_PAPER,
  computeSheetLayout,
  rotatedSize,
} from "@/lib/pdf-tools/nUpLayout"
import type { NUpSheet } from "@/types/pdfTools.types"

// A4（ポイント単位）を基準にした合成キャンバスの寸法（2倍解像度）
const A4_PORTRAIT_BASE = {
  width: Math.round(A4_PAPER.width * 2),
  height: Math.round(A4_PAPER.height * 2),
}

/** data URL から HTMLImageElement を読み込む（失敗時は null） */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

/**
 * N-up の面をA4のキャンバスに合成してPNGのdata URLを返す。
 * 配置はPDF側の addNUpSheet（pdfMerger.ts）と computeSheetLayout を共有する。
 *
 * ページ画像は元PDFの /Rotate を反映済み（PDF.js が描いたもの）なので、回すのは
 * 指定の回転だけ。各ページはスロットの中で回してから置く。
 *
 * @returns 合成画像の data URL。描画対象が1枚も無ければ null
 */
export async function composeSheetImage(
  sheet: NUpSheet
): Promise<string | null> {
  // スロット順を保ったまま読み込む（空きスロット・デコード失敗は null）
  const slots = await Promise.all(
    sheet.slots.map(async (slot) => {
      if (!slot || !slot.thumbnail) return null
      const image = await loadImage(slot.thumbnail)
      return image ? { image, rotation: slot.rotation } : null
    })
  )
  if (slots.every((slot) => slot === null)) return null

  const layout = computeSheetLayout(
    sheet.nUp,
    slots.map((slot) =>
      slot
        ? {
            width: slot.image.width,
            height: slot.image.height,
            rotation: slot.rotation,
          }
        : null
    ),
    A4_PORTRAIT_BASE
  )

  const canvas = document.createElement("canvas")
  canvas.width = layout.paper.width
  canvas.height = layout.paper.height
  const context = canvas.getContext("2d")
  if (!context) return null
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, layout.paper.width, layout.paper.height)

  layout.placements.forEach((placement, slotIndex) => {
    const slot = slots[slotIndex]
    if (!placement || !slot) return
    // 配置矩形の中心へ移して回し、回す前の向きの寸法で中心に描く
    // （computeSheetLayout も canvas も左上原点・時計回りが正）
    const unrotated = rotatedSize(placement, slot.rotation)
    context.save()
    context.translate(
      placement.x + placement.width / 2,
      placement.yTop + placement.height / 2
    )
    context.rotate((slot.rotation * Math.PI) / 180)
    context.drawImage(
      slot.image,
      -unrotated.width / 2,
      -unrotated.height / 2,
      unrotated.width,
      unrotated.height
    )
    context.restore()
  })

  return canvas.toDataURL("image/png")
}
