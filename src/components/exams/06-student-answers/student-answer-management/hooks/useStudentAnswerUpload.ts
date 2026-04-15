import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  PlacementStrategy,
  UnifiedFile,
  UploadData,
} from "@/components/exams/06-student-answers/student-answer-management/types"
import { type ConvertedImage, convertPdfToImages } from "@/lib/pdfConverter"

/** 答案ファイルのドロップ・変換・アップロード処理を統合するフック */
export function useStudentAnswerUpload(
  examId: string,
  onUploadComplete?: () => void,
  onCorrectionStatusUpdate?: (
    map: Map<string, "corrected" | "skipped">
  ) => void,
  mode: "upload" | "view" = "upload"
) {
  // State管理
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [files, setFiles] = useState<UnifiedFile[]>([])
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(0)
  const [fileOrder, setFileOrder] = useState<PlacementStrategy>("page-first")

  // マーカー補正
  const [markerCorrectionEnabled, setMarkerCorrectionEnabled] = useState(false)
  const [markerCorrectionAvailable, setMarkerCorrectionAvailable] =
    useState(false)
  const [markerDiagnostics, setMarkerDiagnostics] = useState("")
  const [markerAvailablePages, setMarkerAvailablePages] = useState<Set<number>>(
    new Set()
  )
  const filesRef = useRef<UnifiedFile[]>([])
  const prevFilesRef = useRef<UnifiedFile[]>([])

  // 前回描画と比較し、削除されたファイルのblob URLを解放
  useEffect(() => {
    const currentIds = new Set(files.map((f) => f.id))
    for (const prev of prevFilesRef.current) {
      if (!currentIds.has(prev.id) && prev.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.preview)
      }
    }
    prevFilesRef.current = files
    filesRef.current = files
  }, [files])

  // アンマウント時に全blob URLを解放
  useEffect(() => {
    return () => {
      for (const f of prevFilesRef.current) {
        if (f.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(f.preview)
        }
      }
    }
  }, [])

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

  // マスターマーカー検出（補正可否判定）
  useEffect(() => {
    if (mode !== "upload" || !examId) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await window.electronAPI.omr.detectMasterMarkers(examId)
        if (cancelled) return
        // マスターマーカーを検出できたページを記録
        const availablePages = new Set<number>()
        if (result.pages) {
          for (const page of result.pages) {
            if (page.result.success) {
              availablePages.add(page.pageNumber)
            }
          }
        }
        // 内容が同じなら既存参照を維持（effect誤発火防止）
        setMarkerAvailablePages((prev) => {
          if (
            prev.size === availablePages.size &&
            [...prev].every((p) => availablePages.has(p))
          ) {
            return prev
          }
          return availablePages
        })
        setMarkerCorrectionAvailable(availablePages.size > 0)
        setMarkerCorrectionEnabled(availablePages.size > 0)
        if (!result.success && result.pages) {
          const lines: string[] = []
          for (const page of result.pages) {
            if (!page.result.success && page.result.diagnostics) {
              lines.push(`ページ${page.pageNumber}:`)
              for (const d of page.result.diagnostics) {
                if (!d.detected) {
                  lines.push(
                    `  ${d.corner}: ${d.failReason ?? "不明"} (黒px: ${d.darkPixels}/${d.totalPixels})`
                  )
                }
              }
            }
          }
          setMarkerDiagnostics(lines.join("\n"))
        }
      } catch {
        if (!cancelled) {
          setMarkerCorrectionAvailable(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [examId, mode])

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
        // クライアント側補正結果からマップ構築（uploadDataの(studentId,pageNumber)=生徒×マスターページ）
        const correctionMap = new Map<string, "corrected" | "skipped">()
        for (const d of uploadData) {
          if (
            d.correctionStatus &&
            d.correctionStatus !== "not_requested" &&
            d.studentId
          ) {
            const key = `${d.studentId}-${d.pageNumber}`
            correctionMap.set(
              key,
              d.correctionStatus as "corrected" | "skipped"
            )
          }
        }

        const result = await window.electronAPI.uploadStudentAnswers(
          examId,
          uploadData
        )

        if (result.success && result.answerSheets) {
          const successCount = result.answerSheets.length

          toast.success(`${successCount}件の答案をアップロードしました`)
          setFiles([])
          if (correctionMap.size > 0) {
            onCorrectionStatusUpdate?.(correctionMap)
          }
          onUploadComplete?.()
        } else {
          console.error("Upload failed:", result.error)
          toast.error(result.error || "アップロードに失敗しました")
        }
      } catch (error) {
        console.error("Upload error:", error)
        toast.error("アップロードに失敗しました")
      } finally {
        setIsUploading(false)
      }
    },
    [onUploadComplete, onCorrectionStatusUpdate, examId]
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

    // Marker correction
    markerCorrectionEnabled,
    markerCorrectionAvailable,
    markerDiagnostics,
    markerAvailablePages,
    setMarkerCorrectionEnabled,

    // Actions
    setFiles,
    setFileOrder,
    handleDrop,
    handleUpload,
  }
}
