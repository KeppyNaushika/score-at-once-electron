import { dialog } from "electron"
import { PDFDocument, rgb, PageSizes } from "pdf-lib"
const fontkit = require("fontkit")
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { getAnswerSheetsByProjectId } from "./answerSheet"
import { getStudentsForProject } from "./projectStudent"
import { getQuestionScoresForProject, calculateActualScore } from "./questionScore"
import { getLayoutRegionsByProjectId } from "./layoutRegion"
import { getAbsolutePathFromData } from "../dataManager"


// 採点状態の型定義（フロントエンドと統一）
type ScoringStatus = 
  | "ungraded"      // 未採点
  | "correct"       // 正答
  | "partial"       // 部分点
  | "pending"       // 保留
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

// テキスト配置の型定義
type TextAlignment = "left" | "center" | "right"

// 採点マーク設定の型定義
interface ScoringMarkConfig {
  showMarkForStatus: Record<ScoringStatus, boolean>
  showScoreForStatus: Record<ScoringStatus, boolean>
  // 採点マーク用設定
  markPosition: MarkPosition
  markOffsetX: number
  markOffsetY: number
  markSize: number
  // 点数テキスト用設定
  scorePosition: MarkPosition
  scoreOffsetX: number
  scoreOffsetY: number
  scoreSize: number
  scoreAlignment: TextAlignment
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


// 採点マーク画像のパスを取得する関数
function getMarkImagePath(status: ScoringStatus, useTransparent: boolean): string {
  const publicDir = path.join(process.cwd(), 'public')
  const prefix = useTransparent ? "tranceparent_" : ""
  
  switch (status) {
    case "ungraded": return path.join(publicDir, 'score-assets', `${prefix}unscored.png`)
    case "correct": return path.join(publicDir, 'score-assets', `${prefix}correct.png`)
    case "partial": return path.join(publicDir, 'score-assets', `${prefix}partial.png`)
    case "pending": return path.join(publicDir, 'score-assets', `${prefix}hold.png`)
    case "incorrect": return path.join(publicDir, 'score-assets', `${prefix}incorrect.png`)
    case "no_answer": return path.join(publicDir, 'score-assets', `${prefix}incorrect.png`)
    default: return path.join(publicDir, 'score-assets', `${prefix}unscored.png`)
  }
}

// マーク位置を計算する関数
// マーク画像の上下中央を長方形の9箇所の位置にそれぞれ揃える
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

  // 基準位置を計算（マーク画像の上下中央を基準とする）
  // PDF座標系では下が原点なので、top/bottomを正しく対応させる
  switch (position) {
    case "top-left":
      baseX = regionX - markSize / 2
      baseY = regionY + regionHeight - markSize / 2  // 上端
      break
    case "top-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight - markSize / 2  // 上端
      break
    case "top-right":
      baseX = regionX + regionWidth - markSize / 2
      baseY = regionY + regionHeight - markSize / 2  // 上端
      break
    case "middle-left":
      baseX = regionX - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2  // 中央
      break
    case "middle-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2  // 中央
      break
    case "middle-right":
      baseX = regionX + regionWidth - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2  // 中央
      break
    case "bottom-left":
      baseX = regionX - markSize / 2
      baseY = regionY - markSize / 2  // 下端
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY - markSize / 2  // 下端
      break
    case "bottom-right":
      baseX = regionX + regionWidth - markSize / 2
      baseY = regionY - markSize / 2  // 下端
      break
    default:
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2
  }

  // オフセットを適用（Y軸は直感的な方向に修正）
  return {
    x: baseX + offsetX,
    y: baseY - offsetY  // Y軸オフセットを反転させて直感的な方向にする
  }
}

// テキスト位置を計算する関数
function calculateTextPosition(
  position: MarkPosition,
  offsetX: number,
  offsetY: number,
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  textWidth: number,
  textHeight: number,
  alignment: TextAlignment
): { x: number, y: number } {
  let baseX: number, baseY: number

  // テキストの高さ補正（ベースラインを考慮）
  const textBaseline = textHeight * 0.3 // フォントのベースラインはおよそ高さの30%下
  
  // 基準位置を計算（テキストの視覚的中央を基準とする）
  switch (position) {
    case "top-left":
      baseX = regionX
      baseY = regionY + regionHeight - textHeight / 2 - textBaseline
      break
    case "top-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight - textHeight / 2 - textBaseline
      break
    case "top-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight - textHeight / 2 - textBaseline
      break
    case "middle-left":
      baseX = regionX
      baseY = regionY + regionHeight / 2 - textBaseline
      break
    case "middle-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2 - textBaseline
      break
    case "middle-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight / 2 - textBaseline
      break
    case "bottom-left":
      baseX = regionX
      baseY = regionY + textHeight / 2 - textBaseline
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + textHeight / 2 - textBaseline
      break
    case "bottom-right":
      baseX = regionX + regionWidth
      baseY = regionY + textHeight / 2 - textBaseline
      break
    default:
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2 - textBaseline
  }

  // テキストの配置（左揃え・中央揃え・右揃え）
  switch (alignment) {
    case "left":
      // baseXはそのまま
      break
    case "center":
      baseX = baseX - textWidth / 2
      break
    case "right":
      baseX = baseX - textWidth
      break
  }

  // オフセットを適用（Y軸は直感的な方向に修正）
  return {
    x: baseX + offsetX,
    y: baseY - offsetY  // Y軸オフセットを反転させて直感的な方向にする
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

    // 保存場所を最初に選択
    let outputPath = options.outputPath
    if (!outputPath) {
      reportProgress(0, 100, '保存場所を選択してください...')
      const defaultFileName = `採点済み答案_${new Date().toISOString().split('T')[0]}.pdf`
      const result = await dialog.showSaveDialog({
        title: '採点済み答案PDFの保存',
        defaultPath: defaultFileName,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      })
      
      if (result.canceled || !result.filePath) {
        throw new Error('ユーザーによってキャンセルされました')
      }
      
      outputPath = result.filePath
      reportProgress(5, 100, '保存場所が選択されました。データを取得中...')
    }

    reportProgress(10, 100, 'データを取得中...')

    // データの取得
    const studentsResult = await getStudentsForProject(projectId)
    if (!studentsResult.success || !studentsResult.students) {
      throw new Error('生徒データの取得に失敗しました')
    }

    reportProgress(20, 100, '答案データを取得中...')

    const answerSheetsResult = await getAnswerSheetsByProjectId(projectId)
    if (!answerSheetsResult.success || !answerSheetsResult.answerSheets) {
      throw new Error('答案データの取得に失敗しました')
    }

    reportProgress(30, 100, '採点データを取得中...')

    const questionScores = await getQuestionScoresForProject(projectId)
    const layoutRegions = await getLayoutRegionsByProjectId(projectId)

    // 選択された生徒のデータをフィルタリング
    const selectedStudents = studentsResult.students.filter(student => 
      selectedStudentIds.includes(student.id)
    )

    if (selectedStudents.length === 0) {
      throw new Error('選択された生徒が見つかりません')
    }

    reportProgress(40, 100, 'PDFドキュメントを初期化中...')

    // 全体の答案枚数を計算し、データの存在をチェック
    let totalAnswerSheets = 0
    const studentAnswerSheetMap = new Map()
    
    for (const student of selectedStudents) {
      const studentAnswerSheets = answerSheetsResult.answerSheets.filter(
        sheet => sheet.student?.id === student.id
      )
      studentAnswerSheetMap.set(student.id, studentAnswerSheets)
      totalAnswerSheets += studentAnswerSheets.length
    }

    // 答案データが存在しない場合は早期にエラーを投げる
    if (totalAnswerSheets === 0) {
      throw new Error('選択された生徒に答案データが見つかりません')
    }

    // 実際の答案画像ファイルの存在チェック
    let validAnswerSheets = 0
    for (const student of selectedStudents) {
      const studentAnswerSheets = studentAnswerSheetMap.get(student.id) || []
      console.log(`Student ${student.id}: ${studentAnswerSheets.length} answer sheets`)
      for (const answerSheet of studentAnswerSheets) {
        if ((answerSheet as any).originalImagePath) {
          const answerImagePath = getAbsolutePathFromData((answerSheet as any).originalImagePath)
          console.log(`Checking answer sheet path: ${answerImagePath}`)
          if (fs.existsSync(answerImagePath)) {
            validAnswerSheets++
          } else {
            console.warn(`Answer sheet not found: ${answerImagePath}`)
          }
        } else {
          console.warn(`Answer sheet missing originalImagePath for student ${student.id}`)
        }
      }
    }

    // 有効な答案画像が存在しない場合は早期にエラーを投げる
    if (validAnswerSheets === 0) {
      throw new Error('答案データが見つからないか、画像ファイルが存在しません')
    }

    // PDFドキュメントの作成
    const pdfDoc = await PDFDocument.create()
    
    // fontkit を登録
    pdfDoc.registerFontkit(fontkit)

    let processedSheets = 0

    // 各生徒の採点済み答案を処理
    for (const student of selectedStudents) {
      const studentAnswerSheets = studentAnswerSheetMap.get(student.id) || []

      for (const answerSheet of studentAnswerSheets) {
        const progressStep = `答案を処理中... (${processedSheets + 1}/${totalAnswerSheets})`
        const progressPercent = 50 + (processedSheets / totalAnswerSheets) * 40
        reportProgress(progressPercent, 100, progressStep)
        
        // 答案画像の取得と処理
        if ((answerSheet as any).originalImagePath) {
          try {
            const answerImagePath = getAbsolutePathFromData((answerSheet as any).originalImagePath)
            
            // 画像が存在するかチェック
            if (fs.existsSync(answerImagePath)) {
              // 画像をPDFに追加（進捗コールバック付き）
              await addAnswerSheetToPDF(
                pdfDoc, 
                answerImagePath, 
                answerSheet, 
                questionScores, 
                layoutRegions, 
                scoringMarkConfig,
                (step) => {
                  reportProgress(progressPercent + (1 / totalAnswerSheets) * 40 * 0.5, 100, `${progressStep} - ${step}`)
                }
              )
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

    reportProgress(90, 100, 'PDFファイルを生成中...')

    // PDFに追加されたページ数をチェック
    const pageCount = pdfDoc.getPageCount()

    if (pageCount === 0) {
      throw new Error('PDF生成中にエラーが発生しました。答案画像の読み込みに失敗した可能性があります')
    }

    // PDF バイト生成（進捗表示）
    reportProgress(95, 100, 'PDFドキュメントを最適化中...')
    const pdfBytes = await pdfDoc.save()

    // PDFファイルの保存
    reportProgress(98, 100, 'ファイルを保存中...')
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
  scoringMarkConfig?: ScoringMarkConfig,
  progressCallback?: (step: string) => void
): Promise<void> {
  try {
    progressCallback?.('画像を読み込み中...')
    
    // フォントを初期化
    const font = await pdfDoc.embedFont('Helvetica')

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

    progressCallback?.('答案画像を描画中...')
    
    // 答案画像を描画
    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    })

    progressCallback?.('採点情報を重ね合わせ中...')
    
    // 採点情報を重ね合わせ
    const relevantScores = questionScores.success && questionScores.scores 
      ? questionScores.scores.filter((score: any) => 
          score.answerSheet?.id === answerSheet.id
        )
      : []
    
    console.log(`📊 答案 ${answerSheet.id} の採点データ数: ${relevantScores.length}`)
    
    // 採点データを適切に処理
    const processedScores = relevantScores.map((score: any) => {
      const layoutRegion = layoutRegions.find(region => region.id === score.layoutRegionId)
      const maxScore = layoutRegion?.points || 10
      const actualScore = calculateActualScore(score, maxScore)
      
      return {
        ...score,
        score: actualScore,
        maxScore: maxScore
      }
    })
    
    processedScores.forEach((score: any, index: number) => {
      console.log(`  ${index + 1}. 領域ID: ${score.layoutRegionId}, 点数: ${score.score}/${score.maxScore}, 状態: ${score.status}`)
    })
    

    // デフォルト設定
    const defaultConfig: ScoringMarkConfig = {
      showMarkForStatus: {
        ungraded: true,    // 未採点も表示してテストするため
        correct: true,
        partial: true,
        pending: true,
        incorrect: true,
        no_answer: true,
      },
      showScoreForStatus: {
        ungraded: false,
        correct: true,
        partial: true,
        pending: true,
        incorrect: true,
        no_answer: true,
      },
      // 採点マーク設定
      markPosition: "middle-center",  // 既定を中央に変更
      markOffsetX: 0,
      markOffsetY: 0,
      markSize: 50,
      // 点数テキスト設定
      scorePosition: "middle-center",  // 既定を中央に配置
      scoreOffsetX: 0,  // 中央配置なのでオフセットなし
      scoreOffsetY: 0,
      scoreSize: 14,
      scoreAlignment: "center",  // 中央揃え
      useTransparent: false,
    }

    const config = {
      ...defaultConfig,
      ...scoringMarkConfig,
      showMarkForStatus: {
        ...defaultConfig.showMarkForStatus,
        ...(scoringMarkConfig?.showMarkForStatus || {})
      },
      showScoreForStatus: {
        ...defaultConfig.showScoreForStatus,
        ...(scoringMarkConfig?.showScoreForStatus || {})
      }
    }

    for (const score of processedScores) {
      const layoutRegion = layoutRegions.find(region => region.id === score.layoutRegionId)
      if (!layoutRegion) {
        console.warn(`❌ 採点領域が見つかりません: ${score.layoutRegionId}`)
        continue
      }

      // 採点状態を判定（statusを直接使用）
      const scoringStatus = score.status as ScoringStatus
      console.log(`🎯 採点状態判定: ${scoringStatus} (${score.score}/${score.maxScore})`)
      
      // この状態のマークを表示するかチェック
      if (!config.showMarkForStatus[scoringStatus]) {
        console.log(`⏭️  状態 ${scoringStatus} のマーク表示は無効化されています`)
        continue
      }

      // 採点枠の位置をPDF座標系に変換
      // layoutRegionの座標が正規化されている場合 (0.0-1.0)
      const isNormalized = layoutRegion.x <= 1.0 && layoutRegion.y <= 1.0 && layoutRegion.width <= 1.0 && layoutRegion.height <= 1.0
      
      let regionXOnImage, regionYOnImage, regionWidthOnImage, regionHeightOnImage
      
      if (isNormalized) {
        // 正規化座標の場合 (0.0-1.0)
        regionXOnImage = layoutRegion.x * imageWidth + imageX
        // PDF座標系（Y軸が下から上）に変換: 画像の上端から下端への座標を下端から上端に変換
        regionYOnImage = imageY + imageHeight - (layoutRegion.y + layoutRegion.height) * imageHeight
        regionWidthOnImage = layoutRegion.width * imageWidth
        regionHeightOnImage = layoutRegion.height * imageHeight
      } else {
        // ピクセル座標の場合
        regionXOnImage = (layoutRegion.x / image.width) * imageWidth + imageX
        // PDF座標系（Y軸が下から上）に変換: 画像の上端から下端への座標を下端から上端に変換
        regionYOnImage = imageY + imageHeight - ((layoutRegion.y + layoutRegion.height) / image.height) * imageHeight
        regionWidthOnImage = (layoutRegion.width / image.width) * imageWidth
        regionHeightOnImage = (layoutRegion.height / image.height) * imageHeight
      }

      console.log(`📐 座標変換詳細:`)
      console.log(`  - 画像サイズ: ${image.width}x${image.height}`)
      console.log(`  - PDF画像位置: x=${imageX}, y=${imageY}, w=${imageWidth}, h=${imageHeight}`)
      console.log(`  - 採点領域(元座標): x=${layoutRegion.x}, y=${layoutRegion.y}, w=${layoutRegion.width}, h=${layoutRegion.height}`)
      console.log(`  - 正規化判定: ${isNormalized}`)
      console.log(`  - 採点領域(PDF座標): x=${regionXOnImage}, y=${regionYOnImage}, w=${regionWidthOnImage}, h=${regionHeightOnImage}`)

      // 採点マークの位置を採点枠基準で計算
      const markPosition = calculateMarkPosition(
        config.markPosition,
        config.markOffsetX,
        config.markOffsetY,
        regionXOnImage,
        regionYOnImage,
        regionWidthOnImage,
        regionHeightOnImage,
        config.markSize
      )

      console.log(`🎯 マーク位置計算: x=${markPosition.x}, y=${markPosition.y} (位置: ${config.markPosition})`)
      console.log(`  - 採点領域中央Y: ${regionYOnImage + regionHeightOnImage / 2}`)
      console.log(`  - マーク中央Y: ${markPosition.y + config.markSize / 2}`)


      try {
        // 採点マーク画像を読み込んで描画
        const markImagePath = getMarkImagePath(scoringStatus, config.useTransparent)
        console.log(`🔍 採点マーク処理: status=${scoringStatus}, path=${markImagePath}`)
        
        if (fs.existsSync(markImagePath)) {
          console.log(`✅ 採点マーク画像発見: ${markImagePath}`)
          const markImageBuffer = fs.readFileSync(markImagePath)
          const markImage = await pdfDoc.embedPng(markImageBuffer)
          
          console.log(`🎯 採点マーク描画: x=${markPosition.x}, y=${markPosition.y}, size=${config.markSize}`)
          page.drawImage(markImage, {
            x: markPosition.x,
            y: markPosition.y,
            width: config.markSize,
            height: config.markSize,
          })
          console.log(`✅ 採点マーク描画完了`)
        } else {
          console.warn(`❌ 採点マーク画像が見つかりません: ${markImagePath}`)
        }
      } catch (markError) {
        console.warn('Failed to draw scoring mark:', markError)
        // マーク描画に失敗しても続行
      }

      // 点数を描画
      if (config.showScoreForStatus[scoringStatus] && score.score !== null && score.score !== undefined) {
        const scoreText = `${score.score}` // 満点表示は削除、点数のみ表示
        
        // テキストの幅を測定
        const textWidth = font.widthOfTextAtSize(scoreText, config.scoreSize)
        const textHeight = config.scoreSize // フォントサイズを高さとして使用
        
        // テキストの位置を計算（新しい関数を使用）
        const scorePosition = calculateTextPosition(
          config.scorePosition,
          config.scoreOffsetX,
          config.scoreOffsetY,
          regionXOnImage,
          regionYOnImage,
          regionWidthOnImage,
          regionHeightOnImage,
          textWidth,
          textHeight,
          config.scoreAlignment
        )

        console.log(`📝 点数描画: "${scoreText}" at x=${scorePosition.x}, y=${scorePosition.y} (位置: ${config.scorePosition}, 配置: ${config.scoreAlignment})`)

        page.drawText(scoreText, {
          x: scorePosition.x,
          y: scorePosition.y,
          size: config.scoreSize,
          font: font,
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
          font: font,
          color: rgb(0.5, 0, 0), // 暗い赤色
        })
      }
    }

    // ヘッダー情報は削除（日本語フォント問題を回避）

  } catch (error) {
    console.error('Error adding answer sheet to PDF:', error)
    throw error
  }
}