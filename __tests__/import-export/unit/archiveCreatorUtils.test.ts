/**
 * アーカイブ作成ユーティリティのユニットテスト
 */

import { describe, expect, test } from "vitest"

import { generateExportFileName } from "../../../electron-src/lib/export/exam-archive/archiveCreator"

describe("archiveCreatorUtils", () => {
  // AC-1: generateExportFileNameの形式検証
  test("AC-1: ファイル名が正しい形式で生成される", () => {
    const fileName = generateExportFileName("期末テスト")

    // 形式: {name}-yyyy-MM-dd-hh-mm-ss.score
    expect(fileName).toMatch(
      /^期末テスト-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.score$/
    )

    // 拡張子が.score
    expect(fileName.endsWith(".score")).toBe(true)
  })

  // AC-2: 特殊文字のサニタイズ
  test("AC-2: 特殊文字がアンダースコアに置換される", () => {
    const specialChars = '<>:"/\\|?*'
    const fileName = generateExportFileName(`テスト${specialChars}名前`)

    // 特殊文字がすべて_に置換されている
    expect(fileName).not.toMatch(/[<>:"/\\|?*]/)
    expect(fileName).toMatch(/^テスト_________名前-/)
    expect(fileName.endsWith(".score")).toBe(true)
  })

  // AC-3: 日本語ファイル名の保持
  test("AC-3: 日本語の試験名がそのまま保持される", () => {
    const fileName = generateExportFileName("数学Ⅰ　期末考査　2025年度")

    // 日本語文字がそのまま残っている
    expect(fileName).toContain("数学Ⅰ　期末考査　2025年度")
    expect(fileName.endsWith(".score")).toBe(true)
  })
})
