import { app, dialog } from "electron"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { getAnswerSheetsByProjectId } from "./answerSheet"
import { getStudentsForProject } from "./projectStudent"
import { getQuestionScoresForProject } from "./questionScore"
import { getLayoutRegionsByProjectId } from "./layoutRegion"

// 採点状態の型定義
type ScoringStatus = 
  | "unscored"      // 未採点
  | "correct"       // 正答
  | "partial"       // 部分点
  | "hold"          // 保留
  | "incorrect"     // 誤答
  | "no_answer"     // 無答

// 位置の型定義
type MarkPosition = 
  | "top-left"      // 左上
  | "top-center"    // 上
  | "top-right"     // 右上
  | "middle-left"   // 左
  | "middle-center" // 中央
  | "middle-right"  // 右
  | "bottom-left"   // 左下
  | "bottom-center" // 下
  | "bottom-right"  // 右下

// 採点マーク設定の型定義
interface ScoringMarkConfig {
  showMarkForStatus: Record<ScoringStatus, boolean>
  showScore: boolean
  position: MarkPosition
  offsetX: number
  offsetY: number
  markSize: number
  scoreSize: number
  useTransparent: boolean
}

interface ExportScoredAnswersOptions {
  projectId: string
  selectedStudentIds: string[]
  outputPath?: string
  scoringMarkConfig?: ScoringMarkConfig
  progressCallback?: (progress: {
    current: number
    total: number
    step: string
    percentage: number
  }) => void
}

// 採点状態を判定する関数
function determineScoringStatus(score: number, maxScore: number): ScoringStatus {
  if (score === null || score === undefined) return "unscored"
  if (score === maxScore) return "correct"
  if (score === 0) return "incorrect"
  if (score > 0 && score < maxScore) return "partial"
  return "unscored"
}

// 採点マーク画像のパスを取得する関数
function getMarkImagePath(status: ScoringStatus, useTransparent: boolean): string {
  const publicDir = path.join(process.cwd(), 'public')
  const prefix = useTransparent ? "tranceparent_" : ""
  
  switch (status) {
    case "unscored": return path.join(publicDir, 'score-assets', `${prefix}unscored.png`)
    case "correct": return path.join(publicDir, 'score-assets', `${prefix}correct.png`)
    case "partial": return path.join(publicDir, 'score-assets', `${prefix}partial.png`)
    case "hold": return path.join(publicDir, 'score-assets', `${prefix}hold.png`)
    case "incorrect": return path.join(publicDir, 'score-assets', `${prefix}incorrect.png`)
    case "no_answer": return path.join(publicDir, 'score-assets', `${prefix}incorrect.png`)
    default: return path.join(publicDir, 'score-assets', `${prefix}unscored.png`)
  }
}

// マーク位置を計算する関数
function calculateMarkPosition(
  position: MarkPosition,
  offsetX: number,
  offsetY: number,
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  markSize: number
): { x: number, y: number } {
  let baseX: number, baseY: number

  // 基準位置を計算
  switch (position) {
    case "top-left":
      baseX = regionX
      baseY = regionY
      break
    case "top-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY
      break
    case "top-right":
      baseX = regionX + regionWidth - markSize
      baseY = regionY
      break
    case "middle-left":
      baseX = regionX
      baseY = regionY + regionHeight / 2 - markSize / 2
      break
    case "middle-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2
      break
    case "middle-right":
      baseX = regionX + regionWidth - markSize
      baseY = regionY + regionHeight / 2 - markSize / 2
      break
    case "bottom-left":
      baseX = regionX
      baseY = regionY + regionHeight - markSize
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight - markSize
      break
    case "bottom-right":
      baseX = regionX + regionWidth - markSize
      baseY = regionY + regionHeight - markSize
      break
    default:
      baseX = regionX + regionWidth - markSize
      baseY = regionY
  }

  // オフセットを適用
  return {
    x: baseX + offsetX,
    y: baseY + offsetY
  }
}

export async function exportScoredAnswersPDF(options: ExportScoredAnswersOptions): Promise<{
  success: boolean
  outputPath?: string
  error?: string
}> {
  try {
    const { projectId, selectedStudentIds, scoringMarkConfig, progressCallback } = options

    // 進捗レポート関数
    const reportProgress = (current: number, total: number, step: string) => {
      const percentage = Math.round((current / total) * 100)
      progressCallback?.({ current, total, step, percentage })
    }

    reportProgress(0, 100, 'データを取得中...')

    // データの取得
    const studentsResult = await getStudentsForProject(projectId)
    if (!studentsResult.success || !studentsResult.students) {
      throw new Error('生徒データの取得に失敗しました')
    }

    reportProgress(10, 100, '答案データを取得中...')

    const answerSheetsResult = await getAnswerSheetsByProjectId(projectId)
    if (!answerSheetsResult.success || !answerSheetsResult.answerSheets) {
      throw new Error('答案データの取得に失敗しました')
    }

    reportProgress(20, 100, '採点データを取得中...')

    const questionScores = await getQuestionScoresForProject(projectId)
    const layoutRegions = await getLayoutRegionsByProjectId(projectId)

    // 選択された生徒のデータをフィルタリング
    const selectedStudents = studentsResult.students.filter(student => 
      selectedStudentIds.includes(student.id)
    )

    if (selectedStudents.length === 0) {
      throw new Error('選択された生徒が見つかりません')
    }

    reportProgress(30, 100, 'PDFドキュメントを初期化中...')

    // PDFドキュメントの作成
    const pdfDoc = await PDFDocument.create()
    
    console.log('Selected students count:', selectedStudents.length)
    console.log('Total answer sheets:', answerSheetsResult.answerSheets.length)

    // 全体の答案枚数を計算
    let totalAnswerSheets = 0
    const studentAnswerSheetMap = new Map()
    
    for (const student of selectedStudents) {
      const studentAnswerSheets = answerSheetsResult.answerSheets.filter(
        sheet => sheet.student?.id === student.id
      )
      studentAnswerSheetMap.set(student.id, studentAnswerSheets)
      totalAnswerSheets += studentAnswerSheets.length
    }

    let processedSheets = 0

    // 各生徒の採点済み答案を処理
    for (const student of selectedStudents) {
      const studentAnswerSheets = studentAnswerSheetMap.get(student.id) || []

      console.log(`Student ${student.studentId}: ${studentAnswerSheets.length} answer sheets found`)

      for (const answerSheet of studentAnswerSheets) {
        const progressStep = `${student.lastName} ${student.firstName}の答案を処理中... (${processedSheets + 1}/${totalAnswerSheets})`
        reportProgress(40 + (processedSheets / totalAnswerSheets) * 50, 100, progressStep)
        // 答案画像の取得と処理
        console.log('Answer sheet:', JSON.stringify(answerSheet, null, 2))
        if ((answerSheet as any).originalImagePath) {
          try {
            const answerImagePath = path.join(app.getPath("userData"), (answerSheet as any).originalImagePath)
            console.log('Looking for answer image at:', answerImagePath)
            
            // 画像が存在するかチェック
            if (fs.existsSync(answerImagePath)) {
              console.log('Answer image found, adding to PDF')
              // 画像をPDFに追加
              await addAnswerSheetToPDF(pdfDoc, answerImagePath, answerSheet, questionScores, layoutRegions, scoringMarkConfig)
              console.log('Successfully added answer sheet to PDF')
            } else {
              console.warn('Answer image not found at:', answerImagePath)
            }
          } catch (imageError) {
            console.warn(`Failed to process answer sheet for student ${student.studentId}:`, imageError)
            // 個別の画像処理エラーは警告として扱い、処理を続行
          }
        } else {
          console.warn('Answer sheet has no originalImagePath:', answerSheet)
        }
        processedSheets++
      }
    }

    reportProgress(90, 100, 'PDFファイルを保存中...')

    // 出力パスの決定
    let outputPath = options.outputPath
    if (!outputPath) {
      const defaultFileName = `採点済み答案_${new Date().toISOString().split('T')[0]}.pdf`
      const result = await dialog.showSaveDialog({
        title: '採点済み答案PDFの保存',
        defaultPath: defaultFileName,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      })
      
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'ユーザーによってキャンセルされました' }
      }
      
      outputPath = result.filePath
    }

    // PDFに追加されたページ数をチェック
    const pageCount = pdfDoc.getPageCount()
    console.log(`PDF created with ${pageCount} pages`)

    if (pageCount === 0) {
      throw new Error('答案データが見つからないか、画像ファイルが存在しません')
    }

    // PDFファイルの保存
    const pdfBytes = await pdfDoc.save()
    fs.writeFileSync(outputPath, pdfBytes)

    reportProgress(100, 100, '完了しました')

    return {
      success: true,
      outputPath
    }

  } catch (error) {
    console.error('Error exporting scored answers PDF:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    }
  }
}

async function addAnswerSheetToPDF(
  pdfDoc: PDFDocument,
  imagePath: string,
  answerSheet: any,
  questionScores: any,
  layoutRegions: any[],
  scoringMarkConfig?: ScoringMarkConfig
): Promise<void> {
  try {
    // 画像を読み込み
    const imageBuffer = fs.readFileSync(imagePath)
    
    // 画像形式を判定して埋め込み
    let image
    const ext = path.extname(imagePath).toLowerCase()
    
    if (ext === '.png') {
      image = await pdfDoc.embedPng(imageBuffer)
    } else if (ext === '.jpg' || ext === '.jpeg') {
      image = await pdfDoc.embedJpg(imageBuffer)
    } else {
      // その他の形式はSharpを使ってPNGに変換
      const pngBuffer = await sharp(imageBuffer).png().toBuffer()
      image = await pdfDoc.embedPng(pngBuffer)
    }

    // 新しいページを追加
    const page = pdfDoc.addPage(PageSizes.A4)
    const { width, height } = page.getSize()

    // 画像のスケーリング計算
    const imageAspectRatio = image.width / image.height
    const pageAspectRatio = width / height

    let imageWidth, imageHeight, imageX, imageY

    if (imageAspectRatio > pageAspectRatio) {
      // 画像が横長の場合
      imageWidth = width * 0.9 // 余白を考慮
      imageHeight = imageWidth / imageAspectRatio
      imageX = width * 0.05
      imageY = (height - imageHeight) / 2
    } else {
      // 画像が縦長の場合
      imageHeight = height * 0.9 // 余白を考慮
      imageWidth = imageHeight * imageAspectRatio
      imageX = (width - imageWidth) / 2
      imageY = height * 0.05
    }

    // 答案画像を描画
    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    })

    // 採点情報を重ね合わせ
    const relevantScores = questionScores.success && questionScores.scores 
      ? questionScores.scores.filter((score: any) => 
          score.answerSheet?.id === answerSheet.id
        )
      : []
    
    console.log(`Found ${relevantScores.length} scoring records for answer sheet ${answerSheet.id}`)

    // デフォルト設定
    const defaultConfig: ScoringMarkConfig = {
      showMarkForStatus: {
        unscored: false,
        correct: true,
        partial: true,
        hold: true,
        incorrect: true,
        no_answer: true,
      },
      showScore: true,
      position: "top-right",
      offsetX: 0,
      offsetY: 0,
      markSize: 50,
      scoreSize: 14,
      useTransparent: false,
    }

    const config = scoringMarkConfig || defaultConfig

    for (const score of relevantScores) {
      const layoutRegion = layoutRegions.find(region => region.id === score.layoutRegionId)
      if (!layoutRegion) continue

      // 採点状態を判定
      const scoringStatus = determineScoringStatus(score.score, score.maxScore || 10)
      
      // この状態のマークを表示するかチェック
      if (!config.showMarkForStatus[scoringStatus]) continue

      // 採点枠の位置をPDF座標系に変換
      const regionXOnImage = (layoutRegion.x / image.width) * imageWidth + imageX
      const regionYOnImage = imageY + imageHeight - ((layoutRegion.y + layoutRegion.height) / image.height) * imageHeight
      const regionWidthOnImage = (layoutRegion.width / image.width) * imageWidth
      const regionHeightOnImage = (layoutRegion.height / image.height) * imageHeight

      // 採点マークの位置を採点枠基準で計算
      const markPosition = calculateMarkPosition(
        config.position,
        config.offsetX,
        config.offsetY,
        regionXOnImage,
        regionYOnImage,
        regionWidthOnImage,
        regionHeightOnImage,
        config.markSize
      )

      try {
        // 採点マーク画像を読み込んで描画
        const markImagePath = getMarkImagePath(scoringStatus, config.useTransparent)
        if (fs.existsSync(markImagePath)) {
          const markImageBuffer = fs.readFileSync(markImagePath)
          const markImage = await pdfDoc.embedPng(markImageBuffer)
          
          page.drawImage(markImage, {
            x: markPosition.x,
            y: markPosition.y,
            width: config.markSize,
            height: config.markSize,
          })
        }
      } catch (markError) {
        console.warn('Failed to draw scoring mark:', markError)
        // マーク描画に失敗しても続行
      }

      // 点数を描画
      if (config.showScore && score.score !== null && score.score !== undefined) {
        const scoreText = score.maxScore ? `${score.score}/${score.maxScore}` : `${score.score}`
        const scoreX = markPosition.x + config.markSize + 5 // マークの右側に配置
        const scoreY = markPosition.y + config.markSize / 2 // マークの中央に配置

        page.drawText(scoreText, {
          x: scoreX,
          y: scoreY,
          size: config.scoreSize,
          color: rgb(1, 0, 0), // 赤色
        })
      }

      // コメントがある場合は描画
      if (score.comment) {
        const commentX = markPosition.x
        const commentY = markPosition.y - 20

        page.drawText(score.comment, {
          x: commentX,
          y: commentY,
          size: Math.max(8, config.scoreSize - 4),
          color: rgb(0.5, 0, 0), // 暗い赤色
        })
      }
    }

    // ヘッダー情報の描画
    if (answerSheet.student) {
      const headerText = `${answerSheet.student.lastName} ${answerSheet.student.firstName} (${answerSheet.student.studentId})`
      page.drawText(headerText, {
        x: 50,
        y: height - 30,
        size: 14,
        color: rgb(0, 0, 0),
      })
    }

  } catch (error) {
    console.error('Error adding answer sheet to PDF:', error)
    throw error
  }
}