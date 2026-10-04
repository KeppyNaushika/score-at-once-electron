import { layoutNestedSheet } from "@/lib/pdf-tools/nestedSheetLayout"
import { A4_PAPER, type NUpSize, rotatedSize } from "@/lib/pdf-tools/nUpLayout"
import type { NUpSheet } from "@/types/pdfTools.types"

import { sheetLeafPages, toLayoutSheet } from "./outputSheets"

/**
 * 合成キャンバスの解像度（用紙のポイントに対する倍率）。配置はPDF・プレビューと同じく
 * A4 のポイント寸法で計算し、描くときだけこの倍率で拡大する（用紙の寸法を先に丸めて
 * 配置を計算すると、同点の格子の決着がPDFと食い違う）
 */
const CANVAS_SCALE = 2

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
 * 面を合成するキャンバスの配置（用紙の寸法・向きと葉の置き場所）。
 *
 * 格子と用紙の向きは、PDF・プレビューと同じく A4 のポイント寸法（`A4_PAPER`）で決める。
 * キャンバスの寸法はここで決まった用紙を CANVAS_SCALE 倍して取る（向きは中身から
 * 決まるので、縦の面も横の面もある）。寸法は画像要素そのものでなく、ページの id → 寸法の素のオブジェクトで
 * 受け取る（画像要素の width・height はゲッターなので、写し損ねると配置が NaN になる）。
 *
 * @param pageSizeById ページの id → 画像の寸法（回す前）。無い・null のページは空きスロット
 */
export function composeSheetLayout(
  sheet: NUpSheet,
  pageSizeById: ReadonlyMap<string, NUpSize | null>
) {
  const layout = layoutNestedSheet(
    toLayoutSheet(sheet, (page) => pageSizeById.get(page.id) ?? null),
    A4_PAPER
  )
  if (!layout) return null
  return {
    ...layout,
    canvasSize: {
      width: Math.round(layout.paper.width * CANVAS_SCALE),
      height: Math.round(layout.paper.height * CANVAS_SCALE),
    },
  }
}

/**
 * N-up の面をA4のキャンバスに合成してPNGのdata URLを返す。
 * 配置はPDF側の addNUpSheet（nUpSheetPage.ts）と layoutNestedSheet を共有する。
 * 入れ子の面（全体 N-up）も葉ごとの置き場所に畳んでから描くので、元のページ画像を
 * 1回だけ縮めて置く（内側の面を一度画像にしてから縮めることはしない）。
 *
 * ページ画像は元PDFの /Rotate を反映済み（PDF.js が描いたもの）なので、回すのは
 * 指定の回転だけ。各ページはスロットの中で回してから置く。
 *
 * @returns 合成画像の data URL。描画対象が1枚も無ければ null
 */
export async function composeSheetImage(
  sheet: NUpSheet
): Promise<string | null> {
  // 葉のページ画像を読み込む（画像の無いページ・デコード失敗は空きスロットになる）
  const imageByPageId = new Map(
    await Promise.all(
      sheetLeafPages(sheet).map(
        async (page) =>
          [
            page.id,
            page.thumbnail ? await loadImage(page.thumbnail) : null,
          ] as const
      )
    )
  )

  const pageSizeById = new Map(
    [...imageByPageId].map(([pageId, image]) => [
      pageId,
      image ? { width: image.naturalWidth, height: image.naturalHeight } : null,
    ])
  )
  const layout = composeSheetLayout(sheet, pageSizeById)
  if (!layout) return null

  const canvas = document.createElement("canvas")
  canvas.width = layout.canvasSize.width
  canvas.height = layout.canvasSize.height
  const context = canvas.getContext("2d")
  if (!context) return null
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  // 配置はポイント単位なので、描くときにキャンバスの解像度へ拡大する
  context.scale(
    canvas.width / layout.paper.width,
    canvas.height / layout.paper.height
  )

  layout.leaves.forEach(({ leaf: page, placement, rotation }) => {
    const image = imageByPageId.get(page.id)
    if (!image) return
    // 配置矩形の中心へ移して回し、回す前の向きの寸法で中心に描く
    // （layoutNestedSheet も canvas も左上原点・時計回りが正）
    const unrotated = rotatedSize(placement, rotation)
    context.save()
    context.translate(
      placement.x + placement.width / 2,
      placement.yTop + placement.height / 2
    )
    context.rotate((rotation * Math.PI) / 180)
    context.drawImage(
      image,
      -unrotated.width / 2,
      -unrotated.height / 2,
      unrotated.width,
      unrotated.height
    )
    context.restore()
  })

  return canvas.toDataURL("image/png")
}
