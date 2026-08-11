import type { CropRegion } from "@prisma/client"
import type * as ExcelJS from "exceljs"

import { applyCellStyle } from "../../shared/utilities/excelUtilities"
import type { SubtotalColumn } from "./dataFetcher"

/**
 * シートのヘッダー行を作成する
 *
 * @param worksheet - 対象のワークシート
 * @param questionRegions - 設問領域配列
 * @param subtotalColumns - 小計列情報配列（SubtotalGroupから構築）
 */
export async function createSheetHeaders(
  worksheet: ExcelJS.Worksheet,
  questionRegions: CropRegion[],
  subtotalColumns: SubtotalColumn[]
) {
  const row = worksheet.addRow([
    "受験状態",
    "順位",
    "学年",
    "学級",
    "出席番号",
    "学籍番号",
    "氏名",
    "合計点",
    ...subtotalColumns.map((subtotalColumn) => subtotalColumn.label),
    ...questionRegions.map(
      (region: CropRegion) =>
        region.label || `問${(region.orderIndex ?? 0) + 1}`
    ),
  ])

  // ヘッダーのスタイル適用
  row.eachCell((cell) => applyCellStyle(cell, "header"))
}
