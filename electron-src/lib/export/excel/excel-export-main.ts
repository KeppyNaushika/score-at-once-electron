import { dialog } from "electron"
import * as ExcelJS from "exceljs"
import { getStudentsForProject } from "../../prisma/projectStudent"
import { getQuestionScoresForProject, calculateActualScore } from "../../prisma/questionScore"
import { getLayoutRegionsByProjectId } from "../../prisma/layoutRegion"
import { getProjectById } from "../../prisma/project"
import { getQuestionGroupsByProjectId } from "../../prisma/questionGroup"
import { 
  ExportGradingDataOptions, 
  ExportResult, 
  ScoringData, 
  ScoreDetail, 
  SubtotalScore 
} from "../../shared/types/export-types"
import { 
  calculateSubtotalScore, 
  buildSubtotalTargetMap, 
  SubtotalTargetMap 
} from "../../shared/calculations/subtotal-calculator"
import { getExcelColumnLetter, getStatusSymbol, applyCellStyle, autoFitColumns } from "../../shared/utilities/excel-utilities"

/**
 * Excel出力のメイン処理
 */
export async function exportGradingDataExcel(options: ExportGradingDataOptions): Promise<ExportResult> {
  try {
    const { projectId, selectedStudentIds } = options

    // データの取得
    const dataResult = await fetchExportData(projectId, selectedStudentIds)
    if (!dataResult.success) {
      return { success: false, error: dataResult.error }
    }

    const { 
      project, 
      selectedStudents, 
      questionRegions, 
      subtotalRegions, 
      scoringData 
    } = dataResult

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook()
    
    // 点数一覧シート作成
    const scoreSheet = await createScoreSheet(
      workbook, 
      project, 
      questionRegions, 
      subtotalRegions, 
      scoringData
    )

    // 正誤一覧シート作成  
    const resultSheet = await createResultSheet(
      workbook, 
      project, 
      questionRegions, 
      subtotalRegions, 
      scoringData
    )

    // ファイル保存
    const saveResult = await saveWorkbook(workbook, options.outputPath)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, outputPath: saveResult.outputPath }

  } catch (error) {
    console.error("Excel export error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "不明なエラーが発生しました" 
    }
  }
}

/**
 * 出力用データを取得する
 */
async function fetchExportData(projectId: string, selectedStudentIds: string[]) {
  try {
    // 基本データの取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    const studentsResult = await getStudentsForProject(projectId)
    if (!studentsResult.success) {
      return { success: false, error: "生徒データの取得に失敗しました" }
    }

    const layoutRegions = await getLayoutRegionsByProjectId(projectId)
    const questionScores = await getQuestionScoresForProject(projectId)

    // 選択された生徒のフィルタリングとソート
    const selectedStudents = studentsResult.students
      .filter(student => selectedStudentIds.includes(student.id))
      .sort((a, b) => {
        const aOrder = (a as any).customOrder !== undefined ? (a as any).customOrder : 999999
        const bOrder = (b as any).customOrder !== undefined ? (b as any).customOrder : 999999
        return aOrder - bOrder
      })

    if (selectedStudents.length === 0) {
      return { success: false, error: "選択された生徒が見つかりません" }
    }

    // 設問領域と小計領域の分離・ソート
    const questionRegions = layoutRegions
      .filter((region: any) => region.type === "QUESTION_ANSWER")
      .sort((a: any, b: any) => {
        if (Math.abs(a.y - b.y) < 0.01) {
          return a.x - b.x
        }
        return a.y - b.y
      })

    const subtotalRegions = layoutRegions
      .filter((region: any) => region.type === "SUBTOTAL_SCORE")
      .sort((a: any, b: any) => {
        if (Math.abs(a.y - b.y) < 0.01) {
          return a.x - b.x
        }
        return a.y - b.y
      })

    // 採点データの構造化
    const scoringData: ScoringData[] = await Promise.all(
      selectedStudents.map(async (student) => {
        const studentScores = questionScores.success ? questionScores.scores?.filter((score: any) => 
          score.answerSheet?.studentId === student.id
        ) || [] : []

        const scores: ScoreDetail[] = questionRegions.map((region: any) => {
          const scoreRecord = studentScores.find((score: any) => score.layoutRegionId === region.id)
          const actualScore = scoreRecord ? calculateActualScore(scoreRecord) : null
          
          return {
            questionId: region.id,
            questionLabel: region.label || `問${region.orderIndex || 1}`,
            score: actualScore,
            maxScore: region.points || 0,
            status: scoreRecord?.status || "unscored"
          }
        })

        // 小計点の計算
        const subtotalScores: SubtotalScore[] = await Promise.all(
          subtotalRegions.map(async (subtotalRegion: any) => {
            const result = await calculateSubtotalScore(subtotalRegion.id, scores)
            return {
              subtotalRegionId: subtotalRegion.id,
              subtotalLabel: subtotalRegion.label || `小計${subtotalRegion.orderIndex || 1}`,
              score: result.score,
              maxScore: result.maxScore
            }
          })
        )

        const totalScore = scores.reduce((sum, score) => sum + (score.score || 0), 0)
        const totalMaxScore = scores.reduce((sum, score) => sum + score.maxScore, 0)

        return {
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          studentNumber: student.studentId,
          grade: (student as any).grade,
          className: (student as any).className,
          attendanceNumber: (student as any).attendanceNumber,
          scores,
          totalScore,
          totalMaxScore,
          subtotalScores
        }
      })
    )

    return {
      success: true,
      project,
      selectedStudents,
      questionRegions,
      subtotalRegions,
      scoringData
    }

  } catch (error) {
    console.error("Error fetching export data:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "データ取得に失敗しました" 
    }
  }
}

/**
 * 点数一覧シートを作成する
 */
async function createScoreSheet(
  workbook: ExcelJS.Workbook,
  project: any,
  questionRegions: any[],
  subtotalRegions: any[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("点数一覧")
  
  // ヘッダー行の作成
  await createSheetHeaders(worksheet, project, questionRegions, subtotalRegions, true)
  
  // 小計点の対象設問マップを事前に構築
  const subtotalTargetMap = await buildSubtotalTargetMap(subtotalRegions, questionRegions)
  
  // データ行の作成
  await createDataRows(worksheet, scoringData, subtotalRegions, subtotalTargetMap, true)
  
  // スタイル適用
  autoFitColumns(worksheet)
  
  return worksheet
}

/**
 * 正誤一覧シートを作成する
 */
async function createResultSheet(
  workbook: ExcelJS.Workbook,
  project: any,
  questionRegions: any[],
  subtotalRegions: any[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("正誤一覧")
  
  // ヘッダー行の作成
  await createSheetHeaders(worksheet, project, questionRegions, subtotalRegions, false)
  
  // 小計点の対象設問マップを事前に構築
  const subtotalTargetMap = await buildSubtotalTargetMap(subtotalRegions, questionRegions)
  
  // データ行の作成
  await createDataRows(worksheet, scoringData, subtotalRegions, subtotalTargetMap, false)
  
  // スタイル適用
  autoFitColumns(worksheet)
  
  return worksheet
}

/**
 * シートのヘッダー行を作成する
 */
async function createSheetHeaders(
  worksheet: ExcelJS.Worksheet,
  project: any,
  questionRegions: any[],
  subtotalRegions: any[],
  isScoreSheet: boolean
) {
  const row = worksheet.addRow([
    "順位",
    "学年",
    "学級",
    "出席番号", 
    "学籍番号",
    "氏名",
    "合計点",
    ...subtotalRegions.map((region: any) => region.label || `小計${region.orderIndex || 1}`),
    ...questionRegions.map((region: any) => region.label || `問${region.orderIndex || 1}`)
  ])

  // ヘッダーのスタイル適用
  row.eachCell(cell => applyCellStyle(cell, 'header'))
}

/**
 * データ行を作成する
 */
async function createDataRows(
  worksheet: ExcelJS.Worksheet,
  scoringData: ScoringData[],
  subtotalRegions: any[],
  subtotalTargetMap: SubtotalTargetMap,
  isScoreSheet: boolean
) {
  for (let i = 0; i < scoringData.length; i++) {
    const student = scoringData[i]
    const rowIndex = i + 2 // ヘッダー行を考慮

    const row = worksheet.addRow([
      `=RANK(G${rowIndex},G:G,0)`, // 順位計算
      student.grade || "",
      student.className || "",
      student.attendanceNumber || "",
      student.studentNumber,
      student.studentName
    ])

    // 合計点の計算（Excel関数使用）
    const questionStartColIndex = 8 + subtotalRegions.length
    const questionEndColIndex = questionStartColIndex + student.scores.length - 1
    const questionStartCol = getExcelColumnLetter(questionStartColIndex)
    const questionEndCol = getExcelColumnLetter(questionEndColIndex)
    row.getCell('G').value = { formula: `SUM(${questionStartCol}${rowIndex}:${questionEndCol}${rowIndex})` }

    // 小計点の設定
    await setSubtotalCells(row, student, subtotalRegions, subtotalTargetMap, rowIndex, isScoreSheet)

    // 設問別データの設定
    setQuestionCells(row, student, subtotalRegions.length, isScoreSheet)

    // 行スタイルの適用
    row.eachCell(cell => applyCellStyle(cell, 'data'))
  }
}

/**
 * 小計点セルを設定する
 */
async function setSubtotalCells(
  row: ExcelJS.Row,
  student: ScoringData,
  subtotalRegions: any[],
  subtotalTargetMap: SubtotalTargetMap,
  rowIndex: number,
  isScoreSheet: boolean
) {
  let subtotalColIndex = 8
  const questionStartColIndex = 8 + subtotalRegions.length

  for (let i = 0; i < subtotalRegions.length; i++) {
    const col = getExcelColumnLetter(subtotalColIndex)
    const subtotalScore = student.subtotalScores[i]
    
    if (subtotalScore) {
      const targetQuestionIndices = subtotalTargetMap[subtotalScore.subtotalRegionId] || []
      
      if (targetQuestionIndices.length > 0) {
        const targetCells = targetQuestionIndices.map(index => {
          const questionCol = getExcelColumnLetter(questionStartColIndex + index)
          return `${questionCol}${rowIndex}`
        })
        
        if (isScoreSheet) {
          // 点数一覧：対象設問の合計
          const formula = targetCells.join('+')
          row.getCell(col).value = { formula }
        } else {
          // 正誤一覧：対象設問の正答数
          const formula = targetCells.map(cell => `IF(${cell}="○",1,0)`).join('+')
          row.getCell(col).value = { formula }
        }
      } else {
        row.getCell(col).value = 0
      }
    } else {
      row.getCell(col).value = 0
    }
    subtotalColIndex++
  }
}

/**
 * 設問セルを設定する
 */
function setQuestionCells(
  row: ExcelJS.Row,
  student: ScoringData,
  subtotalCount: number,
  isScoreSheet: boolean
) {
  let scoreColIndex = 8 + subtotalCount
  
  for (const score of student.scores) {
    const col = getExcelColumnLetter(scoreColIndex)
    
    if (isScoreSheet) {
      // 点数一覧
      row.getCell(col).value = score.score || 0
    } else {
      // 正誤一覧
      row.getCell(col).value = getStatusSymbol(score.status)
    }
    scoreColIndex++
  }
}

/**
 * ワークブックを保存する
 */
async function saveWorkbook(workbook: ExcelJS.Workbook, outputPath?: string): Promise<ExportResult> {
  try {
    let finalOutputPath = outputPath

    if (!finalOutputPath) {
      const result = await dialog.showSaveDialog({
        title: "Excel出力先を選択",
        defaultPath: `採点結果_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: "Excelファイル", extensions: ["xlsx"] }]
      })

      if (result.canceled) {
        return { success: false, error: "出力がキャンセルされました" }
      }

      finalOutputPath = result.filePath
    }

    if (!finalOutputPath) {
      return { success: false, error: "出力パスが指定されていません" }
    }

    await workbook.xlsx.writeFile(finalOutputPath)
    return { success: true, outputPath: finalOutputPath }

  } catch (error) {
    console.error("Error saving workbook:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "ファイル保存に失敗しました" 
    }
  }
}