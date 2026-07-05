/**
 * エクスポートモード関連のユニットテスト
 *
 * テスト対象:
 * - generateExportFileName のモード別サフィックス
 * - ExportMode 型の定義
 */

import { describe, expect, test } from "vitest"

import { generateExportFileName } from "../../../electron-src/lib/export/exam-archive/archiveCreator"
import type { ArchiveExportMode } from "../../../src/types/examArchive.types"

describe("generateExportFileName - エクスポートモード対応", () => {
  // EM-1: fullモード（デフォルト）はサフィックスなし
  test("EM-1: fullモードではサフィックスが付かない", () => {
    const fileName = generateExportFileName("期末テスト", "full")
    expect(fileName).toMatch(
      /^期末テスト-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.score$/
    )
    expect(fileName).not.toContain("template")
  })

  // EM-2: exportMode未指定（デフォルト）もサフィックスなし
  test("EM-2: exportMode未指定ではサフィックスが付かない", () => {
    const fileName = generateExportFileName("期末テスト")
    expect(fileName).toMatch(
      /^期末テスト-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.score$/
    )
    expect(fileName).not.toContain("template")
  })

  // EM-3: templateモードで-templateサフィックス
  test("EM-3: templateモードで-templateサフィックスが付く", () => {
    const fileName = generateExportFileName("期末テスト", "template")
    expect(fileName).toMatch(
      /^期末テスト-template-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.score$/
    )
  })

  // EM-4: template_with_subtotalsモードで-template-subtotalsサフィックス
  test("EM-4: template_with_subtotalsモードで-template-subtotalsサフィックスが付く", () => {
    const fileName = generateExportFileName(
      "期末テスト",
      "template_with_subtotals"
    )
    expect(fileName).toMatch(
      /^期末テスト-template-subtotals-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.score$/
    )
  })

  // EM-5: 特殊文字のサニタイズとモードサフィックスが両立する
  test("EM-5: 特殊文字のサニタイズとモードサフィックスが両立する", () => {
    const fileName = generateExportFileName('テスト"名前', "template")
    expect(fileName).not.toContain('"')
    expect(fileName).toContain("-template-")
    expect(fileName.endsWith(".score")).toBe(true)
  })

  // EM-6: 拡張子は常に.score
  test("EM-6: 拡張子は全モードで.score", () => {
    const modes: (ArchiveExportMode | undefined)[] = [
      "full",
      "template",
      "template_with_subtotals",
      undefined,
    ]
    for (const mode of modes) {
      const fileName = generateExportFileName("テスト", mode)
      expect(fileName.endsWith(".score")).toBe(true)
    }
  })
})
