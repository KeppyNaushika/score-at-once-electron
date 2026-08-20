import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import { PageSizes, PDFDocument } from "pdf-lib"

import { resolveExamPaperSize } from "@/lib/shared/examPaperSize"

import type { DrawingAnnotation } from "../../../src/types/drawingAnnotation.types"
import { getAbsolutePathFromData } from "../dataManager"
import { calculateActualScore } from "../shared/calculations/actualScore"
import { resolveEffectiveScores } from "../shared/calculations/scoreResolution"
import { calculateSubtotalScoreForStudent } from "../shared/calculations/subtotalCalculator"
import { getCropRegionsByExamId } from "./cropRegion"
import { getDrawingAnnotationsByQuestionScore } from "./drawingAnnotation"
import { getExamById } from "./exam"
import { getStudentsForExam } from "./examStudent"
import { getQuestionScoresForExam } from "./questionScore"
import { getScoreDecisionsForExam } from "./scoreDecision"
import { getStudentAnswersByExamId } from "./studentAnswer/crud"

// ============================================================
// Canvas描画エンジン用API
// ============================================================

/**
 * PDF出力に必要なデータを取得する型定義。renderer の描画エンジンはこの型から
 * 入力型を導出する（`pdfCanvasRenderer/types.ts`）ので、形の SSOT はここ1箇所。
 *
 * 採点マークは**実体をそのまま載せる**。以前は 17 列を選んで載せ替えていたため、
 * renderer 側で組み立て直したうえで union 列を `as` で戻し、落ちた列
 * （textBoxWidth / horizontalAlign / createdAt 等）を `0` や `new Date()` で
 * 埋めていた。実体を渡せば載せ替えも `as` も要らない。
 *
 * 設問領域・小計・合計は描画に要る列だけの形を保つ（規約の read-out 側の carve-out。
 * 実体をそのまま載せると questionScores まで IPC を越えることになる）。
 */
export interface PdfExportPageData {
  examStudentId: string
  studentName: string
  pageNumber: number
  imagePath: string
  imageUrl: string // file:// URL形式
  // 用紙サイズ（mm→px変換基準。個別表示と一致させるため ExamPage.pageSize を反映）
  pageSize: string
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
    score: number | null
    x: number
    y: number
    width: number
    height: number
    pageNumber: number
  }>
  // 合計点領域データ
  totalScoreData: Array<{
    regionId: string
    score: number | null
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
  annotations: DrawingAnnotation[]
}

interface PdfExportData {
  examName: string
  pages: PdfExportPageData[]
}

/**
 * PDF出力に必要なデータを取得
 * レンダラー側でCanvas描画を行うためのデータを提供
 */
export async function getPdfExportData(options: {
  examId: string
  selectedExamStudentIds: string[]
}): Promise<PdfExportData> {
  const { examId, selectedExamStudentIds } = options

  // 試験情報を取得
  const exam = await getExamById(examId)
  if (!exam) {
    throw new Error("試験が見つかりません")
  }

  // 用紙サイズ。個別表示（ScoringMainView）と同じ関数で決めて、
  // フォント・線幅の mm→px 変換基準を一致させる
  const pageSize = resolveExamPaperSize(exam.examPages)

  // 採点領域を取得
  const cropRegions = await getCropRegionsByExamId(examId)

  // 採点スコアと確定を取得し、受験者×設問ごとに有効スコア1件へ解決
  const scoresResult = await getQuestionScoresForExam(examId)
  const decisionsResult = await getScoreDecisionsForExam(examId)
  const { resolved: allScores } = resolveEffectiveScores(
    scoresResult,
    decisionsResult
  )

  // 受験者を取得（ExamStudent 実体のまま保持する）
  const allExamStudents = await getStudentsForExam(examId)

  // 答案画像を取得
  // include が作ったグラフ（examStudent{student} / examPage 同梱）をそのまま持つ。
  // pageNumber・氏名は出力データを組み立てる時点でエンティティから導出する。
  const studentAnswers = await getStudentAnswersByExamId(examId)

  // 選択された受験者のみフィルタリング
  const selectedExamStudents = allExamStudents.filter((examStudent) =>
    selectedExamStudentIds.includes(examStudent.id)
  )

  const pages: PdfExportPageData[] = []

  for (const examStudent of selectedExamStudents) {
    const { student } = examStudent
    // この受験者の答案画像を取得
    const studentAnswerList = studentAnswers.filter(
      (studentAnswer) => studentAnswer.examStudentId === examStudent.id
    )

    if (studentAnswerList.length === 0) continue

    for (const studentAnswer of studentAnswerList) {
      const imagePath = getAbsolutePathFromData(studentAnswer.imagePath)

      if (!imagePath || !fs.existsSync(imagePath)) continue

      // このページの採点領域を取得。ページの同定は examPageId で行う
      // （pageNumber は序数。端末をまたいで独立に同じ値が振られるので、値が一致しても
      //  同じページとは限らず、unique にもできない＝ key にならない）
      const pageRegions = cropRegions.filter(
        (cropRegion) => cropRegion.examPageId === studentAnswer.examPageId
      )

      // 採点データを構築
      const scoringData = pageRegions
        .map((region) => {
          // examPageは必ず存在する（getCropRegionsByExamIdでincludeしている）
          if (!region.examPage) {
            console.warn(`CropRegion ${region.id} has no examPage, skipping`)
            return null
          }
          const score = allScores.find(
            (resolvedScore) =>
              resolvedScore.cropRegionId === region.id &&
              resolvedScore.examStudentId === examStudent.id
          )
          return {
            questionScoreId: score?.questionScoreId || "",
            status: score?.status || "unscored",
            partialScore: score?.partialScore ?? null,
            cropRegion: {
              id: region.id,
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
              label: region.label,
              maxScore: region.points !== null ? Number(region.points) : null,
              pageNumber: region.examPage.pageNumber,
            },
          }
        })
        .filter(
          // 提案行が無くても確定（decision）で採点済みのセルはマークを描画する
          (scoringEntry): scoringEntry is NonNullable<typeof scoringEntry> =>
            scoringEntry !== null &&
            (scoringEntry.questionScoreId !== "" ||
              scoringEntry.status !== "unscored")
        )

      // アノテーションを取得（行をそのまま持つ）
      const annotations: PdfExportPageData["annotations"] = []
      for (const scoringEntry of scoringData) {
        if (!scoringEntry.questionScoreId) continue
        annotations.push(
          ...(await getDrawingAnnotationsByQuestionScore(
            scoringEntry.questionScoreId
          ))
        )
      }

      // 画像をbase64データURLに変換（Canvasのtainted問題を回避）
      let imageUrl: string
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
        (cropRegion) => cropRegion.type === "SUBTOTAL_SCORE"
      )

      // 小計点データを計算
      const subtotalData: PdfExportPageData["subtotalData"] = []
      for (const subtotalRegion of subtotalRegions) {
        if (!subtotalRegion.examPage) continue

        // 小計点を計算
        const subtotalResult = await calculateSubtotalScoreForStudent(
          examStudent.id,
          examId,
          subtotalRegion.id,
          allScores,
          cropRegions
        )

        subtotalData.push({
          regionId: subtotalRegion.id,
          label: subtotalRegion.label,
          score: subtotalResult.score,
          x: subtotalRegion.x,
          y: subtotalRegion.y,
          width: subtotalRegion.width,
          height: subtotalRegion.height,
          pageNumber: subtotalRegion.examPage.pageNumber,
        })
      }

      // 合計点を計算（全設問の合計）
      const questionRegions = cropRegions.filter(
        (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
      )
      let totalScore = 0
      let totalMaxScore = 0
      let hasScoredQuestion = false
      for (const region of questionRegions) {
        const score = allScores.find(
          (resolvedScore) =>
            resolvedScore.cropRegionId === region.id &&
            resolvedScore.examStudentId === examStudent.id
        )
        if (score) {
          const maxScore = region.points !== null ? Number(region.points) : 0
          totalMaxScore += maxScore
          const actualScore = calculateActualScore(
            {
              status: score.status,
              partialScore:
                score.partialScore !== null ? Number(score.partialScore) : null,
            },
            maxScore
          )
          if (actualScore !== null) {
            hasScoredQuestion = true
            totalScore += actualScore
          }
        }
      }

      // 合計点領域を取得（このページのTOTAL_SCORE領域）
      const totalScoreRegions = pageRegions.filter(
        (cropRegion) => cropRegion.type === "TOTAL_SCORE"
      )

      // 合計点領域データを構築
      const finalTotalScore = hasScoredQuestion ? totalScore : null
      const totalScoreData: PdfExportPageData["totalScoreData"] = []
      for (const totalRegion of totalScoreRegions) {
        if (!totalRegion.examPage) continue

        totalScoreData.push({
          regionId: totalRegion.id,
          score: finalTotalScore,
          maxScore: totalMaxScore,
          x: totalRegion.x,
          y: totalRegion.y,
          width: totalRegion.width,
          height: totalRegion.height,
          pageNumber: totalRegion.examPage.pageNumber,
        })
      }

      pages.push({
        examStudentId: examStudent.id,
        studentName: `${student.lastName} ${student.firstName}`,
        pageNumber: studentAnswer.examPage.pageNumber,
        imagePath,
        imageUrl,
        pageSize,
        scoringData,
        subtotalData,
        totalScoreData,
        totalScore: finalTotalScore,
        totalMaxScore,
        annotations,
      })
    }
  }

  // ページを受験者順（customOrder順）・ページ番号順でソート
  // selectedExamStudents は getStudentsForExam が customOrder 順で返すため、
  // その順序を受験者の並び順として使う（選択操作の順序には依存させない）
  const orderedExamStudentIds = selectedExamStudents.map(
    (examStudent) => examStudent.id
  )
  pages.sort((pageA, pageB) => {
    const studentCompare =
      orderedExamStudentIds.indexOf(pageA.examStudentId) -
      orderedExamStudentIds.indexOf(pageB.examStudentId)
    if (studentCompare !== 0) return studentCompare
    return pageA.pageNumber - pageB.pageNumber
  })

  return { examName: exam.examName, pages }
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
}): Promise<string> {
  const { totalPages, pdfOrientation = "portrait" } = options

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

  return sessionId
}

/**
 * ストリーミングでページに画像を描画
 * 空ページに画像を追加する
 */
export async function addPageToStreamingSession(options: {
  sessionId: string
  pageIndex: number
  imageData: ArrayBuffer
}): Promise<void> {
  const { sessionId, pageIndex, imageData } = options

  const session = streamingSessions.get(sessionId)
  if (!session) {
    throw new Error("セッションが見つかりません")
  }

  if (pageIndex < 0 || pageIndex >= session.totalPages) {
    throw new Error(`ページインデックスが範囲外です: ${pageIndex}`)
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
}

/**
 * ストリーミングセッションを完了してPDFを保存
 */
export async function finalizeStreamingSession(options: {
  sessionId: string
  outputPath: string
}): Promise<void> {
  const { sessionId, outputPath } = options

  const session = streamingSessions.get(sessionId)
  if (!session) {
    throw new Error("セッションが見つかりません")
  }

  try {
    // PDFを保存
    const pdfBytes = await session.pdfDoc.save()
    fs.writeFileSync(outputPath, pdfBytes)
  } finally {
    // 保存の成否によらずセッションを解放する（失敗したセッションを抱え続けない）
    streamingSessions.delete(sessionId)
  }
}

/**
 * ストリーミングセッションをキャンセル
 */
export function cancelStreamingSession(sessionId: string): void {
  streamingSessions.delete(sessionId)
}
