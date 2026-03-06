import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  PlacementStrategy,
  UnifiedFile,
  UploadData,
} from "@/components/exams/06-student-answers/student-answer-management/types"
import { type ConvertedImage, convertPdfToImages } from "@/lib/pdfConverter"

export function useStudentAnswerUpload(
  examId: string,
  onUploadComplete?: () => void
) {
  // State管理
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [files, setFiles] = useState<UnifiedFile[]>([])
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(0)
  const [fileOrder, setFileOrder] = useState<PlacementStrategy>("page-first")

  // PDFパスワード処理
  const [passwordDialog, setPasswordDialog] = useState<{
    isOpen: boolean
    filename: string
    hasError: boolean
    isLoading: boolean
    onSubmit: (password: string) => void
    onCancel: () => void
  }>({
    isOpen: false,
    filename: "",
    hasError: false,
    isLoading: false,
    onSubmit: () => {},
    onCancel: () => {},
  })

  // Intersection Observer for lazy loading (無効化)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // パスワード付きPDF変換（リトライ対応）
  const convertPdfWithRetry = useCallback(
    async (file: File): Promise<ConvertedImage[] | null> => {
      let hasError = false

      // まずパスワードなしで試行
      try {
        return await convertPdfToImages(file)
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "password-required"
        ) {
          toast.error(`${file.name}: PDF変換に失敗しました`)
          return null
        }
      }

      // パスワード入力ループ（キャンセルまたは成功まで）
      while (true) {
        const password = await new Promise<string | null>((resolve) => {
          setPasswordDialog({
            isOpen: true,
            filename: file.name,
            hasError,
            isLoading: false,
            onSubmit: (pwd) => {
              setPasswordDialog((prev) => ({
                ...prev,
                isLoading: true,
                hasError: false,
              }))
              resolve(pwd)
            },
            onCancel: () => {
              setPasswordDialog((prev) => ({
                ...prev,
                isOpen: false,
                hasError: false,
                isLoading: false,
              }))
              resolve(null)
            },
          })
        })

        if (!password) {
          // キャンセルされた
          return null
        }

        try {
          const images = await convertPdfToImages(file, password)
          setPasswordDialog((prev) => ({
            ...prev,
            isOpen: false,
            hasError: false,
            isLoading: false,
          }))
          return images
        } catch (retryError) {
          if (
            retryError instanceof Error &&
            (retryError.message === "password-required" ||
              retryError.message === "invalid-password")
          ) {
            // パスワードが間違っている → リトライ
            hasError = true
            continue
          }
          // その他のエラー
          setPasswordDialog((prev) => ({
            ...prev,
            isOpen: false,
            hasError: false,
            isLoading: false,
          }))
          toast.error(`${file.name}: PDF変換に失敗しました`)
          return null
        }
      }
    },
    []
  )

  // ファイル変換処理
  const convertFiles = useCallback(
    async (rawFiles: File[]): Promise<UnifiedFile[]> => {
      const results: UnifiedFile[] = []
      let processedCount = 0

      for (const file of rawFiles) {
        try {
          if (file.type === "application/pdf") {
            // PDF処理 - 画像変換を実行（パスワードリトライ対応）
            const pdfImages = await convertPdfWithRetry(file)
            if (pdfImages) {
              for (let i = 0; i < pdfImages.length; i++) {
                const image = pdfImages[i]
                const blob = new Blob([image.buffer], { type: image.type })
                const preview = URL.createObjectURL(blob)

                results.push({
                  id: crypto.randomUUID(),
                  name: image.name,
                  originalFileName: file.name,
                  type: image.type,
                  size: image.buffer.byteLength,
                  buffer: image.buffer,
                  preview,
                  pageNumber: i + 1,
                  isSelected: false,
                })
              }
            }
          } else {
            // 画像ファイル処理
            const buffer = await file.arrayBuffer()
            results.push({
              id: crypto.randomUUID(),
              name: file.name,
              originalFileName: file.name,
              type: file.type,
              size: file.size,
              buffer,
              preview: URL.createObjectURL(file),
              pageNumber: 1,
              isSelected: false,
            })
          }

          processedCount++
          setPdfProcessingProgress(
            Math.round((processedCount / rawFiles.length) * 100)
          )
        } catch (error) {
          console.error(`Error converting file ${file.name}:`, error)
          toast.error(`${file.name}: 変換に失敗しました`)
        }
      }

      return results
    },
    [convertPdfWithRetry]
  )

  // ファイルドロップ処理
  const handleDrop = useCallback(
    async (rawFiles: File[]) => {
      setIsConverting(true)
      setPdfProcessingProgress(0)

      try {
        const convertedFiles = await convertFiles(rawFiles)
        setFiles((prev) => [...prev, ...convertedFiles])
        toast.success(`${convertedFiles.length}個のファイルを追加しました`)
      } catch (error) {
        console.error("File conversion error:", error)
        if (
          error instanceof Error &&
          error.message !== "Password dialog cancelled"
        ) {
          toast.error("ファイルの変換に失敗しました")
        }
      } finally {
        setIsConverting(false)
        setPdfProcessingProgress(0)
      }
    },
    [convertFiles]
  )

  // アップロード処理
  const handleUpload = useCallback(
    async (uploadData: UploadData[]) => {
      if (uploadData.length === 0) {
        toast.error("アップロードするファイルがありません")
        return
      }

      setIsUploading(true)

      try {
        let successCount = 0
        let overwriteCount = 0

        for (let i = 0; i < uploadData.length; i++) {
          const data = uploadData[i]
          const result = await window.electronAPI.uploadStudentAnswers(examId, [
            data,
          ])

          if (result.success) {
            successCount++
            // 上書きフラグをチェック
            // if (result.answerSheets?.[0]?.isOverwrite) {
            //   overwriteCount++
            // }
          } else {
            console.error(`Upload failed for ${data.name}:`, result.error)
          }
        }

        if (successCount > 0) {
          if (overwriteCount > 0) {
            toast.success(`${successCount}件の答案をアップロードしました`, {
              description: `${overwriteCount}件は既存データを上書き更新しました`,
              style: { backgroundColor: "#fef3c7", borderColor: "#f59e0b" },
            })
          } else {
            toast.success(`${successCount}件の答案をアップロードしました`)
          }
          setFiles([]) // アップロード成功後にファイルリストをクリア
          onUploadComplete?.()
        }

        if (successCount < uploadData.length) {
          toast.warning(
            `${uploadData.length - successCount}件のアップロードに失敗しました`
          )
        }
      } catch (error) {
        console.error("Upload error:", error)
        toast.error("アップロードに失敗しました")
      } finally {
        setIsUploading(false)
      }
    },
    [onUploadComplete, examId]
  )

  return {
    // State
    isUploading,
    isConverting,
    files,
    pdfProcessingProgress,
    fileOrder,
    passwordDialog,
    observerRef,

    // Actions
    setFiles,
    setFileOrder,
    handleDrop,
    handleUpload,
  }
}
