import { dialog } from "electron"
import * as ExcelJS from "exceljs"
import { getStudentsForProject } from "./projectStudent"
import { getQuestionScoresForProject, calculateActualScore } from "./questionScore"
import { getLayoutRegionsByProjectId } from "./layoutRegion"
import { getProjectById } from "./project"
import { getQuestionGroupsByProjectId } from "./questionGroup"
import { getSubtotalDefinitionsByLayoutRegionId } from "./subtotalDefinition"
import { getAssignmentsByQuestionGroupItemId } from "./questionSubtotalAssignment"

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
  subtotalScores: SubtotalScore[]
}

interface SubtotalScore {
  subtotalRegionId: string
  subtotalLabel: string
  score: number
  maxScore: number
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

// 小計点の対象設問インデックスを取得する関数
async function getTargetQuestionIndicesForSubtotal(
  subtotalRegionId: string,
  scores: ScoreDetail[]
): Promise<number[]> {
  const targetIndices: number[] = []
  
  for (let i = 0; i < scores.length; i++) {
    const score = scores[i]
    const isTarget = await checkIfQuestionIsInSubtotal(score.questionId, subtotalRegionId)
    if (isTarget) {
      targetIndices.push(i)
    }
  }
  
  return targetIndices
}

// 設問が小計点の対象かチェックする関数（簡易版）
async function isQuestionInSubtotal(
  questionId: string,
  subtotalRegionId: string,
  subtotalScores: SubtotalScore[]
): Promise<boolean> {
  // 詳細版と同じロジックを使用
  return await checkIfQuestionIsInSubtotal(questionId, subtotalRegionId)
}

// 設問が小計点の対象かチェックする関数（詳細版）
async function checkIfQuestionIsInSubtotal(
  questionId: string, 
  subtotalRegionId: string
): Promise<boolean> {
  try {
    // 小計点領域に関連付けられたグループ項目を取得
    const subtotalDefinitions = await getSubtotalDefinitionsByLayoutRegionId(subtotalRegionId)
    
    if (!subtotalDefinitions || subtotalDefinitions.length === 0) {
      return false
    }

    // グループ別に項目をまとめる
    const groupMap = new Map<string, string[]>()
    
    for (const definition of subtotalDefinitions) {
      const groupId = definition.questionGroupItem?.questionGroupId
      if (!groupId) continue
      
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(definition.questionGroupItemId)
    }

    if (groupMap.size === 0) {
      return false
    }

    // 各グループで該当する設問を取得（GROUP内OR）
    const groupQuestionSets: Set<string>[] = []
    
    for (const [groupId, itemIds] of groupMap) {
      const groupQuestionIds = new Set<string>()
      
      // 各項目に関連付けられた設問を取得
      for (const itemId of itemIds) {
        try {
          const assignments = await getAssignmentsByQuestionGroupItemId(itemId)
          if (assignments && assignments.length > 0) {
            assignments.forEach((assignment: any) => {
              groupQuestionIds.add(assignment.questionLayoutRegionId)
            })
          }
        } catch (error) {
          console.error(`Error getting assignments for item ${itemId}:`, error)
        }
      }
      
      groupQuestionSets.push(groupQuestionIds)
    }

    // GROUP間AND：全てのグループに共通する設問を取得
    let finalQuestionIds: Set<string>
    if (groupQuestionSets.length === 1) {
      finalQuestionIds = groupQuestionSets[0]
    } else {
      finalQuestionIds = new Set()
      const firstGroup = groupQuestionSets[0]
      
      for (const qId of firstGroup) {
        const existsInAllGroups = groupQuestionSets.every(group => group.has(qId))
        if (existsInAllGroups) {
          finalQuestionIds.add(qId)
        }
      }
    }

    return finalQuestionIds.has(questionId)
  } catch (error) {
    console.error(`Error checking if question ${questionId} is in subtotal ${subtotalRegionId}:`, error)
    return false
  }
}

// 小計点を計算する関数（GROUP内OR、GROUP間AND）
async function calculateSubtotalScore(
  subtotalRegionId: string,
  studentScores: ScoreDetail[],
  questionRegions: any[]
): Promise<{ score: number; maxScore: number }> {
  try {
    // 小計点領域に関連付けられたグループ項目を取得
    const subtotalDefinitions = await getSubtotalDefinitionsByLayoutRegionId(subtotalRegionId)
    
    if (!subtotalDefinitions || subtotalDefinitions.length === 0) {
      return { score: 0, maxScore: 0 }
    }

    // グループ別に項目をまとめる
    const groupMap = new Map<string, string[]>()
    
    for (const definition of subtotalDefinitions) {
      const groupId = definition.questionGroupItem?.questionGroupId
      if (!groupId) continue
      
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(definition.questionGroupItemId)
    }

    if (groupMap.size === 0) {
      return { score: 0, maxScore: 0 }
    }

    // 各グループで該当する設問を取得（GROUP内OR）
    const groupQuestionSets: Set<string>[] = []
    
    for (const [groupId, itemIds] of groupMap) {
      const groupQuestionIds = new Set<string>()
      
      // 各項目に関連付けられた設問を取得
      for (const itemId of itemIds) {
        try {
          const assignments = await getAssignmentsByQuestionGroupItemId(itemId)
          if (assignments && assignments.length > 0) {
            assignments.forEach((assignment: any) => {
              groupQuestionIds.add(assignment.questionLayoutRegionId)
            })
          }
        } catch (error) {
          console.error(`Error getting assignments for item ${itemId}:`, error)
        }
      }
      
      groupQuestionSets.push(groupQuestionIds)
    }

    // GROUP間AND：全てのグループに共通する設問を取得
    let finalQuestionIds: Set<string>
    if (groupQuestionSets.length === 1) {
      finalQuestionIds = groupQuestionSets[0]
    } else {
      finalQuestionIds = new Set()
      const firstGroup = groupQuestionSets[0]
      
      for (const questionId of firstGroup) {
        const existsInAllGroups = groupQuestionSets.every(group => group.has(questionId))
        if (existsInAllGroups) {
          finalQuestionIds.add(questionId)
        }
      }
    }

    // 該当する設問の点数を合計
    let totalScore = 0
    let totalMaxScore = 0
    
    for (const questionId of finalQuestionIds) {
      const scoreDetail = studentScores.find(s => s.questionId === questionId)
      if (scoreDetail) {
        totalScore += scoreDetail.score || 0
        totalMaxScore += scoreDetail.maxScore
      }
    }

    return { score: totalScore, maxScore: totalMaxScore }
  } catch (error) {
    console.error(`Error calculating subtotal score for region ${subtotalRegionId}:`, error)
    return { score: 0, maxScore: 0 }
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
    const questionGroups = await getQuestionGroupsByProjectId(projectId)

    // 選択された生徒のデータをフィルタリングし、受験生徒順（customOrder）でソート
    const selectedStudents = studentsResult.students
      .filter(student => selectedStudentIds.includes(student.id))
      .sort((a, b) => {
        // customOrderで並び替え（小さい値が先）
        const aOrder = (a as any).customOrder !== undefined 
          ? (a as any).customOrder 
          : 999999
        const bOrder = (b as any).customOrder !== undefined 
          ? (b as any).customOrder 
          : 999999

        // customOrderが同じ場合は姓名でソート
        if (aOrder === bOrder) {
          const aName = `${a.lastName}${a.firstName}`
          const bName = `${b.lastName}${b.firstName}`
          return aName.localeCompare(bName, "ja")
        }

        return aOrder - bOrder
      })

    if (selectedStudents.length === 0) {
      throw new Error('選択された生徒が見つかりません')
    }

    // 設問情報を取得（QUESTION_ANSWERタイプのみを設問として扱う）
    const questionRegions = layoutRegions.filter((region: any) => 
      region.type === 'QUESTION_ANSWER'
    ).sort((a: any, b: any) => {
      // orderIndexがある場合はそれでソート、ない場合は座標でソート
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
        return a.orderIndex - b.orderIndex
      }
      // Y座標でソート（上から下）、同じYの場合はX座標でソート（左から右）
      if (Math.abs(a.y - b.y) < 0.01) {
        return a.x - b.x
      }
      return a.y - b.y
    })
    
    // 小計点領域を取得
    const subtotalRegions = layoutRegions.filter((region: any) => 
      region.type === 'SUBTOTAL_SCORE'
    ).sort((a: any, b: any) => {
      // orderIndexがある場合はそれでソート、ない場合は座標でソート
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
        return a.orderIndex - b.orderIndex
      }
      // Y座標でソート（上から下）、同じYの場合はX座標でソート（左から右）
      if (Math.abs(a.y - b.y) < 0.01) {
        return a.x - b.x
      }
      return a.y - b.y
    })

    // 小計点の対象設問マップを事前に構築（パフォーマンス向上）
    const subtotalTargetMap = new Map<string, number[]>()
    
    for (const subtotalRegion of subtotalRegions) {
      const targetIndices: number[] = []
      
      for (let i = 0; i < questionRegions.length; i++) {
        const questionRegion = questionRegions[i]
        const isTarget = await checkIfQuestionIsInSubtotal(questionRegion.id, subtotalRegion.id)
        if (isTarget) {
          targetIndices.push(i)
        }
      }
      
      subtotalTargetMap.set(subtotalRegion.id, targetIndices)
      console.log(`Subtotal ${subtotalRegion.id} targets questions at indices: ${targetIndices.join(', ')}`)
    }

    // 採点データの構造化
    const scoringData: ScoringData[] = await Promise.all(
      selectedStudents.map(async (student) => {
        const studentScores = questionScores.success ? questionScores.scores?.filter((score: any) => 
          score.answerSheet?.studentId === student.id
        ) || [] : []

        const scores: ScoreDetail[] = questionRegions.map((region: any) => {
          const scoreData = studentScores.find((score: any) => 
            score.layoutRegionId === region.id
          )

          const maxScore = region.points || region.maxScore || 10
          const status = scoreData?.status || "unscored"
          
          const actualScore = scoreData ? calculateActualScore({
            status: scoreData.status,
            partialScore: scoreData.partialScore ? Number(scoreData.partialScore) : null
          }, maxScore) : null

          return {
            questionId: region.id,
            questionLabel: region.label || `問${region.orderIndex || 1}`,
            daimon: region.label || `問${region.orderIndex || 1}`,
            shomon: region.questionSubNumber?.toString() || "",
            shimon: region.questionSubSubNumber?.toString() || "",
            score: actualScore,
            maxScore: maxScore,
            status: status as any
          }
        })

        // 小計点を計算
        const subtotalScores: SubtotalScore[] = await Promise.all(
          subtotalRegions.map(async (region: any) => {
            const { score, maxScore } = await calculateSubtotalScore(
              region.id,
              scores,
              questionRegions
            )
            
            return {
              subtotalRegionId: region.id,
              subtotalLabel: region.label || `小計${region.orderIndex || 1}`,
              score,
              maxScore
            }
          })
        )

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
          totalMaxScore,
          subtotalScores
        }
      })
    )

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

      // 小計列（小計点領域ごと）
      let colIndex = 8  // H列から
      for (const subtotalRegion of subtotalRegions) {
        const col = getExcelColumnLetter(colIndex)
        sheet.getRow(2).getCell(col).value = subtotalRegion.label || `小計${subtotalRegion.orderIndex || 1}`
        sheet.getRow(3).getCell(col).value = "小計"
        sheet.getRow(4).getCell(col).value = ""
        sheet.getRow(5).getCell(col).value = ""
        sheet.getRow(6).getCell(col).value = isScoreSheet ? "小計点" : "正答数"
        sheet.getColumn(colIndex).width = 10
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
        
        // 小計（小計点領域ごと）- 正確な小計点ロジックでExcel関数を組む
        // 設問列の開始位置を計算（小計列の後から設問列が始まる）
        const questionStartColIndex = 8 + subtotalRegions.length
        
        for (let i = 0; i < subtotalRegions.length; i++) {
          const col = getExcelColumnLetter(subtotalColIndex)
          const subtotalScore = student.subtotalScores[i]
          
          if (subtotalScore) {
            console.log(`Processing subtotal ${col} for region ${subtotalScore.subtotalRegionId}: score=${subtotalScore.score}, maxScore=${subtotalScore.maxScore}`)
            
            // 事前に構築したマップから対象設問を取得
            const targetQuestionIndices = subtotalTargetMap.get(subtotalScore.subtotalRegionId) || []
            
            if (targetQuestionIndices.length > 0) {
              // 対象設問の列番号を取得
              const targetCells = targetQuestionIndices.map(index => {
                const questionCol = getExcelColumnLetter(questionStartColIndex + index)
                return `${questionCol}${rowIndex}`
              })
              
              if (isScoreSheet) {
                // 点数一覧：対象設問の合計
                const formula = targetCells.join('+')
                console.log(`Setting formula for subtotal ${col}: ${formula}`)
                row.getCell(col).value = { formula }
              } else {
                // 正誤一覧：対象設問の正答数
                const formula = targetCells.map(cell => `IF(${cell}="○",1,0)`).join('+')
                console.log(`Setting formula for subtotal ${col}: ${formula}`)
                row.getCell(col).value = { formula }
              }
            } else {
              console.log(`No target questions found for subtotal ${col}, setting to 0`)
              row.getCell(col).value = 0
            }
          } else {
            console.log(`No subtotal score found for subtotal ${col}, setting to 0`)
            row.getCell(col).value = 0
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

        // 順位列 - Excel関数で計算（受験生徒順でソート済みデータに基づく）
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
        
        // 小計点別平均点
        let avgColIndex = 8
        for (let i = 0; i < subtotalRegions.length; i++) {
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