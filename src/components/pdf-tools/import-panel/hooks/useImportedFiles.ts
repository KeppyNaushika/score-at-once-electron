import { useCallback } from "react"
import { toast } from "sonner"

import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import { type ConvertedImage, PDF_RENDER_SCALE } from "@/lib/pdfConverter"
import type { ImportedFile, SourcePdfMetadata } from "@/types/pdfTools.types"

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
    (
      name: string,
      path: string,
      images: ConvertedImage[],
      sourcePdfMetadata: SourcePdfMetadata | null
    ): ImportedFile => {
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
        sourcePdfMetadata,
      }
    },
    []
  )

  // 1ファイル分の共通処理: 画像変換し、パスワード保護PDFはパスを復号済み複製へ差し替える
  const importFile = useCallback(
    async (file: File, originalPath: string): Promise<ImportedFile | null> => {
      // パスワード対応でPDFを画像変換（ページ数・サムネイルを一度に取得）
      const conversion = await convertPdfWithRetry(file)
      if (!conversion) {
        // パスワード入力がキャンセルされた → このファイルはスキップ
        return null
      }

      // ページサイズ・暗号化有無は復号済み複製へ差し替える前の元PDFから読む
      const sourcePdfMetadata = await readSourcePdfMetadata(originalPath)

      // 書き出し(pdf-lib)は暗号化PDFを読めないため、保護されていたPDFは
      // 復号済みページ画像から再構成した一時PDFのパスに差し替える
      let filePath = originalPath
      if (conversion.passwordProtected) {
        try {
          filePath = await createDecryptedCopy(conversion.images)
        } catch (error) {
          // 複製の作成に失敗したら、無言で落とさずエラーを通知して当該ファイルを飛ばす
          console.error(
            `Failed to create decrypted copy for ${file.name}:`,
            error
          )
          toast.error(
            `「${file.name}」の復号済み複製の作成に失敗したため、取り込めませんでした`
          )
          return null
        }
        toast.info(
          `「${file.name}」はパスワード保護されているため、画像化した複製を使用します`
        )
      }

      return buildImportedFile(
        file.name,
        filePath,
        conversion.images,
        sourcePdfMetadata
      )
    },
    [convertPdfWithRetry, buildImportedFile]
  )

  // Fileオブジェクトから処理（ドラッグ&ドロップ用）
  const processFiles = useCallback(
    async (files: File[]): Promise<ImportedFile[]> => {
      const processedFiles: ImportedFile[] = []

      for (const file of files) {
        try {
          // webUtils.getPathForFile でファイルパスを取得
          const filePath = window.electronAPI.pdfTools.getPathForFile(file)

          const importedFile = await importFile(file, filePath)
          if (importedFile) {
            processedFiles.push(importedFile)
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
        }
      }

      return processedFiles
    },
    [importFile]
  )

  // ファイルパスから処理（Electronダイアログ用）
  const processFilePaths = useCallback(
    async (filePaths: string[]): Promise<ImportedFile[]> => {
      const processedFiles: ImportedFile[] = []

      for (const filePath of filePaths) {
        try {
          // appimg:/// プロトコルでローカルファイルを読み込み、Fileオブジェクト化
          const file = await loadFileFromPath(filePath)

          const importedFile = await importFile(file, filePath)
          if (importedFile) {
            processedFiles.push(importedFile)
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
        }
      }

      return processedFiles
    },
    [importFile]
  )

  return {
    processFiles,
    processFilePaths,
    passwordDialog,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}

/**
 * 元PDFのページ数・ページサイズ・暗号化有無を読み取る。
 * 情報表示のためだけなので、読めなくても取り込み自体は続行できるよう null を返す。
 */
async function readSourcePdfMetadata(
  filePath: string
): Promise<SourcePdfMetadata | null> {
  try {
    const pdfInfoResult = await window.electronAPI.pdfTools.getPdfInfo(filePath)
    if (
      !pdfInfoResult.success ||
      pdfInfoResult.pageCount === undefined ||
      pdfInfoResult.pageWidth === undefined ||
      pdfInfoResult.pageHeight === undefined ||
      pdfInfoResult.isEncrypted === undefined
    ) {
      return null
    }
    return {
      pageCount: pdfInfoResult.pageCount,
      pageWidth: pdfInfoResult.pageWidth,
      pageHeight: pdfInfoResult.pageHeight,
      isEncrypted: pdfInfoResult.isEncrypted,
    }
  } catch (error) {
    console.error(`Failed to read PDF info for ${filePath}:`, error)
    return null
  }
}

/** 復号済みページ画像から一時PDF（復号済み複製）を作成し、そのパスを返す */
async function createDecryptedCopy(images: ConvertedImage[]): Promise<string> {
  const result = await window.electronAPI.pdfTools.createDecryptedCopy({
    pageImages: images.map((image) => new Uint8Array(image.buffer)),
    pixelsPerPoint: PDF_RENDER_SCALE,
  })
  if (!result.success || !result.path) {
    throw new Error(result.error || "復号済みPDFの作成に失敗しました")
  }
  return result.path
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
