import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"
import { applyCellStyle } from "../../shared/utilities/excel-utilities"

/**
 * シートのヘッダー行を作成する
 *
 * @param worksheet - 対象のワークシート
 * @param questionRegions - 設問領域配列
 * @param subtotalRegions - 小計領域配列
 */
export async function createSheetHeaders(
  worksheet: ExcelJS.Worksheet,
  questionRegions: CropRegion[],
  subtotalRegions: CropRegion[],
) {
  const row = worksheet.addRow([
    "順位",
    "学年",
    "学級",
    "出席番号",
    "学籍番号",
    "氏名",
    "合計点",
    ...subtotalRegions.map(
      (region: CropRegion) => region.label || `小計${region.orderIndex || 1}`,
    ),
    ...questionRegions.map(
      (region: CropRegion) => region.label || `問${region.orderIndex || 1}`,
    ),
  ])

  // ヘッダーのスタイル適用
  row.eachCell((cell) => applyCellStyle(cell, "header"))
}
