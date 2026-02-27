/**
 * PNG生成（SVG文字列 → sharp）
 *
 * AnswerSheetDefinition → SVG文字列 → sharp PNG変換
 */

import fs from "fs"
import path from "path"
import sharp from "sharp"

import type { AnswerSheetDefinition } from "../../../types/answerSheetBuilder.types"
import { computeLayout } from "./layoutEngine"
import { renderSvgString } from "./svgRenderer"

/**
 * 解答用紙をPNG画像として出力
 * @param definition 解答用紙定義
 * @param outputPath 出力先パス
 * @param dpi 出力DPI（デフォルト: 300）
 * @param svgString 外部で生成済みのSVG文字列（MathJax処理済みなど）
 */
export async function generatePng(
  definition: AnswerSheetDefinition,
  outputPath: string,
  dpi: number = 300,
  svgString?: string
): Promise<void> {
  const layout = computeLayout(definition)

  // DPIからピクセルサイズを計算 (1インチ = 25.4mm)
  const widthPx = Math.round((layout.pageWidthMm / 25.4) * dpi)
  const heightPx = Math.round((layout.pageHeightMm / 25.4) * dpi)

  // SVG文字列を生成（外部提供がなければサーバーサイドで生成）
  const svg = svgString ?? renderSvgString(layout, definition.renderMode)

  // SVGのviewBoxを出力サイズに合わせて変換
  const svgBuffer = Buffer.from(svg)

  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  await sharp(svgBuffer).resize(widthPx, heightPx).png().toFile(outputPath)
}

/**
 * PNG画像をBufferとして生成（プロジェクト変換用）
 */
export async function generatePngBuffer(
  definition: AnswerSheetDefinition,
  dpi: number = 300,
  svgString?: string
): Promise<Buffer> {
  const layout = computeLayout(definition)

  const widthPx = Math.round((layout.pageWidthMm / 25.4) * dpi)
  const heightPx = Math.round((layout.pageHeightMm / 25.4) * dpi)

  const svg = svgString ?? renderSvgString(layout, definition.renderMode)
  const svgBuffer = Buffer.from(svg)

  return sharp(svgBuffer).resize(widthPx, heightPx).png().toBuffer()
}
