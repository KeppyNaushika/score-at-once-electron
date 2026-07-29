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

/**
 * PDF→画像変換のレンダリング倍率（1ポイントあたりのピクセル数）。
 * 変換画像からPDFページ寸法へ逆算する側（復号済み複製の生成等）と共有する。
 */
export const PDF_RENDER_SCALE = 2.0

// PDF.js 6.x は JBIG2 / JPEG2000 画像のデコードに WASM モジュールを使う。
// スキャナ生成PDF（JBIG2/CCITT等）はこれが無いとデコードに失敗し白紙になる
// （"JBig2 failed to initialize" → "Dependent image isn't ready yet" → 白紙）。
// wasmUrl で配信済みWASM（public/js/wasm/）を指す必要がある。
// あわせて OffscreenCanvas / ImageDecoder 経路を無効化し、Electronで安定する
// 同期フォールバック経路を強制する。
const PDFJS_OPTIONS = {
  wasmUrl: "/js/wasm/",
  isOffscreenCanvasSupported: false,
  isImageDecoderSupported: false,
} as const

/** PDFファイルを各ページのPNG画像に変換する */
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
      ...PDFJS_OPTIONS,
    })
    const pdf = await loadingTask.promise
    const images: ConvertedImage[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })

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
