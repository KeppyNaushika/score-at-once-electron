import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"

import type { ExamClassWithMembers } from "@/types/prismaExtensions"

import { ScoringData } from "../../shared/types/exportTypes"
import { autoFitColumns } from "../../shared/utilities/excelUtilities"
import { appendClassAverageRows } from "./averageRows"
import type { SubtotalColumn } from "./dataFetcher"
import { createSheetHeaders } from "./headerCreators"
import { createDataRows } from "./rowCreators"

/**
 * 点数一覧シートを作成する
 *
 * @param workbook - Excelワークブック
 * @param questionRegions - 設問領域配列
 * @param subtotalColumns - 小計列情報配列（SubtotalGroupから構築）
 * @param scoringData - 採点データ配列
 * @returns 作成されたワークシート
 */
export async function createScoreSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  subtotalColumns: SubtotalColumn[],
  scoringData: ScoringData[],
  /** 学級平均行の母集団（試験全体の採点データ。選択生徒ではない） */
  allScoringData: ScoringData[] = [],
  /** teacherStat=true の登録学級（受験日所属生徒つき） */
  teacherStatClasses: ExamClassWithMembers[] = []
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("点数一覧")

  // ヘッダー行の作成
  await createSheetHeaders(worksheet, questionRegions, subtotalColumns)

  // データ行の作成
  await createDataRows(worksheet, scoringData, subtotalColumns, true)

  // 全体平均・学級平均行（Phase 4・主成果）
  appendClassAverageRows(
    worksheet,
    allScoringData,
    teacherStatClasses,
    subtotalColumns,
    questionRegions
  )

  // スタイル適用
  autoFitColumns(worksheet)

  return worksheet
}

/**
 * 正誤一覧シートを作成する
 *
 * @param workbook - Excelワークブック
 * @param questionRegions - 設問領域配列
 * @param subtotalColumns - 小計列情報配列（SubtotalGroupから構築）
 * @param scoringData - 採点データ配列
 * @returns 作成されたワークシート
 */
export async function createResultSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  subtotalColumns: SubtotalColumn[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("正誤一覧")

  // ヘッダー行の作成
  await createSheetHeaders(worksheet, questionRegions, subtotalColumns)

  // データ行の作成
  await createDataRows(worksheet, scoringData, subtotalColumns, false)

  // スタイル適用
  autoFitColumns(worksheet)

  return worksheet
}
