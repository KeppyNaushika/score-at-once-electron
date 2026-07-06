import { useCallback } from "react"

import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import type { ConvertedImage } from "@/lib/pdfConverter"
import type { ImportedFile } from "@/types/pdfTools.types"

/** PDFファイルの読み込み・ページ情報取得・サムネイル生成を行うフック */
export function useImportedFiles() {
  const {
    passwordDialog,
    convertPdfWithRetry,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = usePdfPasswordConversion()

  // 変換済み画像から ImportedFile を構築する（ページ数・サムネイルは画像から導出）
  const buildImportedFile = useCallback(
    (name: string, path: string, images: ConvertedImage[]): ImportedFile => {
      const pageCount = images.length
      const thumbnails = images.map((image) =>
        arrayBufferToDataUrl(image.buffer, image.type)
      )

      const selectedPages = new Set<number>()
      for (let i = 1; i <= pageCount; i++) {
        selectedPages.add(i)
      }

      return {
        id: crypto.randomUUID(),
        name,
        path,
        pageCount,
        thumbnails,
        selectedPages,
        nUp: {
          enabled: false,
          layout: "2x1",
        },
        rotation: 0,
      }
    },
    []
  )

  // Fileオブジェクトから処理（ドラッグ&ドロップ用）
  const processFiles = useCallback(
    async (files: File[]): Promise<ImportedFile[]> => {
      const processedFiles: ImportedFile[] = []

      for (const file of files) {
        try {
          // webUtils.getPathForFile でファイルパスを取得
          const filePath = window.electronAPI.pdfTools.getPathForFile(file)

          // パスワード対応でPDFを画像変換（ページ数・サムネイルを一度に取得）
          const images = await convertPdfWithRetry(file)
          if (!images) {
            // パスワード入力がキャンセルされた → このファイルはスキップ
            continue
          }

          processedFiles.push(buildImportedFile(file.name, filePath, images))
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
        }
      }

      return processedFiles
    },
    [convertPdfWithRetry, buildImportedFile]
  )

  // ファイルパスから処理（Electronダイアログ用）
  const processFilePaths = useCallback(
    async (filePaths: string[]): Promise<ImportedFile[]> => {
      const processedFiles: ImportedFile[] = []

      for (const filePath of filePaths) {
        try {
          // appimg:/// プロトコルでローカルファイルを読み込み、Fileオブジェクト化
          const file = await loadFileFromPath(filePath)

          // パスワード対応でPDFを画像変換（ページ数・サムネイルを一度に取得）
          const images = await convertPdfWithRetry(file)
          if (!images) {
            // パスワード入力がキャンセルされた → このファイルはスキップ
            continue
          }

          processedFiles.push(buildImportedFile(file.name, filePath, images))
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
        }
      }

      return processedFiles
    },
    [convertPdfWithRetry, buildImportedFile]
  )

  return {
    processFiles,
    processFilePaths,
    passwordDialog,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}

/** ローカルパスからFileオブジェクトを読み込む */
async function loadFileFromPath(filePath: string): Promise<File> {
  const response = await fetch(`appimg:///${filePath}`)
  const arrayBuffer = await response.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: "application/pdf" })
  return new File([blob], filePath.split("/").pop() || "file.pdf", {
    type: "application/pdf",
  })
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
