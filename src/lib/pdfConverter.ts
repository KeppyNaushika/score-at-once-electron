"use client"

import type * as PDFJS from "pdfjs-dist"

// PDF.jsの動的インポートでSSRエラーを回避
let pdfjsLib: typeof PDFJS | null = null

// PDF.js初期化（クライアントサイドのみ）
const initializePdfjs = async () => {
  if (typeof window === "undefined") {
    throw new Error("PDF変換はクライアントサイドでのみ利用可能です")
  }

  if (!pdfjsLib) {
    try {
      // Try importing the legacy build first (more stable)
      pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.min.mjs")

      // Set up PDF.js worker - use local static file instead of CDN
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.mjs"
      }
    } catch (error) {
      // Fallback to standard import
      console.warn(
        "Legacy PDF.js import failed, trying standard import:",
        error
      )
      const pdfModule = await import("pdfjs-dist")
      pdfjsLib = pdfModule.default || pdfModule

      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.mjs"
      }
    }
  }

  return pdfjsLib
}

export interface ConvertedImage {
  name: string
  type: string
  buffer: ArrayBuffer
}

export interface PdfConversionError {
  type: "password-required" | "invalid-password" | "general-error"
  message: string
}

export async function getPdfPageCount(
  file: File,
  password?: string
): Promise<number> {
  const pdfjs = await initializePdfjs()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      password: password,
    })
    const pdf = await loadingTask.promise
    return pdf.numPages
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error) {
      if (error.name === "PasswordException") {
        throw new Error("password-required")
      } else if (error.name === "InvalidPDFException" && password) {
        throw new Error("invalid-password")
      }
    }
    const errorMessage = error instanceof Error ? error.message : "不明なエラー"
    throw new Error(`PDF読み込みエラー: ${errorMessage}`)
  }
}

export async function convertPdfToImages(
  file: File,
  password?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ConvertedImage[]> {
  // PDF.jsを初期化
  const pdfjs = await initializePdfjs()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      password: password,
    })
    const pdf = await loadingTask.promise
    const images: ConvertedImage[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const scale = 2.0 // Higher scale for better quality
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")!
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      // Convert canvas to blob with PNG for lossless quality (better for editing workflow)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png")
      })

      const buffer = await blob.arrayBuffer()
      const baseName = file.name.replace(/\.pdf$/i, "")

      images.push({
        name: `${baseName}_page_${pageNum}.png`,
        type: "image/png",
        buffer: buffer,
      })

      // プログレスコールバック呼び出し
      if (onProgress) {
        onProgress(pageNum, pdf.numPages)
      }
    }

    return images
  } catch (error: unknown) {
    // PDF.js エラーハンドリング
    if (error && typeof error === "object" && "name" in error) {
      if (error.name === "PasswordException") {
        throw new Error("password-required")
      } else if (error.name === "InvalidPDFException" && password) {
        throw new Error("invalid-password")
      }
    }
    // パスワード関連以外のエラーのみログ出力
    console.error("PDF変換エラー:", error)
    const errorMessage = error instanceof Error ? error.message : "不明なエラー"
    throw new Error(`PDF変換エラー: ${errorMessage}`)
  }
}
