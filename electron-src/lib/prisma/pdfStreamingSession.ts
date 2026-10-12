import * as crypto from "crypto"
import * as fsPromises from "fs/promises"
import type { PDFImage, PDFPage } from "pdf-lib"
import { PageSizes, PDFDocument } from "pdf-lib"

// ============================================================
// ストリーミングPDF生成API
// ============================================================

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
    await fsPromises.writeFile(outputPath, pdfBytes)
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
