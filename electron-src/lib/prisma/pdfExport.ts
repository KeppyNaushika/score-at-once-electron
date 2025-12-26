import { dialog } from "electron"
import fs from "fs"
import path from "path"
import { PageSizes, PDFDocument } from "pdf-lib"
import { getAbsolutePathFromData } from "../dataManager"
import { getCropRegionsByProjectId } from "./cropRegion"
import { getDrawingAnnotationsByQuestionScore } from "./drawingAnnotation"
import { getProjectById } from "./project"
import { getStudentsForProject } from "./projectStudent"
import { getQuestionScoresForProject } from "./questionScore"
import { getStudentAnswersByProjectId } from "./studentAnswer"

/**
 * ファイル名として安全でない文字を置換する
 * @param name - 元の名前
 * @returns サニタイズされた名前
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
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
    studentId: string | null
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
    if (!studentAnswersResult.success || !studentAnswersResult.answerSheets) {
      return { success: false, error: "答案画像の取得に失敗しました" }
    }
    const studentAnswers: StudentAnswerData[] = studentAnswersResult.answerSheets

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
        const imagePath = getAbsolutePathFromData(studentAnswer.originalImagePath)

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
              console.warn(`CropRegion ${region.id} has no projectPage, skipping`)
              return null
            }
            const score = allScores.find(
              (s) =>
                s.cropRegionId === region.id && s.studentId === student.id
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
          .filter((sd): sd is NonNullable<typeof sd> => sd !== null && sd.questionScoreId !== "")

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
            })
          }
        }

        // 画像をbase64データURLに変換（Canvasのtainted問題を回避）
        let imageUrl = ""
        try {
          const imageBuffer = fs.readFileSync(imagePath)
          const ext = path.extname(imagePath).toLowerCase()
          const mimeType = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png"
          imageUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`
        } catch (imgError) {
          console.error(`Failed to read image: ${imagePath}`, imgError)
          continue // この画像をスキップ
        }

        pages.push({
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`,
          pageNumber,
          imagePath,
          imageUrl,
          scoringData,
          annotations,
        })
      }
    }

    // ページを生徒順・ページ番号順でソート
    pages.sort((a, b) => {
      const studentCompare = selectedStudentIds.indexOf(a.studentId) - selectedStudentIds.indexOf(b.studentId)
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
 * Canvas描画済み画像からPDFを作成
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
  const { projectId, renderedPages, pdfOrientation = "portrait", outputPath: providedOutputPath, progressCallback } = options

  try {
    // プロジェクト情報を取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    // 保存先を決定（事前に指定されている場合はダイアログをスキップ）
    let outputPath = providedOutputPath
    if (!outputPath) {
      const sanitizedExamName = sanitizeFileName(project.examName || "採点済み答案")
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
    const pageSize = pdfOrientation === "landscape"
      ? [PageSizes.A4[1], PageSizes.A4[0]] as [number, number]
      : PageSizes.A4

    // 各ページを追加
    for (let i = 0; i < renderedPages.length; i++) {
      const pageData = renderedPages[i]

      progressCallback?.({
        current: i + 1,
        total: renderedPages.length,
        step: `ページ ${i + 1}/${renderedPages.length} を処理中...`,
        percentage: Math.round(((i + 1) / renderedPages.length) * 100),
        currentStepIndex: 1,
        totalSteps: 2,
      })

      try {
        // ArrayBufferからUint8Arrayに変換
        const imageBytes = new Uint8Array(pageData.imageData)

        // 画像をPDFに埋め込み
        const image = await pdfDoc.embedPng(imageBytes)

        // 新しいページを追加
        const page = pdfDoc.addPage(pageSize)
        const { width: pageWidth, height: pageHeight } = page.getSize()

        // 画像をページにフィットさせる
        const imageAspectRatio = image.width / image.height
        const pageAspectRatio = pageWidth / pageHeight

        let imageWidth: number
        let imageHeight: number

        if (imageAspectRatio > pageAspectRatio) {
          // 画像の方が横長 -> 幅に合わせる
          imageWidth = pageWidth
          imageHeight = pageWidth / imageAspectRatio
        } else {
          // 画像の方が縦長 -> 高さに合わせる
          imageHeight = pageHeight
          imageWidth = pageHeight * imageAspectRatio
        }

        // 画像を中央に配置
        const imageX = (pageWidth - imageWidth) / 2
        const imageY = (pageHeight - imageHeight) / 2

        page.drawImage(image, {
          x: imageX,
          y: imageY,
          width: imageWidth,
          height: imageHeight,
        })
      } catch (pageError) {
        console.error(`Error processing page ${i + 1}:`, pageError)
        // エラーが発生しても続行
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
