/**
 * PNG生成（SVG文字列 → sharp）
 *
 * AnswerSheetDefinition → SVG文字列 → sharp PNG変換
 * 複数ページ対応: ページごとに個別PNGファイルを生成
 */

import fs from "fs"
import path from "path"
import sharp from "sharp"

import type { AnswerSheetDefinition } from "../../../types/answerSheetBuilder.types"
import { computeMultiPageLayout } from "./layoutEngine"
import { renderMultiPageSvgStrings } from "./svgRenderer"

/**
 * 解答用紙をPNG画像として出力
 * 複数ページの場合: name-1.png, name-2.png, ... を生成
 * 単一ページの場合: name.png を生成（後方互換）
 */
export async function generatePng(
  definition: AnswerSheetDefinition,
  outputPath: string,
  dpi: number = 300,
  svgString?: string
): Promise<void> {
  const multiLayout = computeMultiPageLayout(definition)
  const widthPx = Math.round((multiLayout.pageWidthMm / 25.4) * dpi)
  const heightPx = Math.round((multiLayout.pageHeightMm / 25.4) * dpi)

  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  if (multiLayout.totalPages === 1) {
    // 単一ページ: 後方互換（元のファイル名をそのまま使用）
    const svg =
      svgString ??
      renderMultiPageSvgStrings(multiLayout, definition.renderMode)[0]
    const svgBuffer = Buffer.from(svg)
    await sharp(svgBuffer).resize(widthPx, heightPx).png().toFile(outputPath)
  } else {
    // 複数ページ: name-1.png, name-2.png, ...
    const svgStrings = renderMultiPageSvgStrings(
      multiLayout,
      definition.renderMode
    )
    const ext = path.extname(outputPath)
    const base = outputPath.slice(0, -ext.length)

    for (let i = 0; i < svgStrings.length; i++) {
      const pagePath = `${base}-${i + 1}${ext}`
      const svgBuffer = Buffer.from(svgStrings[i])
      await sharp(svgBuffer).resize(widthPx, heightPx).png().toFile(pagePath)
    }
  }
}

/**
 * PNG画像をBufferとして生成（試験変換用）
 * 複数ページ対応: Buffer[] を返す
 */
export async function generatePngBuffer(
  definition: AnswerSheetDefinition,
  dpi: number = 300,
  svgString?: string
): Promise<Buffer[]> {
  const multiLayout = computeMultiPageLayout(definition)
  const widthPx = Math.round((multiLayout.pageWidthMm / 25.4) * dpi)
  const heightPx = Math.round((multiLayout.pageHeightMm / 25.4) * dpi)

  if (multiLayout.totalPages === 1 && svgString) {
    const svgBuffer = Buffer.from(svgString)
    const buf = await sharp(svgBuffer)
      .resize(widthPx, heightPx)
      .png()
      .toBuffer()
    return [buf]
  }

  const svgStrings = renderMultiPageSvgStrings(
    multiLayout,
    definition.renderMode
  )

  const buffers: Buffer[] = []
  for (const svg of svgStrings) {
    const svgBuffer = Buffer.from(svg)
    const buf = await sharp(svgBuffer)
      .resize(widthPx, heightPx)
      .png()
      .toBuffer()
    buffers.push(buf)
  }
  return buffers
}
