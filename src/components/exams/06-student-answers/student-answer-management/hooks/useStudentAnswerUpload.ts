import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  PlacementStrategy,
  UnifiedFile,
  UploadData,
} from "@/components/exams/06-student-answers/types"
import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"

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
  const [markerCorrectionEnabled, setMarkerCorrectionEnabledState] =
    useState(false)
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
    const currentIds = new Set(files.map((file) => file.id))
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
      for (const file of prevFilesRef.current) {
        if (file.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(file.preview)
        }
      }
    }
  }, [])

  // PDFパスワード処理は共通フックに委譲
  const {
    passwordDialog,
    convertPdfWithRetry,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = usePdfPasswordConversion()

  // Intersection Observer for lazy loading (無効化)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // ファイル変換処理
  const convertFiles = useCallback(
    async (rawFiles: File[]): Promise<UnifiedFile[]> => {
      const results: UnifiedFile[] = []
      let processedCount = 0

      for (const file of rawFiles) {
        try {
          if (file.type === "application/pdf") {
            // PDF処理 - 画像変換を実行（パスワードリトライ対応）
            const pdfConversion = await convertPdfWithRetry(file)
            if (pdfConversion) {
              const pdfImages = pdfConversion.images
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

  // 試験のmarkerCorrectionEnabled設定をトグルの初期値として読み込む
  useEffect(() => {
    if (mode !== "upload" || !examId) return
    let cancelled = false
    ;(async () => {
      try {
        const exam = await window.electronAPI.getExam(examId)
        if (cancelled || !exam) return
        setMarkerCorrectionEnabledState(exam.markerCorrectionEnabled)
      } catch {
        // 取得失敗時は既定のfalseを維持
      }
    })()
    return () => {
      cancelled = true
    }
  }, [examId, mode])

  // トグル変更時はDBにも反映（次回アップロード時の初期値となる）
  const setMarkerCorrectionEnabled = useCallback(
    (enabled: boolean) => {
      setMarkerCorrectionEnabledState(enabled)
      if (!examId) return
      window.electronAPI
        .updateExam(examId, { markerCorrectionEnabled: enabled })
        .catch((error) => {
          console.error("Failed to persist markerCorrectionEnabled:", error)
        })
    },
    [examId]
  )

  // マスターマーカー検出（補正可否判定のみ。トグル状態は試験設定に従う）
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
            [...prev].every((pageNumber) => availablePages.has(pageNumber))
          ) {
            return prev
          }
          return availablePages
        })
        setMarkerCorrectionAvailable(availablePages.size > 0)
        if (!result.success && result.pages) {
          const lines: string[] = []
          for (const page of result.pages) {
            if (!page.result.success && page.result.diagnostics) {
              lines.push(`ページ${page.pageNumber}:`)
              for (const diagnostic of page.result.diagnostics) {
                if (!diagnostic.detected) {
                  lines.push(
                    `  ${diagnostic.corner}: ${diagnostic.failReason ?? "不明"} (黒px: ${diagnostic.darkPixels}/${diagnostic.totalPixels})`
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
        for (const uploadItem of uploadData) {
          if (
            uploadItem.correctionStatus &&
            uploadItem.correctionStatus !== "not_requested" &&
            uploadItem.studentId
          ) {
            const key = `${uploadItem.studentId}-${uploadItem.pageNumber}`
            correctionMap.set(
              key,
              uploadItem.correctionStatus as "corrected" | "skipped"
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
    handlePasswordSubmit,
    handlePasswordCancel,
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
