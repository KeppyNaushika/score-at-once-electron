import * as ExcelJS from "exceljs"

import { getClassMembersForExam } from "../../prisma/examClass"
import {
  ExportGradingDataOptions,
  ExportResult,
} from "../../shared/types/exportTypes"
import {
  buildConflictIdentifiers,
  validateScoringData,
} from "../../shared/utilities/validateScoringData"
import { fetchExportData } from "./dataFetcher"
import { saveWorkbook } from "./fileSaver"
import { createFrequencyDistributionSheet } from "./frequencyDistributionSheetCreator"
import { createItemAnalysisSheet } from "./itemAnalysisSheetCreator"
import { createResultSheet, createScoreSheet } from "./sheetCreators"
import { createSpTableSheet } from "./spTableSheetCreator"

/**
 * Excel出力のメイン処理
 *
 * @param options - 出力オプション（試験ID、選択生徒ID配列、出力パス）
 * @returns 出力結果（成功/失敗、出力パス、エラーメッセージ）
 */
export async function exportGradingDataExcel(
  options: ExportGradingDataOptions
): Promise<ExportResult> {
  try {
    const { examId, selectedStudentIds } = options

    // データの取得
    const dataResult = await fetchExportData(examId, selectedStudentIds)
    if (!dataResult.success) {
      return { success: false, error: dataResult.error }
    }

    // データが正常に取得できているかチェック
    if (
      !dataResult.questionRegions ||
      !dataResult.subtotalColumns ||
      !dataResult.scoringData
    ) {
      return { success: false, error: "必要なデータの取得に失敗しました" }
    }

    // 採点データの検証と警告の生成（強制実行でない場合のみ）
    if (!options.forceExport) {
      const validationResult = validateScoringData(
        dataResult.scoringData,
        buildConflictIdentifiers(
          dataResult.scoringData,
          dataResult.scoreConflicts ?? []
        )
      )
      if (validationResult.hasWarnings) {
        return {
          success: false,
          error: "採点データに問題があります",
          warnings: validationResult.warnings,
          validationResult: validationResult,
        }
      }
    }

    // 学級平均行の母集団は「試験全体」（生徒選択に無関係）。全受験生徒の採点データと
    // teacherStat=true の登録学級（受験日所属生徒つき）を取得する。
    const allDataResult =
      selectedStudentIds.length === 0
        ? dataResult
        : await fetchExportData(examId, [])
    const allScoringData = allDataResult.success
      ? (allDataResult.scoringData ?? [])
      : []
    const teacherStatClasses = (await getClassMembersForExam(examId)).filter(
      (c) => c.teacherStat
    )

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook()

    // 点数一覧シート作成（全体平均・学級平均行つき）
    await createScoreSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      dataResult.scoringData,
      allScoringData,
      teacherStatClasses
    )

    // 正誤一覧シート作成
    await createResultSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      dataResult.scoringData
    )

    // 問題分析シート作成
    await createItemAnalysisSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.scoringData
    )

    // S-P表シート作成（#838）
    await createSpTableSheet(workbook, dataResult.scoringData)

    // 得点度数分布シート作成（#838）
    await createFrequencyDistributionSheet(workbook, dataResult.scoringData)

    // ファイル保存
    const examName = dataResult.exam?.examName
    const saveResult = await saveWorkbook(
      workbook,
      options.outputPath,
      examName
    )
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, outputPath: saveResult.outputPath }
  } catch (error) {
    console.error("Excel export error:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "不明なエラーが発生しました",
    }
  }
}
