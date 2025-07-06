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
      sheet.getCell("B2").value = projectResult.examName
      sheet.getCell("B3").value = `採点結果 - ${sheet.name}`
      
      // ヘッダーのマージとスタイル
      sheet.mergeCells("B2:E4")
      const titleCell = sheet.getCell("B2")
      titleCell.alignment = { horizontal: "center", vertical: "middle" }
      titleCell.font = { size: 14, name: "Meiryo UI", bold: true }
      titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      
      // ヘッダー行の設定
      sheet.getCell("F2").value = "大問"
      sheet.getCell("F3").value = "小問" 
      sheet.getCell("F4").value = "枝問"
      sheet.getCell("F5").value = "配点"

      sheet.getCell("B6").value = "学年"
      sheet.getCell("C6").value = "学級"
      sheet.getCell("D6").value = "出席番号"
      sheet.getCell("E6").value = "生徒番号"
      sheet.getCell("F6").value = "氏名"
      sheet.getCell("G6").value = isScoreSheet ? "合計得点" : "正答数"

      // 小計列（大問ごと）
      let colIndex = 8  // H列から
      for (const daimon of daimonList) {
        const col = String.fromCharCode(64 + colIndex)
        sheet.getCell(`${col}2`).value = daimon
        sheet.getCell(`${col}3`).value = "小計"
        sheet.getCell(`${col}4`).value = ""
        sheet.getCell(`${col}5`).value = ""
        sheet.getCell(`${col}6`).value = isScoreSheet ? "小計点" : "正答数"
        sheet.getColumn(colIndex).width = 8
        colIndex++
      }

      // 設問列
      let questionColIndex = colIndex
      for (const score of scoringData[0]?.scores || []) {
        const col = String.fromCharCode(64 + questionColIndex)
        sheet.getCell(`${col}2`).value = score.daimon || ""
        sheet.getCell(`${col}3`).value = score.shomon || ""
        sheet.getCell(`${col}4`).value = score.shimon || ""
        sheet.getCell(`${col}5`).value = score.maxScore
        sheet.getCell(`${col}6`).value = score.questionLabel
        sheet.getColumn(questionColIndex).width = 6
        questionColIndex++
      }

      // 順位列の設定
      const gradeRankCol = String.fromCharCode(64 + questionColIndex)
      const classRankCol = String.fromCharCode(64 + questionColIndex + 1)
      const averageCol = String.fromCharCode(64 + questionColIndex + 2)
      
      sheet.getCell(`${gradeRankCol}6`).value = "学年順位"
      sheet.getCell(`${classRankCol}6`).value = "学級順位"
      sheet.getCell(`${averageCol}6`).value = "平均点"
      sheet.getColumn(questionColIndex).width = 8
      sheet.getColumn(questionColIndex + 1).width = 8
      sheet.getColumn(questionColIndex + 2).width = 8

      // データ行の設定
      let rowIndex = 7  // 7行目からデータ開始
      const startRow = 7
      const endRow = startRow + scoringData.length - 1

      for (const student of scoringData) {
        sheet.getCell(`B${rowIndex}`).value = student.grade || ""
        sheet.getCell(`C${rowIndex}`).value = student.className || ""
        sheet.getCell(`D${rowIndex}`).value = student.attendanceNumber || ""
        sheet.getCell(`E${rowIndex}`).value = student.studentNumber
        sheet.getCell(`F${rowIndex}`).value = student.studentName

        // 小計列の開始位置を計算
        let subtotalColIndex = 8
        
        // 小計（大問ごと）- Excel関数で計算
        for (const daimon of daimonList) {
          const daimonScores = student.scores.filter(s => s.daimon === daimon)
          const col = String.fromCharCode(64 + subtotalColIndex)
          
          if (daimonScores.length > 0) {
            // この大問の設問列の範囲を計算
            const firstQuestionIndex = scoringData[0]?.scores.findIndex(s => s.daimon === daimon)
            const lastQuestionIndex = scoringData[0]?.scores.map((s, i) => s.daimon === daimon ? i : -1).filter(i => i !== -1).pop()
            
            if (firstQuestionIndex !== -1 && lastQuestionIndex !== undefined) {
              const firstCol = String.fromCharCode(64 + colIndex + firstQuestionIndex)
              const lastCol = String.fromCharCode(64 + colIndex + lastQuestionIndex)
              
              if (isScoreSheet) {
                sheet.getCell(`${col}${rowIndex}`).value = { formula: `SUM(${firstCol}${rowIndex}:${lastCol}${rowIndex})` }
              } else {
                // 正誤一覧では正答数をカウント
                sheet.getCell(`${col}${rowIndex}`).value = { formula: `COUNTIF(${firstCol}${rowIndex}:${lastCol}${rowIndex},"○")` }
              }
            }
          }
          subtotalColIndex++
        }

        // 設問別データ
        let scoreColIndex = subtotalColIndex
        for (const score of student.scores) {
          const col = String.fromCharCode(64 + scoreColIndex)
          if (isScoreSheet) {
            sheet.getCell(`${col}${rowIndex}`).value = score.score
          } else {
            sheet.getCell(`${col}${rowIndex}`).value = getStatusDisplayText(
              score.score, 
              score.maxScore, 
              score.status
            )
          }
          scoreColIndex++
        }

        // 合計得点 - Excel関数で計算
        const firstScoreCol = String.fromCharCode(64 + subtotalColIndex)
        const lastScoreCol = String.fromCharCode(64 + scoreColIndex - 1)
        if (isScoreSheet) {
          sheet.getCell(`G${rowIndex}`).value = { formula: `SUM(${firstScoreCol}${rowIndex}:${lastScoreCol}${rowIndex})` }
        } else {
          sheet.getCell(`G${rowIndex}`).value = { formula: `COUNTIF(${firstScoreCol}${rowIndex}:${lastScoreCol}${rowIndex},"○")` }
        }

        // 順位列 - Excel関数で計算
        if (isScoreSheet) {
          // 学年順位（降順）
          sheet.getCell(`${gradeRankCol}${rowIndex}`).value = {
            formula: `RANK(G${rowIndex},G$${startRow}:G$${endRow},0)`
          }
          
          // 学級順位（同じ学級の生徒のみ対象）
          sheet.getCell(`${classRankCol}${rowIndex}`).value = {
            formula: `RANK(G${rowIndex},IF(C$${startRow}:C$${endRow}=C${rowIndex},G$${startRow}:G$${endRow}),0)`
          }
        }

        rowIndex++
      }

      // 平均点の計算（最下行に追加）
      if (isScoreSheet) {
        const avgRow = endRow + 2
        sheet.getCell(`F${avgRow}`).value = "平均点"
        sheet.getCell(`G${avgRow}`).value = { formula: `AVERAGE(G${startRow}:G${endRow})` }
        
        // 大問別平均点
        let avgColIndex = 8
        for (let i = 0; i < daimonList.length; i++) {
          const col = String.fromCharCode(64 + avgColIndex)
          sheet.getCell(`${col}${avgRow}`).value = { formula: `AVERAGE(${col}${startRow}:${col}${endRow})` }
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