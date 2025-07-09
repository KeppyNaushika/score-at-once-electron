import { dialog } from "electron"
import * as ExcelJS from "exceljs"
import { getStudentsForProject } from "./projectStudent"
import { getQuestionScoresForProject, calculateActualScore } from "./questionScore"
import { getLayoutRegionsByProjectId } from "./layoutRegion"
import { getProjectById } from "./project"

interface ExportGradingDataOptions {
  projectId: string
  selectedStudentIds: string[]
  outputPath?: string
}

interface ScoringData {
  studentId: string
  studentName: string
  studentNumber: string
  grade?: string
  className?: string
  attendanceNumber?: number
  scores: ScoreDetail[]
  totalScore: number
  totalMaxScore: number
}

interface ScoreDetail {
  questionId: string
  questionLabel: string
  daimon?: string
  shomon?: string
  shimon?: string
  score: number | null
  maxScore: number
  status: "unscored" | "correct" | "partial" | "hold" | "incorrect" | "no_answer"
}

// Excel列番号を列文字に変換する関数
function getExcelColumnLetter(colIndex: number): string {
  let result = ''
  let num = colIndex
  
  while (num > 0) {
    const remainder = (num - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    num = Math.floor((num - 1) / 26)
  }
  
  return result
}

// 採点状態に基づく表示文字列を生成
function getStatusDisplayText(score: number | null, _maxScore: number, status: string): string {
  switch (status) {
    case "unscored":
      return "-"
    case "correct":
      return "○"
    case "partial":
      return `△${score}`  // 注意: 配点ではなく実際の点数を表示
    case "hold":
      return `？${score}`  // 注意: 配点ではなく実際の点数を表示
    case "incorrect":
      return "×"
    case "no_answer":
      return "×"
    default:
      return "-"
  }
}



export async function exportGradingDataExcel(options: ExportGradingDataOptions): Promise<{
  success: boolean
  outputPath?: string
  error?: string
}> {
  try {
    const { projectId, selectedStudentIds } = options

    // データの取得
    const projectResult = await getProjectById(projectId)
    if (!projectResult) {
      throw new Error('プロジェクトが見つかりません')
    }

    const studentsResult = await getStudentsForProject(projectId)
    if (!studentsResult.success || !studentsResult.students) {
      throw new Error('生徒データの取得に失敗しました')
    }

    const questionScores = await getQuestionScoresForProject(projectId)
    const layoutRegions = await getLayoutRegionsByProjectId(projectId)

    // 選択された生徒のデータをフィルタリング
    const selectedStudents = studentsResult.students.filter(student => 
      selectedStudentIds.includes(student.id)
    )

    if (selectedStudents.length === 0) {
      throw new Error('選択された生徒が見つかりません')
    }

    // 設問情報を取得（layoutRegionsからquestionタイプをフィルタ）
    const questionRegions = layoutRegions.filter((region: any) => 
      region.type === 'question' || region.type === 'QUESTION' || region.label?.includes('問')
    )
    
    // 大問リストを作成
    const daimonList = Array.from(new Set(
      questionRegions
        .map((q: any) => q.questionNumber || q.label)
        .filter(q => q !== null && q !== undefined)
    )).sort()

    // 採点データの構造化
    const scoringData: ScoringData[] = selectedStudents.map(student => {
      const studentScores = questionScores.success ? questionScores.scores?.filter((score: any) => 
        score.answerSheet?.studentId === student.id
      ) || [] : []

      const scores: ScoreDetail[] = questionRegions.map((region: any) => {
        const scoreData = studentScores.find((score: any) => 
          score.layoutRegionId === region.id
        )

        const maxScore = region.points || region.maxScore || 10
        const status = scoreData?.status || "unscored"

        return {
          questionId: region.id,
          questionLabel: region.label || `問${region.questionNumber || region.id}`,
          daimon: region.questionNumber?.toString() || region.label,
          shomon: region.questionSubNumber?.toString() || "",
          shimon: region.questionSubSubNumber?.toString() || "",
          score: scoreData ? calculateActualScore({
            status: scoreData.status,
            partialScore: scoreData.partialScore ? Number(scoreData.partialScore) : null
          }, maxScore) : null,
          maxScore: maxScore,
          status: status as any
        }
      })

      const totalScore = scores.reduce((sum, score) => 
        sum + (score.score || 0), 0
      )
      const totalMaxScore = scores.reduce((sum, score) => 
        sum + score.maxScore, 0
      )

      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        studentNumber: student.studentId,
        grade: student.memberships?.[0]?.class?.name?.match(/(\d+)/)?.[1],
        className: student.memberships?.[0]?.class?.name,
        attendanceNumber: student.memberships?.[0]?.attendanceNumber || undefined,
        scores,
        totalScore,
        totalMaxScore
      }
    })

    // Excelワークブックの作成
    const workbook = new ExcelJS.Workbook()
    
    // シート作成
    const scoreSheet = workbook.addWorksheet("点数一覧")
    const statusSheet = workbook.addWorksheet("正誤一覧")

    for (const [sheetIndex, sheet] of [scoreSheet, statusSheet].entries()) {
      const isScoreSheet = sheetIndex === 0

      // 列幅の設定
      sheet.getColumn(1).width = 5
      sheet.getColumn(2).width = 6
      sheet.getColumn(3).width = 8
      sheet.getColumn(4).width = 6
      sheet.getColumn(5).width = 10
      sheet.getColumn(6).width = 12
      sheet.getColumn(7).width = 8  // 合計列

      // フリーズペイン（G7で固定）
      sheet.views = [{ state: "frozen", xSplit: 6, ySplit: 6 }]

      // ヘッダー部分の設定
      sheet.getRow(2).getCell('B').value = projectResult.examName
      sheet.getRow(3).getCell('B').value = `採点結果 - ${sheet.name}`
      
      // ヘッダーのマージとスタイル
      sheet.mergeCells("B2:E4")
      const titleCell = sheet.getRow(2).getCell('B')
      titleCell.alignment = { horizontal: "center", vertical: "middle" }
      titleCell.font = { size: 14, name: "Meiryo UI", bold: true }
      titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      
      // ヘッダー行の設定
      sheet.getRow(2).getCell('F').value = "大問"
      sheet.getRow(3).getCell('F').value = "小問" 
      sheet.getRow(4).getCell('F').value = "枝問"
      sheet.getRow(5).getCell('F').value = "配点"

      sheet.getRow(6).getCell('B').value = "学年"
      sheet.getRow(6).getCell('C').value = "学級"
      sheet.getRow(6).getCell('D').value = "出席番号"
      sheet.getRow(6).getCell('E').value = "生徒番号"
      sheet.getRow(6).getCell('F').value = "氏名"
      sheet.getRow(6).getCell('G').value = isScoreSheet ? "合計得点" : "正答数"

      // 小計列（大問ごと）
      let colIndex = 8  // H列から
      for (const daimon of daimonList) {
        const col = getExcelColumnLetter(colIndex)
        sheet.getRow(2).getCell(col).value = daimon
        sheet.getRow(3).getCell(col).value = "小計"
        sheet.getRow(4).getCell(col).value = ""
        sheet.getRow(5).getCell(col).value = ""
        sheet.getRow(6).getCell(col).value = isScoreSheet ? "小計点" : "正答数"
        sheet.getColumn(colIndex).width = 8
        colIndex++
      }

      // 設問列
      let questionColIndex = colIndex
      for (const score of scoringData[0]?.scores || []) {
        const col = getExcelColumnLetter(questionColIndex)
        sheet.getRow(2).getCell(col).value = score.daimon || ""
        sheet.getRow(3).getCell(col).value = score.shomon || ""
        sheet.getRow(4).getCell(col).value = score.shimon || ""
        sheet.getRow(5).getCell(col).value = score.maxScore
        sheet.getRow(6).getCell(col).value = score.questionLabel
        sheet.getColumn(questionColIndex).width = 6
        questionColIndex++
      }

      // 順位列の設定
      const gradeRankCol = getExcelColumnLetter(questionColIndex)
      const classRankCol = getExcelColumnLetter(questionColIndex + 1)
      const averageCol = getExcelColumnLetter(questionColIndex + 2)
      
      sheet.getRow(6).getCell(gradeRankCol).value = "学年順位"
      sheet.getRow(6).getCell(classRankCol).value = "学級順位"
      sheet.getRow(6).getCell(averageCol).value = "平均点"
      sheet.getColumn(questionColIndex).width = 8
      sheet.getColumn(questionColIndex + 1).width = 8
      sheet.getColumn(questionColIndex + 2).width = 8

      // データ行の設定
      let rowIndex = 7  // 7行目からデータ開始
      const startRow = 7
      const endRow = startRow + scoringData.length - 1

      for (const student of scoringData) {
        // 行を明示的に作成
        const row = sheet.getRow(rowIndex)
        
        row.getCell('B').value = student.grade || ""
        row.getCell('C').value = student.className || ""
        row.getCell('D').value = student.attendanceNumber || ""
        row.getCell('E').value = student.studentNumber
        row.getCell('F').value = student.studentName

        // 小計列の開始位置を計算
        let subtotalColIndex = 8
        
        // 小計（大問ごと）- Excel関数で計算
        for (const daimon of daimonList) {
          const daimonScores = student.scores.filter(s => s.daimon === daimon)
          const col = getExcelColumnLetter(subtotalColIndex)
          
          if (daimonScores.length > 0) {
            // この大問の設問列の範囲を計算
            const firstQuestionIndex = scoringData[0]?.scores.findIndex(s => s.daimon === daimon)
            const lastQuestionIndex = scoringData[0]?.scores.map((s, i) => s.daimon === daimon ? i : -1).filter(i => i !== -1).pop()
            
            if (firstQuestionIndex !== -1 && lastQuestionIndex !== undefined) {
              const firstCol = getExcelColumnLetter(colIndex + firstQuestionIndex)
              const lastCol = getExcelColumnLetter(colIndex + lastQuestionIndex)
              
              if (isScoreSheet) {
                row.getCell(col).value = { formula: `SUM(${firstCol}${rowIndex}:${lastCol}${rowIndex})` }
              } else {
                // 正誤一覧では正答数をカウント
                row.getCell(col).value = { formula: `COUNTIF(${firstCol}${rowIndex}:${lastCol}${rowIndex},"○")` }
              }
            }
          }
          subtotalColIndex++
        }

        // 設問別データ
        let scoreColIndex = subtotalColIndex
        for (const score of student.scores) {
          const col = getExcelColumnLetter(scoreColIndex)
          if (isScoreSheet) {
            row.getCell(col).value = score.score
          } else {
            row.getCell(col).value = getStatusDisplayText(
              score.score, 
              score.maxScore, 
              score.status
            )
          }
          scoreColIndex++
        }

        // 合計得点 - Excel関数で計算
        const firstScoreCol = getExcelColumnLetter(subtotalColIndex)
        const lastScoreCol = getExcelColumnLetter(scoreColIndex - 1)
        if (isScoreSheet) {
          row.getCell('G').value = { formula: `SUM(${firstScoreCol}${rowIndex}:${lastScoreCol}${rowIndex})` }
        } else {
          row.getCell('G').value = { formula: `COUNTIF(${firstScoreCol}${rowIndex}:${lastScoreCol}${rowIndex},"○")` }
        }

        // 順位列 - Excel関数で計算
        if (isScoreSheet) {
          // 学年順位（降順）
          row.getCell(gradeRankCol).value = {
            formula: `RANK(G${rowIndex},G$${startRow}:G$${endRow},0)`
          }
          
          // 学級順位（同じ学級の生徒のみ対象）
          row.getCell(classRankCol).value = {
            formula: `RANK(G${rowIndex},IF(C$${startRow}:C$${endRow}=C${rowIndex},G$${startRow}:G$${endRow}),0)`
          }
        }

        rowIndex++
      }

      // 平均点の計算（最下行に追加）
      if (isScoreSheet) {
        const avgRowIndex = endRow + 2
        const avgRow = sheet.getRow(avgRowIndex)
        
        avgRow.getCell('F').value = "平均点"
        avgRow.getCell('G').value = { formula: `AVERAGE(G${startRow}:G${endRow})` }
        
        // 大問別平均点
        let avgColIndex = 8
        for (let i = 0; i < daimonList.length; i++) {
          const col = getExcelColumnLetter(avgColIndex)
          avgRow.getCell(col).value = { formula: `AVERAGE(${col}${startRow}:${col}${endRow})` }
          avgColIndex++
        }
      }

      // スタイル適用
      
      // ヘッダー行のスタイル
      const headerRow = sheet.getRow(6)
      headerRow.font = { name: "Meiryo UI", bold: true, size: 10 }
      headerRow.alignment = { horizontal: "center", vertical: "middle" }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } }
      
      // データ行のスタイル
      for (let row = startRow; row <= endRow; row++) {
        const dataRow = sheet.getRow(row)
        dataRow.font = { name: "Meiryo UI", size: 9 }
        dataRow.alignment = { horizontal: "center", vertical: "middle" }
      }
      
      // 枠線の適用
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 6 && rowNumber <= endRow + 2) {
          row.eachCell((cell, colNumber) => {
            if (colNumber >= 2 && colNumber <= questionColIndex + 2) {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              }
            }
          })
        }
      })
    }

    // 出力パスの決定
    let outputPath = options.outputPath
    if (!outputPath) {
      const defaultFileName = `採点データ一覧_${new Date().toISOString().split('T')[0]}.xlsx`
      const result = await dialog.showSaveDialog({
        title: '採点データExcelの保存',
        defaultPath: defaultFileName,
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] }
        ]
      })
      
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'ユーザーによってキャンセルされました' }
      }
      
      outputPath = result.filePath
    }

    // Excelファイルの保存
    await workbook.xlsx.writeFile(outputPath)

    return {
      success: true,
      outputPath
    }

  } catch (error) {
    console.error('Error exporting grading data Excel:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    }
  }
}