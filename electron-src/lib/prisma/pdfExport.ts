import type { CropRegion } from "@prisma/client"
import crypto from "crypto"
import { dialog } from "electron"
import fs from "fs"
import path from "path"
import { PageSizes, PDFDocument } from "pdf-lib"
import { getAbsolutePathFromData } from "../dataManager"
import { calculateSubtotalScoreForStudent } from "../shared/calculations/subtotalCalculator"
import { getCropRegionsByProjectId } from "./cropRegion"
import { getDrawingAnnotationsByQuestionScore } from "./drawingAnnotation"
import { getProjectById } from "./project"
import { getStudentsForProject } from "./projectStudent"
import {
  calculateActualScore,
  getQuestionScoresForProject,
} from "./questionScore"
import { getStudentAnswersByProjectId } from "./studentAnswer"

/**
 * ファイル名として安全でない文字を置換する
 * @param name - 元の名前
 * @returns サニタイズされた名前
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim()
}

/**
 * getStudentAnswersByProjectIdの戻り値の型
 * studentのフィールドはPrismaのスキーマに合わせてnullableを許容
 */
interface StudentAnswerData {
  id: string
  studentId: string | null
  pageNumber: number
  projectPageId: string
  imagePath: string
  originalImagePath: string
  isAbsent: boolean
  student: {
    id: string
    lastName: string
    firstName: string
    lastNameKana: string | null
    firstNameKana: string | null
    studentNumber: string | null
    projectStudents: Array<{ customOrder: number | null; status: string }>
  } | null
  projectId: string
  status: "ready"
}

// ============================================================
// Canvas描画エンジン用API
// ============================================================

/**
 * PDF出力に必要なデータを取得する型定義
 */
export interface PdfExportPageData {
  studentId: string
  studentName: string
  pageNumber: number
  imagePath: string
  imageUrl: string // file:// URL形式
  scoringData: Array<{
    questionScoreId: string
    status: string
    partialScore: number | null
    cropRegion: {
      id: string
      x: number
      y: number
      width: number
      height: number
      label: string
      maxScore: number | null
      pageNumber: number
    }
  }>
  // 小計点データ
  subtotalData: Array<{
    regionId: string
    label: string
    score: number
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点領域データ
  totalScoreData: Array<{
    regionId: string
    score: number
    maxScore: number
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点データ（後方互換性のため維持）
  totalScore: number | null
  totalMaxScore: number | null
  annotations: Array<{
    id: string
    questionScoreId: string
    type: string
    x: number
    y: number
    color: string
    strokeWidth: number
    width: number
    height: number
    endX: number
    endY: number
    lineStyle: string
    text: string
    fontSize: number
    displayX: number
    displayY: number
    anchorDirection: string
    userId: string
  }>
}

export interface PdfExportData {
  success: boolean
  projectName?: string
  pages?: PdfExportPageData[]
  error?: string
}

/**
 * PDF出力に必要なデータを取得
 * レンダラー側でCanvas描画を行うためのデータを提供
 */
export async function getPdfExportData(options: {
  projectId: string
  selectedStudentIds: string[]
}): Promise<PdfExportData> {
  const { projectId, selectedStudentIds } = options

  try {
    // プロジェクト情報を取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    // 採点領域を取得
    const cropRegions = await getCropRegionsByProjectId(projectId)

    // 採点スコアを取得
    const scoresResult = await getQuestionScoresForProject(projectId)
    const allScores = scoresResult.scores || []

    // 生徒情報を取得
    const studentsResult = await getStudentsForProject(projectId)
    const allStudents = studentsResult.students || []

    // 答案画像を取得
    const studentAnswersResult = await getStudentAnswersByProjectId(projectId)
    if (
      !studentAnswersResult.success ||
      !studentAnswersResult.studentAnswerImages
    ) {
      return { success: false, error: "答案画像の取得に失敗しました" }
    }
    // Prisma型をStudentAnswerData型に変換
    const studentAnswers: StudentAnswerData[] =
      studentAnswersResult.studentAnswerImages.map((img) => ({
        id: img.id,
        studentId: img.studentId,
        pageNumber: img.projectPage.pageNumber,
        projectPageId: img.projectPageId,
        imagePath: img.imagePath,
        originalImagePath: img.imagePath,
        isAbsent:
          img.student?.projectStudents?.[0]?.status === "ABSENT" || false,
        student: img.student
          ? {
              id: img.student.id,
              lastName: img.student.lastName,
              firstName: img.student.firstName,
              lastNameKana: img.student.lastNameKana,
              firstNameKana: img.student.firstNameKana,
              studentNumber: img.student.studentNumber,
              projectStudents: img.student.projectStudents,
            }
          : null,
        projectId: img.projectPage.projectId,
        status: "ready" as const,
      }))

    // 選択された生徒のみフィルタリング
    const selectedStudents = allStudents.filter((s) =>
      selectedStudentIds.includes(s.id)
    )

    const pages: PdfExportPageData[] = []

    for (const student of selectedStudents) {
      // この生徒の答案画像を取得
      const studentAnswerList = studentAnswers.filter(
        (sa) => sa.studentId === student.id
      )

      if (studentAnswerList.length === 0) continue

      for (const studentAnswer of studentAnswerList) {
        const imagePath = getAbsolutePathFromData(
          studentAnswer.originalImagePath
        )

        if (!imagePath || !fs.existsSync(imagePath)) continue

        // ページ番号を取得（型安全：pageNumberは必ず存在する）
        const pageNumber = studentAnswer.pageNumber

        // このページの採点領域を取得
        const pageRegions = cropRegions.filter(
          (cr) => cr.projectPage?.pageNumber === pageNumber
        )

        // 採点データを構築
        const scoringData = pageRegions
          .map((region) => {
            // projectPageは必ず存在する（getCropRegionsByProjectIdでincludeしている）
            if (!region.projectPage) {
              console.warn(
                `CropRegion ${region.id} has no projectPage, skipping`
              )
              return null
            }
            const score = allScores.find(
              (s) => s.cropRegionId === region.id && s.studentId === student.id
            )
            return {
              questionScoreId: score?.id || "",
              status: score?.status || "unscored",
              partialScore:
                score?.partialScore !== null
                  ? Number(score?.partialScore)
                  : null,
              cropRegion: {
                id: region.id,
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
                label: region.label,
                maxScore: region.points !== null ? Number(region.points) : null,
                pageNumber: region.projectPage.pageNumber,
              },
            }
          })
          .filter(
            (sd): sd is NonNullable<typeof sd> =>
              sd !== null && sd.questionScoreId !== ""
          )

        // アノテーションを取得
        const annotations: PdfExportPageData["annotations"] = []
        for (const sd of scoringData) {
          if (!sd.questionScoreId) continue
          const annots = await getDrawingAnnotationsByQuestionScore(
            sd.questionScoreId
          )
          for (const annot of annots) {
            annotations.push({
              id: annot.id,
              questionScoreId: annot.questionScoreId,
              type: annot.type,
              x: annot.x,
              y: annot.y,
              color: annot.color,
              strokeWidth: annot.strokeWidth,
              width: annot.width,
              height: annot.height,
              endX: annot.endX,
              endY: annot.endY,
              lineStyle: annot.lineStyle,
              text: annot.text,
              fontSize: annot.fontSize,
              displayX: annot.displayX,
              displayY: annot.displayY,
              anchorDirection: annot.anchorDirection,
              userId: annot.userId,
            })
          }
        }

        // 画像をbase64データURLに変換（Canvasのtainted問題を回避）
        let imageUrl = ""
        try {
          const imageBuffer = fs.readFileSync(imagePath)
          const ext = path.extname(imagePath).toLowerCase()
          const mimeType =
            ext === ".png"
              ? "image/png"
              : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : "image/png"
          imageUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`
        } catch (imgError) {
          console.error(`Failed to read image: ${imagePath}`, imgError)
          continue // この画像をスキップ
        }

        // 小計点領域を取得（このページのSUBTOTAL_SCORE領域）
        const subtotalRegions = pageRegions.filter(
          (cr) => cr.type === "SUBTOTAL_SCORE"
        )

        // 小計点データを計算
        const subtotalData: PdfExportPageData["subtotalData"] = []
        for (const subtotalRegion of subtotalRegions) {
          if (!subtotalRegion.projectPage) continue

          // 小計点を計算
          const subtotalResult = await calculateSubtotalScoreForStudent(
            student.id,
            subtotalRegion.id,
            allScores
              .filter((s) => s.studentId !== null)
              .map((s) => ({
                studentId: s.studentId as string,
                cropRegionId: s.cropRegionId,
                status: s.status,
                partialScore:
                  s.partialScore !== null ? Number(s.partialScore) : null,
              })),
            cropRegions as CropRegion[]
          )

          subtotalData.push({
            regionId: subtotalRegion.id,
            label: subtotalRegion.label,
            score: subtotalResult.score,
            x: subtotalRegion.x,
            y: subtotalRegion.y,
            width: subtotalRegion.width,
            height: subtotalRegion.height,
            pageNumber: subtotalRegion.projectPage.pageNumber,
          })
        }

        // 合計点を計算（全設問の合計）
        const questionRegions = cropRegions.filter(
          (cr) => cr.type === "QUESTION_ANSWER"
        )
        let totalScore = 0
        let totalMaxScore = 0
        for (const region of questionRegions) {
          const score = allScores.find(
            (s) => s.cropRegionId === region.id && s.studentId === student.id
          )
          if (score) {
            const maxScore = region.points !== null ? Number(region.points) : 0
            totalMaxScore += maxScore
            const actualScore = calculateActualScore(
              {
                status: score.status,
                partialScore:
                  score.partialScore !== null
                    ? Number(score.partialScore)
                    : null,
              },
              maxScore
            )
            totalScore += actualScore ?? 0
          }
        }

        // 合計点領域を取得（このページのTOTAL_SCORE領域）
        const totalScoreRegions = pageRegions.filter(
          (cr) => cr.type === "TOTAL_SCORE"
        )

        // 合計点領域データを構築
        const totalScoreData: PdfExportPageData["totalScoreData"] = []
        for (const totalRegion of totalScoreRegions) {
          if (!totalRegion.projectPage) continue

          totalScoreData.push({
            regionId: totalRegion.id,
            score: totalScore,
            maxScore: totalMaxScore,
            x: totalRegion.x,
            y: totalRegion.y,
            width: totalRegion.width,
            height: totalRegion.height,
            pageNumber: totalRegion.projectPage.pageNumber,
          })
        }

        pages.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          pageNumber,
          imagePath,
          imageUrl,
          scoringData,
          subtotalData,
          totalScoreData,
          totalScore,
          totalMaxScore,
          annotations,
        })
      }
    }

    // ページを生徒順・ページ番号順でソート
    pages.sort((a, b) => {
      const studentCompare =
        selectedStudentIds.indexOf(a.studentId) -
        selectedStudentIds.indexOf(b.studentId)
      if (studentCompare !== 0) return studentCompare
      return a.pageNumber - b.pageNumber
    })

    return {
      success: true,
      projectName: project.examName,
      pages,
    }
  } catch (error) {
    console.error("Error getting PDF export data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Canvas描画済み画像からPDFを作成（バッチ処理版）
 */
export async function createPdfFromRenderedImages(options: {
  projectId: string
  renderedPages: Array<{
    studentId: string
    pageNumber: number
    imageData: ArrayBuffer
  }>
  pdfOrientation?: "portrait" | "landscape"
  outputPath?: string
  progressCallback?: (progress: {
    current: number
    total: number
    step: string
    percentage: number
    currentStepIndex: number
    totalSteps: number
  }) => void
}): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const {
    projectId,
    renderedPages,
    pdfOrientation = "portrait",
    outputPath: providedOutputPath,
    progressCallback,
  } = options

  try {
    // プロジェクト情報を取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    // 保存先を決定（事前に指定されている場合はダイアログをスキップ）
    let outputPath = providedOutputPath
    if (!outputPath) {
      const sanitizedExamName = sanitizeFileName(
        project.examName || "採点済み答案"
      )
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "採点済み答案PDFの保存先",
        defaultPath: `${sanitizedExamName}_採点済み.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      })

      if (canceled || !filePath) {
        return { success: false, error: "保存がキャンセルされました" }
      }
      outputPath = filePath
    }

    progressCallback?.({
      current: 0,
      total: renderedPages.length,
      step: "PDFを作成中...",
      percentage: 0,
      currentStepIndex: 1,
      totalSteps: 2,
    })

    // PDFドキュメントを作成
    const pdfDoc = await PDFDocument.create()
    const pageSize =
      pdfOrientation === "landscape"
        ? ([PageSizes.A4[1], PageSizes.A4[0]] as [number, number])
        : PageSizes.A4

    // バッチサイズ（並列embedPng）
    const BATCH_SIZE = 4

    // 各ページを追加（バッチ処理）
    for (
      let batchStart = 0;
      batchStart < renderedPages.length;
      batchStart += BATCH_SIZE
    ) {
      const batch = renderedPages.slice(batchStart, batchStart + BATCH_SIZE)

      progressCallback?.({
        current: batchStart,
        total: renderedPages.length,
        step: `画像埋め込み中... (${batchStart + 1}-${Math.min(batchStart + BATCH_SIZE, renderedPages.length)}/${renderedPages.length})`,
        percentage: Math.round((batchStart / renderedPages.length) * 90),
        currentStepIndex: 1,
        totalSteps: 2,
      })

      // バッチ内で並列embedPng
      const embedPromises = batch.map(async (pageData) => {
        try {
          const imageBytes = new Uint8Array(pageData.imageData)
          const image = await pdfDoc.embedPng(imageBytes)
          return { success: true, image, pageData }
        } catch (error) {
          console.error(`Error embedding image:`, error)
          return { success: false, image: null, pageData }
        }
      })

      const embedResults = await Promise.all(embedPromises)

      // 順序通りにページを追加
      for (const result of embedResults) {
        if (!result.success || !result.image) continue

        const page = pdfDoc.addPage(pageSize)
        const { width: pageWidth, height: pageHeight } = page.getSize()

        const imageAspectRatio = result.image.width / result.image.height
        const pageAspectRatio = pageWidth / pageHeight

        let imageWidth: number
        let imageHeight: number

        if (imageAspectRatio > pageAspectRatio) {
          imageWidth = pageWidth
          imageHeight = pageWidth / imageAspectRatio
        } else {
          imageHeight = pageHeight
          imageWidth = pageHeight * imageAspectRatio
        }

        const imageX = (pageWidth - imageWidth) / 2
        const imageY = (pageHeight - imageHeight) / 2

        page.drawImage(result.image, {
          x: imageX,
          y: imageY,
          width: imageWidth,
          height: imageHeight,
        })
      }
    }

    progressCallback?.({
      current: renderedPages.length,
      total: renderedPages.length,
      step: "PDFを保存中...",
      percentage: 100,
      currentStepIndex: 2,
      totalSteps: 2,
    })

    // PDFを保存
    const pdfBytes = await pdfDoc.save()
    fs.writeFileSync(outputPath, pdfBytes)

    return { success: true, outputPath }
  } catch (error) {
    console.error("Error creating PDF from rendered images:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// ============================================================
// ストリーミングPDF生成API
// ============================================================

import type { PDFImage, PDFPage } from "pdf-lib"

/** ストリーミングセッションの状態 */
interface PdfStreamingSession {
  pdfDoc: PDFDocument
  pages: PDFPage[]
  pageSize: [number, number]
  embeddedImages: Map<number, PDFImage>
  totalPages: number
}

/** アクティブなストリーミングセッション */
const streamingSessions = new Map<string, PdfStreamingSession>()

/**
 * ストリーミングPDF生成用のセッションを作成
 * 全ページ分の空ページを事前に作成する
 */
export async function createPdfStreamingSession(options: {
  totalPages: number
  pdfOrientation?: "portrait" | "landscape"
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const { totalPages, pdfOrientation = "portrait" } = options

  try {
    const pdfDoc = await PDFDocument.create()
    const pageSize: [number, number] =
      pdfOrientation === "landscape"
        ? [PageSizes.A4[1], PageSizes.A4[0]]
        : [PageSizes.A4[0], PageSizes.A4[1]]

    // 全ページ分の空ページを作成
    const pages: PDFPage[] = []
    for (let i = 0; i < totalPages; i++) {
      const page = pdfDoc.addPage(pageSize)
      pages.push(page)
    }

    // セッションIDを生成
    const randomSuffix = crypto.randomBytes(8).toString("hex")
    const sessionId = `pdf-stream-${Date.now()}-${randomSuffix}`

    // セッションを保存
    streamingSessions.set(sessionId, {
      pdfDoc,
      pages,
      pageSize,
      embeddedImages: new Map(),
      totalPages,
    })

    return { success: true, sessionId }
  } catch (error) {
    console.error("Error creating PDF streaming session:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * ストリーミングでページに画像を描画
 * 空ページに画像を追加する
 */
export async function addPageToStreamingSession(options: {
  sessionId: string
  pageIndex: number
  imageData: ArrayBuffer
}): Promise<{ success: boolean; error?: string }> {
  const { sessionId, pageIndex, imageData } = options

  try {
    const session = streamingSessions.get(sessionId)
    if (!session) {
      return { success: false, error: "セッションが見つかりません" }
    }

    if (pageIndex < 0 || pageIndex >= session.totalPages) {
      return {
        success: false,
        error: `ページインデックスが範囲外です: ${pageIndex}`,
      }
    }

    const page = session.pages[pageIndex]
    const { width: pageWidth, height: pageHeight } = page.getSize()

    // 画像を埋め込み
    const imageBytes = new Uint8Array(imageData)
    const image = await session.pdfDoc.embedPng(imageBytes)
    session.embeddedImages.set(pageIndex, image)

    // 画像をページにフィットさせる
    const imageAspectRatio = image.width / image.height
    const pageAspectRatio = pageWidth / pageHeight

    let imageWidth: number
    let imageHeight: number

    if (imageAspectRatio > pageAspectRatio) {
      imageWidth = pageWidth
      imageHeight = pageWidth / imageAspectRatio
    } else {
      imageHeight = pageHeight
      imageWidth = pageHeight * imageAspectRatio
    }

    const imageX = (pageWidth - imageWidth) / 2
    const imageY = (pageHeight - imageHeight) / 2

    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    })

    return { success: true }
  } catch (error) {
    console.error(`Error adding page ${pageIndex} to streaming session:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * ストリーミングセッションを完了してPDFを保存
 */
export async function finalizeStreamingSession(options: {
  sessionId: string
  outputPath: string
}): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const { sessionId, outputPath } = options

  try {
    const session = streamingSessions.get(sessionId)
    if (!session) {
      return { success: false, error: "セッションが見つかりません" }
    }

    // PDFを保存
    const pdfBytes = await session.pdfDoc.save()
    fs.writeFileSync(outputPath, pdfBytes)

    // セッションをクリーンアップ
    streamingSessions.delete(sessionId)

    return { success: true, outputPath }
  } catch (error) {
    console.error("Error finalizing streaming session:", error)
    // エラー時もセッションをクリーンアップ
    streamingSessions.delete(sessionId)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * ストリーミングセッションをキャンセル
 */
export function cancelStreamingSession(sessionId: string): void {
  streamingSessions.delete(sessionId)
}
