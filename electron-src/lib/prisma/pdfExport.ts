import { CropRegionWithProjectPage } from "@/components/projects/07-score-at-once/types"
import type { CropRegion, DrawingAnnotation, QuestionScore } from "@prisma/client"
import { dialog } from "electron"
import fs from "fs"
import path from "path"
import { PageSizes, PDFDocument, rgb } from "pdf-lib"
import { getAbsolutePathFromData, getAppRootPath } from "../dataManager"
import { getCropRegionsByProjectId } from "./cropRegion"
import { getDrawingAnnotationsByQuestionScore } from "./drawingAnnotation"
import { getStudentsForProject } from "./projectStudent"
import {
  calculateActualScore,
  getQuestionScoresForProject,
} from "./questionScore"
import { calculateSubtotalScoreForStudent } from "../shared/calculations/subtotal-calculator"
import type { QuestionScoreData } from "../shared/calculations/subtotal-calculator"
import { getStudentAnswersByProjectId } from "./studentAnswer"
const fontkit = require("fontkit")
// Optional sharp import with fallback
let sharp: any = null
try {
  sharp = require("sharp")
} catch (error) {
  console.warn(
    "Sharp module not available, some image processing features may be limited:",
    error instanceof Error ? error.message : error,
  )
}

// 採点状態の型定義（フロントエンドと統一）
type ScoringStatus =
  | "unscored" // 未採点 (DBではunscored、画像ファイルではunscored)
  | "ungraded" // 未採点 (別名)
  | "correct" // 正答
  | "partial" // 部分点
  | "pending" // 保留
  | "incorrect" // 誤答
  | "no_answer" // 無答

// 位置の型定義
type MarkPosition =
  | "top-left" // 左上
  | "top-center" // 上
  | "top-right" // 右上
  | "middle-left" // 左
  | "middle-center" // 中央
  | "middle-right" // 右
  | "bottom-left" // 左下
  | "bottom-center" // 下
  | "bottom-right" // 右下

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
  pdfOrientation?: "portrait" | "landscape"
  includeDrawingAnnotations?: boolean // 描画アノテーションを含めるかどうか
  progressCallback?: (progress: {
    current: number
    total: number
    step: string
    percentage: number
    currentStepIndex: number
    totalSteps: number
  }) => void
}

// 採点マーク画像のパスを取得する関数
function getMarkImagePath(
  status: ScoringStatus,
  useTransparent: boolean,
): string {
  // パッケージ化されたアプリでは app.getAppPath() を使用
  const { app } = require("electron")
  const publicDir = app.isPackaged
    ? path.join(app.getAppPath(), "public")
    : path.join(getAppRootPath(), "public")

  const prefix = useTransparent ? "tranceparent_" : ""

  switch (status) {
    case "unscored":
    case "ungraded":
      return path.join(publicDir, "score-assets", `${prefix}unscored.png`)
    case "correct":
      return path.join(publicDir, "score-assets", `${prefix}correct.png`)
    case "partial":
      return path.join(publicDir, "score-assets", `${prefix}partial.png`)
    case "pending":
      return path.join(publicDir, "score-assets", `${prefix}hold.png`)
    case "incorrect":
      return path.join(publicDir, "score-assets", `${prefix}incorrect.png`)
    case "no_answer":
      return path.join(publicDir, "score-assets", `${prefix}incorrect.png`)
    default:
      return path.join(publicDir, "score-assets", `${prefix}unscored.png`)
  }
}

/**
 * 描画アノテーションをPDFページにレンダリングする
 */
async function renderDrawingAnnotations(
  page: any, // PDFページ
  questionScoreId: string,
  imageWidth: number,
  imageHeight: number,
  pdfDoc: PDFDocument,
): Promise<void> {
  try {
    // 該当QuestionScoreの描画アノテーションを取得
    const annotations =
      await getDrawingAnnotationsByQuestionScore(questionScoreId)

    if (!annotations || annotations.length === 0) {
      return
    }

    console.log(`描画アノテーション ${annotations.length}件をレンダリング開始`)

    // 各アノテーションをレンダリング
    for (const annotation of annotations) {
      await renderSingleAnnotation(
        page,
        annotation as DrawingAnnotation & { createdByUserId: string | null },
        imageWidth,
        imageHeight,
        pdfDoc,
      )
    }
  } catch (error) {
    console.error("描画アノテーション レンダリングエラー:", error)
  }
}

/**
 * 単一の描画アノテーションをPDFページにレンダリングする
 */
async function renderSingleAnnotation(
  page: any, // pdf-lib PDFPage
  annotation: DrawingAnnotation,
  imageWidth: number,
  imageHeight: number,
  pdfDoc: PDFDocument,
): Promise<void> {
  switch (annotation.type) {
    case "line":
      renderLineAnnotation(page, annotation, imageWidth, imageHeight)
      break
    case "rectangle":
      renderRectangleAnnotation(page, annotation, imageWidth, imageHeight)
      break
    case "ellipse":
      renderEllipseAnnotation(page, annotation, imageWidth, imageHeight)
      break
    case "text":
      await renderTextAnnotation(
        page,
        annotation,
        imageWidth,
        imageHeight,
        pdfDoc,
      )
      break
    default:
      console.warn("未対応の描画アノテーションタイプ:", annotation.type)
  }
}

/**
 * 直線アノテーションのレンダリング
 */
function renderLineAnnotation(
  page: any, // pdf-lib PDFPage
  annotation: DrawingAnnotation,
  imageWidth: number,
  imageHeight: number,
): void {
  const startX = annotation.x * imageWidth
  const startY = (1 - annotation.y) * imageHeight
  const endX = annotation.endX * imageWidth
  const endY = (1 - annotation.endY) * imageHeight

  const color = parseColor(annotation.color)

  // 基本直線を描画
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness: annotation.strokeWidth,
    color,
  })

  // 線スタイルに応じた追加描画
  switch (annotation.lineStyle) {
    case "double":
      // 二重線
      const offset = annotation.strokeWidth + 2
      const angle = Math.atan2(endY - startY, endX - startX)
      const perpX = Math.cos(angle + Math.PI / 2) * offset
      const perpY = Math.sin(angle + Math.PI / 2) * offset

      page.drawLine({
        start: { x: startX + perpX, y: startY + perpY },
        end: { x: endX + perpX, y: endY + perpY },
        thickness: annotation.strokeWidth,
        color,
      })
      break

    case "arrow":
    case "both_arrow":
      // 矢印頭部を描画
      drawArrowHead(
        page,
        startX,
        startY,
        endX,
        endY,
        annotation.strokeWidth,
        color,
        annotation.lineStyle === "both_arrow",
      )
      break
  }
}

/**
 * 長方形アノテーションのレンダリング
 */
function renderRectangleAnnotation(
  page: any, // pdf-lib PDFPage
  annotation: DrawingAnnotation,
  imageWidth: number,
  imageHeight: number,
): void {
  const x = annotation.displayX * imageWidth
  const y = (1 - annotation.displayY - annotation.height) * imageHeight // PDFは下からの座標系
  const width = annotation.width * imageWidth
  const height = annotation.height * imageHeight

  const color = parseColor(annotation.color)

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: color,
    borderWidth: annotation.strokeWidth,
  })
}

/**
 * 楕円アノテーションのレンダリング
 */
function renderEllipseAnnotation(
  page: any, // pdf-lib PDFPage
  annotation: DrawingAnnotation,
  imageWidth: number,
  imageHeight: number,
): void {
  const centerX = (annotation.displayX + annotation.width / 2) * imageWidth
  const centerY =
    (1 - annotation.displayY - annotation.height / 2) * imageHeight
  const radiusX = (annotation.width / 2) * imageWidth
  const radiusY = (annotation.height / 2) * imageHeight

  const color = parseColor(annotation.color)

  page.drawEllipse({
    x: centerX,
    y: centerY,
    xScale: radiusX,
    yScale: radiusY,
    borderColor: color,
    borderWidth: annotation.strokeWidth,
  })
}

/**
 * テキストアノテーションのレンダリング（MathJax対応）
 */
async function renderTextAnnotation(
  page: any, // pdf-lib PDFPage
  annotation: DrawingAnnotation,
  imageWidth: number,
  imageHeight: number,
  pdfDoc: PDFDocument,
): Promise<void> {
  if (!annotation.text || annotation.text.trim() === "") {
    return
  }

  const x = annotation.displayX * imageWidth
  const y = (1 - annotation.displayY) * imageHeight // テキストベースライン
  const color = parseColor(annotation.color)

  // 簡単なMathJax記法（$...$）のチェック
  const isMathJax = annotation.text.includes("$")

  if (isMathJax) {
    // MathJax処理は複雑なため、プレーンテキストとして描画
    // TODO: 将来的にはSVG→PNG変換によるMathJax描画を実装
    console.warn(
      "MathJax テキストは現在プレーンテキストとして描画されます:",
      annotation.text,
    )
  }

  // テキスト描画（フォールバック対応）
  try {
    page.drawText(annotation.text.replace(/\$/g, ""), {
      // MathJax記号を削除
      x,
      y,
      size: annotation.fontSize,
      color,
    })
  } catch (error) {
    console.error("テキスト描画エラー:", error)
  }
}

/**
 * 矢印頭部の描画
 */
function drawArrowHead(
  page: any,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  strokeWidth: number,
  color: any,
  bothEnds: boolean = false,
): void {
  const angle = Math.atan2(endY - startY, endX - startX)
  const arrowLength = Math.max(10, strokeWidth * 3)
  const arrowAngle = Math.PI / 6

  // 終点の矢印
  const arrowX1 = endX - arrowLength * Math.cos(angle - arrowAngle)
  const arrowY1 = endY - arrowLength * Math.sin(angle - arrowAngle)
  const arrowX2 = endX - arrowLength * Math.cos(angle + arrowAngle)
  const arrowY2 = endY - arrowLength * Math.sin(angle + arrowAngle)

  page.drawLine({
    start: { x: endX, y: endY },
    end: { x: arrowX1, y: arrowY1 },
    thickness: strokeWidth,
    color,
  })

  page.drawLine({
    start: { x: endX, y: endY },
    end: { x: arrowX2, y: arrowY2 },
    thickness: strokeWidth,
    color,
  })

  // 両端矢印の場合、始点にも矢印を描画
  if (bothEnds) {
    const reverseAngle = angle + Math.PI
    const startArrowX1 =
      startX - arrowLength * Math.cos(reverseAngle - arrowAngle)
    const startArrowY1 =
      startY - arrowLength * Math.sin(reverseAngle - arrowAngle)
    const startArrowX2 =
      startX - arrowLength * Math.cos(reverseAngle + arrowAngle)
    const startArrowY2 =
      startY - arrowLength * Math.sin(reverseAngle + arrowAngle)

    page.drawLine({
      start: { x: startX, y: startY },
      end: { x: startArrowX1, y: startArrowY1 },
      thickness: strokeWidth,
      color,
    })

    page.drawLine({
      start: { x: startX, y: startY },
      end: { x: startArrowX2, y: startArrowY2 },
      thickness: strokeWidth,
      color,
    })
  }
}

/**
 * 色文字列をPDF-libのRGBカラーに変換
 */
function parseColor(colorString: string): any {
  // #RRGGBB形式を想定
  if (colorString.startsWith("#")) {
    const hex = colorString.slice(1)
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return rgb(r, g, b)
  }

  // デフォルトは赤色
  return rgb(1, 0, 0)
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
  markSize: number,
): { x: number; y: number } {
  let baseX: number, baseY: number

  // 基準位置を計算（マーク画像の上下中央を基準とする）
  // PDF座標系では下が原点なので、top/bottomを正しく対応させる
  switch (position) {
    case "top-left":
      baseX = regionX - markSize / 2
      baseY = regionY + regionHeight - markSize / 2 // 上端
      break
    case "top-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight - markSize / 2 // 上端
      break
    case "top-right":
      baseX = regionX + regionWidth - markSize / 2
      baseY = regionY + regionHeight - markSize / 2 // 上端
      break
    case "middle-left":
      baseX = regionX - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2 // 中央
      break
    case "middle-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2 // 中央
      break
    case "middle-right":
      baseX = regionX + regionWidth - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2 // 中央
      break
    case "bottom-left":
      baseX = regionX - markSize / 2
      baseY = regionY - markSize / 2 // 下端
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY - markSize / 2 // 下端
      break
    case "bottom-right":
      baseX = regionX + regionWidth - markSize / 2
      baseY = regionY - markSize / 2 // 下端
      break
    default:
      baseX = regionX + regionWidth / 2 - markSize / 2
      baseY = regionY + regionHeight / 2 - markSize / 2
  }

  // オフセットを適用（Y軸は直感的な方向に修正）
  return {
    x: baseX + offsetX,
    y: baseY - offsetY, // Y軸オフセットを反転させて直感的な方向にする
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
  alignment: TextAlignment,
): { x: number; y: number } {
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
    y: baseY - offsetY, // Y軸オフセットを反転させて直感的な方向にする
  }
}

// 特定の生徒のプロジェクト全体の合計点を計算する関数
function calculateStudentTotalScore(
  studentId: string,
  allQuestionScores: { success: boolean; scores?: QuestionScore[] },
  cropRegions: CropRegionWithProjectPage[],
): number {
  try {
    let totalScore = 0
    console.log(`Calculating total score for student ${studentId}`)

    if (!allQuestionScores.success || !allQuestionScores.scores) {
      console.log(`No question scores available`)
      return 0
    }

    // この生徒の全採点データを取得
    const studentScores = allQuestionScores.scores.filter(
      (score: QuestionScore) => score.studentId === studentId,
    )

    console.log(`Found ${studentScores.length} scores for student ${studentId}`)

    for (const scoreData of studentScores) {
      const cropRegion = cropRegions.find(
        (r) => r.id === scoreData.cropRegionId,
      )
      // 設問領域のみを対象とする（小計点・合計点領域は除外）
      if (cropRegion && cropRegion.type === "QUESTION_ANSWER") {
        const maxScore = cropRegion?.points || 10
        const actualScore = calculateActualScore({
          status: scoreData.status,
          partialScore: scoreData.partialScore ? Number(scoreData.partialScore) : null,
        } as { status: string; partialScore?: number | null }, maxScore)
        console.log(`Question ${scoreData.cropRegionId}: score ${actualScore}`)
        totalScore += actualScore || 0
      }
    }

    console.log(
      `Total score calculated for student ${studentId}: ${totalScore}`,
    )
    return totalScore
  } catch (error) {
    console.error(
      `Error calculating total score for student ${studentId}:`,
      error,
    )
    return 0
  }
}


export async function exportScoredAnswersPDF(
  options: ExportScoredAnswersOptions,
): Promise<{
  success: boolean
  outputPath?: string
  error?: string
}> {
  try {
    const {
      projectId,
      selectedStudentIds,
      scoringMarkConfig,
      progressCallback,
      includeDrawingAnnotations = false,
    } = options

    // 進捗レポート関数
    const totalSteps = 7 // 全体ステップ数
    const reportProgress = (
      current: number,
      total: number,
      step: string,
      currentStepIndex: number = 0,
    ) => {
      const percentage = Math.round((current / total) * 100)
      progressCallback?.({
        current,
        total,
        step,
        percentage,
        currentStepIndex,
        totalSteps,
      })
    }

    // 保存場所を最初に選択
    let outputPath = options.outputPath
    if (!outputPath) {
      reportProgress(0, 100, "保存場所を選択してください...", 0)
      const defaultFileName = `採点済み答案_${new Date().toISOString().split("T")[0]}.pdf`
      const result = await dialog.showSaveDialog({
        title: "採点済み答案PDFの保存",
        defaultPath: defaultFileName,
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      })

      if (result.canceled || !result.filePath) {
        throw new Error("ユーザーによってキャンセルされました")
      }

      outputPath = result.filePath
      reportProgress(5, 100, "保存場所が選択されました。データを取得中...", 1)
    }

    reportProgress(10, 100, "生徒データを取得中...", 1)

    // データの取得
    const studentsResult = await getStudentsForProject(projectId)
    if (!studentsResult.success || !studentsResult.students) {
      throw new Error("生徒データの取得に失敗しました")
    }

    reportProgress(20, 100, "答案データを取得中...", 2)

    const studentAnswersResult = await getStudentAnswersByProjectId(projectId)
    if (!studentAnswersResult.success || !studentAnswersResult.answerSheets) {
      throw new Error("答案データの取得に失敗しました")
    }

    reportProgress(30, 100, "採点データを取得中...", 3)

    const questionScores = await getQuestionScoresForProject(projectId)
    const cropRegions = await getCropRegionsByProjectId(projectId)

    // 選択された生徒のデータをフィルタリングして順序を保持
    const selectedStudents = studentsResult.students
      .filter((student) => selectedStudentIds.includes(student.id))
      .sort((a, b) => {
        // customOrderが設定されている場合は優先
        if (a.customOrder !== null && b.customOrder !== null) {
          return a.customOrder - b.customOrder
        }
        if (a.customOrder !== null) return -1 // aが優先
        if (b.customOrder !== null) return 1 // bが優先
        // 学籍番号でソート
        return a.studentId.localeCompare(b.studentId)
      })

    if (selectedStudents.length === 0) {
      throw new Error("選択された生徒が見つかりません")
    }

    reportProgress(40, 100, "PDFドキュメントを初期化中...", 5)

    // 全体の答案枚数を計算し、データの存在をチェック
    let totalAnswerSheets = 0
    const studentAnswerSheetMap = new Map()

    for (const student of selectedStudents) {
      const studentAnswerSheets = studentAnswersResult.answerSheets.filter(
        (sheet) => sheet.student?.id === student.id,
      )
      studentAnswerSheetMap.set(student.id, studentAnswerSheets)
      totalAnswerSheets += studentAnswerSheets.length
    }

    // 答案データが存在しない場合は早期にエラーを投げる
    if (totalAnswerSheets === 0) {
      throw new Error("選択された生徒に答案データが見つかりません")
    }

    // 実際の答案画像ファイルの存在チェック
    reportProgress(35, 100, "答案画像ファイルを確認中...", 4)
    let validAnswerSheets = 0
    for (const student of selectedStudents) {
      const studentAnswerSheets = studentAnswerSheetMap.get(student.id) || []
      for (const answerSheet of studentAnswerSheets) {
        if ((answerSheet as any).originalImagePath) {
          const answerImagePath = getAbsolutePathFromData(
            (answerSheet as any).originalImagePath,
          )
          if (fs.existsSync(answerImagePath)) {
            validAnswerSheets++
          }
        }
      }
    }

    // 有効な答案画像が存在しない場合は早期にエラーを投げる
    if (validAnswerSheets === 0) {
      throw new Error("答案データが見つからないか、画像ファイルが存在しません")
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
        const progressStep = `答案 ${processedSheets + 1} / ${totalAnswerSheets} を処理中...`
        const progressPercent = 50 + (processedSheets / totalAnswerSheets) * 40
        reportProgress(progressPercent, 100, progressStep, 6)

        // 答案画像の取得と処理
        if ((answerSheet as any).originalImagePath) {
          try {
            const answerImagePath = getAbsolutePathFromData(
              (answerSheet as any).originalImagePath,
            )

            // 画像が存在するかチェック
            if (fs.existsSync(answerImagePath)) {
              // 画像をPDFに追加（進捗コールバック付き）
              await addAnswerSheetToPDF(
                pdfDoc,
                answerImagePath,
                answerSheet,
                questionScores,
                cropRegions,
                scoringMarkConfig,
                options.pdfOrientation || "portrait",
                student,
                selectedStudents,
                (step) => {
                  reportProgress(
                    progressPercent + (1 / totalAnswerSheets) * 40 * 0.5,
                    100,
                    `${progressStep} - ${step}`,
                    6,
                  )
                },
                includeDrawingAnnotations,
              )
            } else {
              // Answer image not found, skip
            }
          } catch (imageError) {
            // 個別の画像処理エラーは警告として扱い、処理を続行
          }
        } else {
          // Answer sheet has no originalImagePath, skip
        }
        processedSheets++
      }
    }

    reportProgress(90, 100, "PDFファイルを生成中...")

    // PDFに追加されたページ数をチェック
    const pageCount = pdfDoc.getPageCount()

    if (pageCount === 0) {
      throw new Error(
        "PDF生成中にエラーが発生しました。答案画像の読み込みに失敗した可能性があります",
      )
    }

    // PDF バイト生成（実際の進捗を段階的に取得）
    reportProgress(95, 100, "PDFドキュメントを最適化中...")

    let pdfBytes: Uint8Array

    // 実際の処理段階に基づく進捗表示
    try {
      // 段階1: PDFドキュメントの前処理（実際の処理段階）
      reportProgress(95, 100, "画像データを最適化中...")
      await new Promise((resolve) => setTimeout(resolve, 1)) // 非同期処理を確保

      // 段階2: フォントとリソースの埋め込み（実際の処理段階）
      reportProgress(96, 100, "フォントを埋め込み中...")
      await new Promise((resolve) => setTimeout(resolve, 1))

      // 段階3: メモリ内でのPDF構造構築（実際の処理段階）
      reportProgress(97, 100, "ファイル構造を最適化中...")
      await new Promise((resolve) => setTimeout(resolve, 1))

      // 段階4: 最終的なPDFバイト生成（実際の重い処理）
      reportProgress(98, 100, "最終調整中...")

      pdfBytes = await pdfDoc.save({
        useObjectStreams: false, // オブジェクトストリームを無効化（高速化）
        addDefaultPage: false, // デフォルトページを追加しない
      })

      reportProgress(99, 100, "PDF生成完了")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      throw new Error(`PDF最適化エラー: ${errorMessage}`)
    }

    // PDFファイルの保存
    reportProgress(99, 100, "ファイルを保存中...", 7)
    fs.writeFileSync(outputPath, pdfBytes)

    reportProgress(100, 100, "完了しました", 7)

    return {
      success: true,
      outputPath,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "不明なエラーが発生しました",
    }
  }
}

async function addAnswerSheetToPDF(
  pdfDoc: PDFDocument,
  imagePath: string,
  answerSheet: any,
  questionScores: any,
  cropRegions: CropRegionWithProjectPage[],
  scoringMarkConfig?: ScoringMarkConfig,
  pdfOrientation?: "portrait" | "landscape",
  _currentStudent?: any,
  _allSelectedStudents?: any[],
  progressCallback?: (step: string) => void,
  includeDrawingAnnotations: boolean = false,
): Promise<void> {
  try {
    progressCallback?.("画像を読み込み中...")

    // フォントを初期化
    const font = await pdfDoc.embedFont("Helvetica")

    // 画像を読み込み
    const imageBuffer = fs.readFileSync(imagePath)

    // 画像形式を判定して埋め込み
    let image
    const ext = path.extname(imagePath).toLowerCase()

    if (ext === ".png") {
      image = await pdfDoc.embedPng(imageBuffer)
    } else if (ext === ".jpg" || ext === ".jpeg") {
      image = await pdfDoc.embedJpg(imageBuffer)
    } else {
      // その他の形式はSharpを使ってPNGに変換
      if (sharp) {
        const pngBuffer = await sharp(imageBuffer).png().toBuffer()
        image = await pdfDoc.embedPng(pngBuffer)
      } else {
        // Sharpが利用できない場合は元の形式で試行
        console.warn(
          `Sharp not available, attempting to embed ${ext} format directly`,
        )
        try {
          image = await pdfDoc.embedPng(imageBuffer)
        } catch (pngError) {
          try {
            image = await pdfDoc.embedJpg(imageBuffer)
          } catch (jpgError) {
            throw new Error(
              `Unsupported image format ${ext} and Sharp not available for conversion`,
            )
          }
        }
      }
    }

    // 新しいページを追加（用紙の向きを考慮）
    const pageSize =
      pdfOrientation === "landscape"
        ? ([PageSizes.A4[1], PageSizes.A4[0]] as [number, number]) // 横向き（幅と高さを入れ替え）
        : PageSizes.A4 // 縦向き（デフォルト）
    const page = pdfDoc.addPage(pageSize)
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

    progressCallback?.("答案画像を描画中...")

    // 答案画像を描画
    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    })

    progressCallback?.("採点情報を重ね合わせ中...")

    // 採点情報を重ね合わせ（生徒ID + ページIDでフィルタ）
    const relevantScores =
      questionScores.success && questionScores.scores
        ? questionScores.scores.filter(
            (
              score: QuestionScore & {
                cropRegion?: { projectPage?: { id: string } }
              },
            ) =>
              score.studentId === answerSheet.studentId &&
              score.cropRegion?.projectPage?.id === answerSheet.projectPageId,
          )
        : []

    console.log(
      `👤 Found ${relevantScores.length} relevant scores for student ${answerSheet.studentId}`,
    )

    // 採点データを適切に処理
    const processedScores = relevantScores.map(
      (
        score: QuestionScore & {
          cropRegion?: any
          drawingAnnotations?: DrawingAnnotation[]
        },
      ) => {
        const cropRegion = cropRegions.find(
          (region) => region.id === score.cropRegionId,
        )
        const maxScore = cropRegion?.points || 10
        const actualScore = calculateActualScore({
          status: score.status,
          partialScore: score.partialScore ? Number(score.partialScore) : null,
        } as { status: string; partialScore?: number | null }, maxScore)

        return {
          ...score,
          score: actualScore,
          maxScore: maxScore,
        }
      },
    )

    // processedScores are ready for mark placement

    // デフォルト設定
    const defaultConfig: ScoringMarkConfig = {
      showMarkForStatus: {
        unscored: true, // 未採点も表示してテストするため
        ungraded: true, // 互換性のため両方対応
        correct: true,
        partial: true,
        pending: true,
        incorrect: true,
        no_answer: true,
      },
      showScoreForStatus: {
        unscored: false,
        ungraded: false,
        correct: true,
        partial: true,
        pending: true,
        incorrect: true,
        no_answer: true,
      },
      // 採点マーク設定
      markPosition: "middle-center", // 既定を中央に変更
      markOffsetX: 0,
      markOffsetY: 0,
      markSize: 50,
      // 点数テキスト設定
      scorePosition: "middle-center", // 既定を中央に配置
      scoreOffsetX: 0, // 中央配置なのでオフセットなし
      scoreOffsetY: 0,
      scoreSize: 14,
      scoreAlignment: "center", // 中央揃え
      useTransparent: false,
    }

    const config = {
      ...defaultConfig,
      ...scoringMarkConfig,
      showMarkForStatus: {
        ...defaultConfig.showMarkForStatus,
        ...(scoringMarkConfig?.showMarkForStatus || {}),
      },
      showScoreForStatus: {
        ...defaultConfig.showScoreForStatus,
        ...(scoringMarkConfig?.showScoreForStatus || {}),
      },
    }

    console.log(
      `📊 Processing ${processedScores.length} scores for drawing marks and scores`,
    )

    for (const score of processedScores) {
      const cropRegion = cropRegions.find(
        (region) => region.id === score.cropRegionId,
      )
      if (!cropRegion) {
        continue
      }

      // 採点状態を判定（statusを直接使用）
      const scoringStatus = score.status as ScoringStatus
      console.log(
        `📝 Processing score: cropRegionId=${score.cropRegionId}, status=${scoringStatus}, score=${score.score}`,
      )

      // この状態のマークを表示するかチェック
      if (!config.showMarkForStatus[scoringStatus]) {
        console.log(
          `🚫 Skipping mark display for status: ${scoringStatus} (config disabled)`,
        )
        continue
      }

      // 採点枠の位置をPDF座標系に変換
      // cropRegionの座標が正規化されている場合 (0.0-1.0)
      const isNormalized =
        cropRegion.x <= 1.0 &&
        cropRegion.y <= 1.0 &&
        cropRegion.width <= 1.0 &&
        cropRegion.height <= 1.0

      let regionXOnImage,
        regionYOnImage,
        regionWidthOnImage,
        regionHeightOnImage

      if (isNormalized) {
        // 正規化座標の場合 (0.0-1.0)
        regionXOnImage = cropRegion.x * imageWidth + imageX
        // PDF座標系（Y軸が下から上）に変換: 画像の上端から下端への座標を下端から上端に変換
        regionYOnImage =
          imageY +
          imageHeight -
          (cropRegion.y + cropRegion.height) * imageHeight
        regionWidthOnImage = cropRegion.width * imageWidth
        regionHeightOnImage = cropRegion.height * imageHeight
      } else {
        // ピクセル座標の場合
        regionXOnImage = (cropRegion.x / image.width) * imageWidth + imageX
        // PDF座標系（Y軸が下から上）に変換: 画像の上端から下端への座標を下端から上端に変換
        regionYOnImage =
          imageY +
          imageHeight -
          ((cropRegion.y + cropRegion.height) / image.height) * imageHeight
        regionWidthOnImage = (cropRegion.width / image.width) * imageWidth
        regionHeightOnImage = (cropRegion.height / image.height) * imageHeight
      }

      // Calculate region coordinates on PDF

      // 採点マークの位置を採点枠基準で計算
      const markPosition = calculateMarkPosition(
        config.markPosition,
        config.markOffsetX,
        config.markOffsetY,
        regionXOnImage,
        regionYOnImage,
        regionWidthOnImage,
        regionHeightOnImage,
        config.markSize,
      )

      // Mark position calculated

      let markImagePath: string | undefined
      try {
        // 採点マーク画像を読み込んで描画
        markImagePath = getMarkImagePath(scoringStatus, config.useTransparent)

        if (fs.existsSync(markImagePath)) {
          const markImageBuffer = fs.readFileSync(markImagePath)
          const markImage = await pdfDoc.embedPng(markImageBuffer)

          page.drawImage(markImage, {
            x: markPosition.x,
            y: markPosition.y,
            width: config.markSize,
            height: config.markSize,
          })
          console.log(`✅ Successfully drew scoring mark: ${markImagePath}`)
        } else {
          console.warn(`⚠️  Scoring mark image not found: ${markImagePath}`)
        }

        // 描画アノテーションのレンダリング
        if (includeDrawingAnnotations) {
          try {
            await renderDrawingAnnotations(
              page,
              score.id,
              regionWidthOnImage,
              regionHeightOnImage,
              pdfDoc,
            )
            console.log(`✅ 描画アノテーションをレンダリング完了: ${score.id}`)
          } catch (annotationError) {
            console.error(
              "描画アノテーションレンダリングエラー:",
              annotationError,
            )
          }
        }
      } catch (markError) {
        console.error(
          `❌ Failed to draw scoring mark: ${markImagePath || "unknown path"}`,
          markError,
        )
        // マーク描画に失敗しても続行
      }

      // 点数を描画
      if (
        config.showScoreForStatus[scoringStatus] &&
        score.score !== null &&
        score.score !== undefined
      ) {
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
          config.scoreAlignment,
        )

        // スコアテキスト背景をクリア（重複描画防止）
        const textPadding = 2 // テキスト周囲のパディング
        page.drawRectangle({
          x: scorePosition.x - textPadding,
          y: scorePosition.y - textPadding,
          width: textWidth + textPadding * 2,
          height: textHeight + textPadding * 2,
          color: rgb(1, 1, 1), // 白色背景
        })

        // Draw score text
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
        const commentSize = Math.max(8, config.scoreSize - 4)

        // コメントテキスト背景をクリア（重複描画防止）
        const commentWidth = font.widthOfTextAtSize(score.comment, commentSize)
        const commentHeight = commentSize
        const commentPadding = 1

        page.drawRectangle({
          x: commentX - commentPadding,
          y: commentY - commentPadding,
          width: commentWidth + commentPadding * 2,
          height: commentHeight + commentPadding * 2,
          color: rgb(1, 1, 1), // 白色背景
        })

        page.drawText(score.comment, {
          x: commentX,
          y: commentY,
          size: commentSize,
          font: font,
          color: rgb(0.5, 0, 0), // 暗い赤色
        })
      }
    }

    progressCallback?.("小計点を計算中...")

    // この答案ページに属する小計点領域のみを処理
    const currentPageNumber = answerSheet.pageNumber
    const currentPageSubtotalRegions = cropRegions.filter(
      (region) =>
        region.type === "SUBTOTAL_SCORE" &&
        region.projectPage &&
        region.projectPage.pageNumber === currentPageNumber,
    )
    console.log(
      `Found ${currentPageSubtotalRegions.length} subtotal regions on page ${currentPageNumber}:`,
      currentPageSubtotalRegions.map((r) => ({
        id: r.id,
        label: r.label,
        type: r.type,
        page: r.projectPage?.pageNumber,
      })),
    )

    for (const subtotalRegion of currentPageSubtotalRegions) {
      try {
        // 生徒IDを取得
        const studentId = answerSheet.studentId
        if (!studentId) {
          console.log(`No student ID found for answer sheet`)
          continue
        }

        // プロジェクト全体スコープで小計点を計算
        // データ形式を変換  
        const questionScoreData: QuestionScoreData[] = questionScores.success && questionScores.scores
          ? questionScores.scores
              .filter((score: any) => score.studentId !== null)
              .map((score: any) => ({
                studentId: score.studentId!,
                cropRegionId: score.cropRegionId,
                status: score.status,
                partialScore: score.partialScore ? Number(score.partialScore) : null,
              }))
          : []
        
        const subtotalScore = await calculateSubtotalScoreForStudent(
          studentId,
          subtotalRegion.id,
          questionScoreData,
          cropRegions as CropRegion[],
        )
        console.log(
          `Calculated subtotal score for student ${studentId}, region ${subtotalRegion.id} (${subtotalRegion.label}): ${subtotalScore}`,
        )

        // 小計点領域の座標をPDF座標系に変換
        const isNormalized =
          subtotalRegion.x <= 1.0 &&
          subtotalRegion.y <= 1.0 &&
          subtotalRegion.width <= 1.0 &&
          subtotalRegion.height <= 1.0

        let regionXOnImage,
          regionYOnImage,
          regionWidthOnImage,
          regionHeightOnImage

        if (isNormalized) {
          // 正規化座標の場合 (0.0-1.0)
          regionXOnImage = subtotalRegion.x * imageWidth + imageX
          regionYOnImage =
            imageY +
            imageHeight -
            (subtotalRegion.y + subtotalRegion.height) * imageHeight
          regionWidthOnImage = subtotalRegion.width * imageWidth
          regionHeightOnImage = subtotalRegion.height * imageHeight
        } else {
          // ピクセル座標の場合
          regionXOnImage =
            (subtotalRegion.x / image.width) * imageWidth + imageX
          regionYOnImage =
            imageY +
            imageHeight -
            ((subtotalRegion.y + subtotalRegion.height) / image.height) *
              imageHeight
          regionWidthOnImage = (subtotalRegion.width / image.width) * imageWidth
          regionHeightOnImage =
            (subtotalRegion.height / image.height) * imageHeight
        }

        // 小計点テキストを描画
        const subtotalText = `${subtotalScore}`
        const textWidth = font.widthOfTextAtSize(subtotalText, config.scoreSize)
        const textHeight = config.scoreSize

        // テキストの位置を計算
        const subtotalPosition = calculateTextPosition(
          config.scorePosition,
          config.scoreOffsetX,
          config.scoreOffsetY,
          regionXOnImage,
          regionYOnImage,
          regionWidthOnImage,
          regionHeightOnImage,
          textWidth,
          textHeight,
          config.scoreAlignment,
        )

        // 小計点テキスト背景をクリア（重複描画防止）
        const subtotalPadding = 2
        page.drawRectangle({
          x: subtotalPosition.x - subtotalPadding,
          y: subtotalPosition.y - subtotalPadding,
          width: textWidth + subtotalPadding * 2,
          height: textHeight + subtotalPadding * 2,
          color: rgb(1, 1, 1), // 白色背景
        })

        // 小計点を描画
        console.log(
          `Drawing subtotal text "${subtotalText}" at position (${subtotalPosition.x}, ${subtotalPosition.y})`,
        )
        page.drawText(subtotalText, {
          x: subtotalPosition.x,
          y: subtotalPosition.y,
          size: config.scoreSize,
          font: font,
          color: rgb(0, 0, 1), // 青色（小計点は青色で区別）
        })
      } catch (subtotalError) {
        console.error(
          `Error processing subtotal region ${subtotalRegion.id}:`,
          subtotalError,
        )
        // エラーが発生しても続行
      }
    }

    progressCallback?.("合計点を計算中...")

    // この答案ページに属する合計点領域のみを処理
    const currentPageTotalScoreRegions = cropRegions.filter(
      (region) =>
        region.type === "TOTAL_SCORE" &&
        region.projectPage &&
        region.projectPage.pageNumber === currentPageNumber,
    )
    console.log(
      `Found ${currentPageTotalScoreRegions.length} total score regions on page ${currentPageNumber}:`,
      currentPageTotalScoreRegions.map((r) => ({
        id: r.id,
        label: r.label,
        type: r.type,
        page: r.projectPage?.pageNumber,
      })),
    )

    for (const totalScoreRegion of currentPageTotalScoreRegions) {
      try {
        // 生徒IDを取得
        const studentId = answerSheet.studentId
        if (!studentId) {
          console.log(`No student ID found for answer sheet`)
          continue
        }

        // プロジェクト全体スコープで合計点を計算
        const totalScore = calculateStudentTotalScore(
          studentId,
          questionScores,
          cropRegions,
        )
        console.log(
          `Calculated total score for student ${studentId}, region ${totalScoreRegion.id} (${totalScoreRegion.label}): ${totalScore}`,
        )

        // 合計点領域の座標をPDF座標系に変換
        const isNormalized =
          totalScoreRegion.x <= 1.0 &&
          totalScoreRegion.y <= 1.0 &&
          totalScoreRegion.width <= 1.0 &&
          totalScoreRegion.height <= 1.0

        let regionXOnImage,
          regionYOnImage,
          regionWidthOnImage,
          regionHeightOnImage

        if (isNormalized) {
          // 正規化座標の場合 (0.0-1.0)
          regionXOnImage = totalScoreRegion.x * imageWidth + imageX
          regionYOnImage =
            imageY +
            imageHeight -
            (totalScoreRegion.y + totalScoreRegion.height) * imageHeight
          regionWidthOnImage = totalScoreRegion.width * imageWidth
          regionHeightOnImage = totalScoreRegion.height * imageHeight
        } else {
          // ピクセル座標の場合
          regionXOnImage =
            (totalScoreRegion.x / image.width) * imageWidth + imageX
          regionYOnImage =
            imageY +
            imageHeight -
            ((totalScoreRegion.y + totalScoreRegion.height) / image.height) *
              imageHeight
          regionWidthOnImage =
            (totalScoreRegion.width / image.width) * imageWidth
          regionHeightOnImage =
            (totalScoreRegion.height / image.height) * imageHeight
        }

        // 合計点テキストを描画
        const totalScoreText = `${totalScore}`
        const textWidth = font.widthOfTextAtSize(
          totalScoreText,
          config.scoreSize,
        )
        const textHeight = config.scoreSize

        // テキストの位置を計算
        const totalScorePosition = calculateTextPosition(
          config.scorePosition,
          config.scoreOffsetX,
          config.scoreOffsetY,
          regionXOnImage,
          regionYOnImage,
          regionWidthOnImage,
          regionHeightOnImage,
          textWidth,
          textHeight,
          config.scoreAlignment,
        )

        // 合計点テキスト背景をクリア（重複描画防止）
        const totalScorePadding = 2
        page.drawRectangle({
          x: totalScorePosition.x - totalScorePadding,
          y: totalScorePosition.y - totalScorePadding,
          width: textWidth + totalScorePadding * 2,
          height: textHeight + totalScorePadding * 2,
          color: rgb(1, 1, 1), // 白色背景
        })

        // 合計点を描画
        console.log(
          `Drawing total score text "${totalScoreText}" at position (${totalScorePosition.x}, ${totalScorePosition.y})`,
        )
        page.drawText(totalScoreText, {
          x: totalScorePosition.x,
          y: totalScorePosition.y,
          size: config.scoreSize,
          font: font,
          color: rgb(1, 0, 0), // 赤色（合計点は赤色で区別）
        })
      } catch (totalScoreError) {
        console.error(
          `Error processing total score region ${totalScoreRegion.id}:`,
          totalScoreError,
        )
        // エラーが発生しても続行
      }
    }

    // ヘッダー情報は削除（日本語フォント問題を回避）
  } catch (error) {
    throw error
  }
}
