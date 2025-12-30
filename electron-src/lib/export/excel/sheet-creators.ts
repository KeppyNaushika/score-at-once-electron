import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"
import { buildSubtotalTargetMap } from "../../shared/calculations/subtotal-calculator"
import { ScoringData } from "../../shared/types/export-types"
import { autoFitColumns } from "../../shared/utilities/excel-utilities"
import { createSheetHeaders } from "./header-creators"
import { createDataRows } from "./row-creators"

/**
 * 点数一覧シートを作成する
 *
 * @param workbook - Excelワークブック
 * @param project - プロジェクト情報
 * @param questionRegions - 設問領域配列
 * @param subtotalRegions - 小計領域配列
 * @param scoringData - 採点データ配列
 * @returns 作成されたワークシート
 */
export async function createScoreSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  subtotalRegions: CropRegion[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("点数一覧")

  // ヘッダー行の作成
  await createSheetHeaders(worksheet, questionRegions, subtotalRegions)

  // 小計点の対象設問マップを事前に構築
  const subtotalTargetMap = await buildSubtotalTargetMap(
    subtotalRegions,
    questionRegions
  )

  // データ行の作成
  await createDataRows(
    worksheet,
    scoringData,
    subtotalRegions,
    subtotalTargetMap,
    true
  )

  // スタイル適用
  autoFitColumns(worksheet)

  return worksheet
}

/**
 * 正誤一覧シートを作成する
 *
 * @param workbook - Excelワークブック
 * @param project - プロジェクト情報
 * @param questionRegions - 設問領域配列
 * @param subtotalRegions - 小計領域配列
 * @param scoringData - 採点データ配列
 * @returns 作成されたワークシート
 */
export async function createResultSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  subtotalRegions: CropRegion[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("正誤一覧")

  // ヘッダー行の作成
  await createSheetHeaders(worksheet, questionRegions, subtotalRegions)

  // 小計点の対象設問マップを事前に構築
  const subtotalTargetMap = await buildSubtotalTargetMap(
    subtotalRegions,
    questionRegions
  )

  // データ行の作成
  await createDataRows(
    worksheet,
    scoringData,
    subtotalRegions,
    subtotalTargetMap,
    false
  )

  // スタイル適用
  autoFitColumns(worksheet)

  return worksheet
}
