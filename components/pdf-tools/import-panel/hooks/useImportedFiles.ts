import { useCallback } from "react"

import {
  type ConvertedImage,
  convertPdfToImages,
  getPdfPageCount,
} from "@/lib/pdfConverter"
import type { ImportedFile } from "@/types/pdfTools.types"

export function useImportedFiles() {
  // Fileオブジェクトから処理（ドラッグ&ドロップ用）
  const processFiles = useCallback(
    async (files: File[]): Promise<ImportedFile[]> => {
      const processedFiles: ImportedFile[] = []

      for (const file of files) {
        try {
          // webUtils.getPathForFile でファイルパスを取得
          const filePath = window.electronAPI.pdfTools.getPathForFile(file)
          console.log("Got file path from webUtils:", filePath)

          // ページ数を取得
          const pageCount = await getPdfPageCount(file)

          // サムネイルを生成（base64 data URLs）
          const thumbnails = await generateThumbnails(file, pageCount)

          // 全ページを選択状態で初期化
          const selectedPages = new Set<number>()
          for (let i = 1; i <= pageCount; i++) {
            selectedPages.add(i)
          }

          const importedFile: ImportedFile = {
            id: crypto.randomUUID(),
            name: file.name,
            path: filePath,
            pageCount,
            thumbnails,
            selectedPages,
            nUp: {
              enabled: false,
              layout: "2x1",
              order: "left-right",
            },
            rotation: 0,
          }

          processedFiles.push(importedFile)
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
        }
      }

      return processedFiles
    },
    []
  )

  // ファイルパスから処理（Electronダイアログ用）
  const processFilePaths = useCallback(
    async (filePaths: string[]): Promise<ImportedFile[]> => {
      console.log("processFilePaths called with:", filePaths)
      const processedFiles: ImportedFile[] = []

      for (const filePath of filePaths) {
        try {
          console.log("Processing file path:", filePath)
          // PDFの情報を取得
          const info = await window.electronAPI.pdfTools.getPdfInfo(filePath)
          console.log("PDF info:", info)
          if (!info.success || !info.pageCount) {
            console.error(`Failed to get PDF info: ${info.error}`)
            continue
          }

          // サムネイルを生成（パスからファイルを読み込んで）
          const thumbnails = await generateThumbnailsFromPath(
            filePath,
            info.pageCount
          )

          // 全ページを選択状態で初期化
          const selectedPages = new Set<number>()
          for (let i = 1; i <= info.pageCount; i++) {
            selectedPages.add(i)
          }

          const importedFile: ImportedFile = {
            id: crypto.randomUUID(),
            name: info.name || filePath.split("/").pop() || "unknown.pdf",
            path: filePath,
            pageCount: info.pageCount,
            thumbnails,
            selectedPages,
            nUp: {
              enabled: false,
              layout: "2x1",
              order: "left-right",
            },
            rotation: 0,
          }
          console.log("Created ImportedFile:", {
            id: importedFile.id,
            name: importedFile.name,
            path: importedFile.path,
          })

          processedFiles.push(importedFile)
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
        }
      }

      return processedFiles
    },
    []
  )

  return { processFiles, processFilePaths }
}

/** ArrayBuffer を base64 data URL に変換 */
function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

async function generateThumbnails(
  file: File,
  pageCount: number
): Promise<string[]> {
  try {
    const images: ConvertedImage[] = await convertPdfToImages(
      file,
      undefined, // password
      () => {} // プログレスコールバックは不要
    )
    // ConvertedImage の buffer を base64 data URL に変換
    return images.map((img) => arrayBufferToDataUrl(img.buffer, img.type))
  } catch (error) {
    console.error("Error generating thumbnails:", error)
    // エラー時は空の配列を返す
    return Array(pageCount).fill("")
  }
}

/** ファイルパスからサムネイルを生成 */
async function generateThumbnailsFromPath(
  filePath: string,
  pageCount: number
): Promise<string[]> {
  try {
    // appimg:// プロトコルでローカルファイルを読み込み
    const response = await fetch(`appimg://${filePath}`)
    const arrayBuffer = await response.arrayBuffer()

    // ArrayBufferからFileオブジェクトを作成
    const blob = new Blob([arrayBuffer], { type: "application/pdf" })
    const file = new File([blob], filePath.split("/").pop() || "file.pdf", {
      type: "application/pdf",
    })

    // 既存の関数でサムネイル生成
    return await generateThumbnails(file, pageCount)
  } catch (error) {
    console.error("Error generating thumbnails from path:", error)
    return Array(pageCount).fill("")
  }
}
