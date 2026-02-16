import * as ExcelJS from "exceljs"

import {
  ExportGradingDataOptions,
  ExportResult,
  ScoringData,
} from "../../shared/types/exportTypes"
import { fetchExportData } from "./dataFetcher"
import { saveWorkbook } from "./fileSaver"
import { createResultSheet, createScoreSheet } from "./sheetCreators"

/**
 * Excel出力のメイン処理
 *
 * @param options - 出力オプション（プロジェクトID、選択生徒ID配列、出力パス）
 * @returns 出力結果（成功/失敗、出力パス、エラーメッセージ）
 */
export async function exportGradingDataExcel(
  options: ExportGradingDataOptions
): Promise<ExportResult> {
  try {
    const { projectId, selectedStudentIds } = options

    // データの取得
    const dataResult = await fetchExportData(projectId, selectedStudentIds)
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
      const validationResult = validateScoringData(dataResult.scoringData)
      if (validationResult.hasWarnings) {
        return {
          success: false,
          error: "採点データに問題があります",
          warnings: validationResult.warnings,
          validationResult: validationResult,
        }
      }
    }

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook()

    // 点数一覧シート作成
    await createScoreSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      dataResult.scoringData
    )

    // 正誤一覧シート作成
    await createResultSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      dataResult.scoringData
    )

    // ファイル保存
    const projectName = dataResult.project?.examName
    const saveResult = await saveWorkbook(
      workbook,
      options.outputPath,
      projectName
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

/**
 * 採点データの検証結果
 */
interface ValidationResult {
  hasWarnings: boolean
  warnings: {
    noScoringData: string[]
    ungraded: string[]
    missingPartialScore: string[]
  }
}

/**
 * 採点データを検証して警告を生成する
 */
function validateScoringData(scoringData: ScoringData[]): ValidationResult {
  const warnings = {
    noScoringData: [] as string[],
    ungraded: [] as string[],
    missingPartialScore: [] as string[],
  }

  for (const studentData of scoringData) {
    const studentName = studentData.studentName

    for (const score of studentData.scores) {
      const questionLabel = score.questionLabel
      const identifier = `${studentName} - ${questionLabel}`

      // 採点データが存在しない
      if (!score.status || score.status === "unscored") {
        if (score.score === null) {
          warnings.noScoringData.push(identifier)
        } else {
          warnings.ungraded.push(identifier)
        }
      }

      // 部分点・保留で値が入力されていない（0点は有効な値なので除外）
      if (
        (score.status === "partial" || score.status === "hold") &&
        score.score === null
      ) {
        warnings.missingPartialScore.push(identifier)
      }
    }
  }

  return {
    hasWarnings:
      warnings.noScoringData.length > 0 ||
      warnings.ungraded.length > 0 ||
      warnings.missingPartialScore.length > 0,
    warnings,
  }
}
