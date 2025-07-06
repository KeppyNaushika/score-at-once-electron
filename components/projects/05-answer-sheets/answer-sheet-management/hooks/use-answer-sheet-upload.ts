import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { convertPdfToImages, getPdfPageCount } from "@/lib/pdfConverter"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/components/projects/05-answer-sheets/answer-sheet-management/types"

export function useAnswerSheetUpload(
  projectId: string,
  students: UnifiedStudent[],
  onUploadComplete?: () => void
) {
  // State管理
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [files, setFiles] = useState<UnifiedFile[]>([])
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(0)
  const [fileOrder, setFileOrder] = useState<PlacementStrategy>("page-first")
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // PDFパスワード処理
  const [passwordDialog, setPasswordDialog] = useState<{
    isOpen: boolean
    filename: string
    onSubmit: (password: string) => void
    onCancel: () => void
  }>({
    isOpen: false,
    filename: "",
    onSubmit: () => {},
    onCancel: () => {},
  })

  // Intersection Observer for lazy loading
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [imageLoadStates, setImageLoadStates] = useState<
    Record<string, "pending" | "loading" | "loaded" | "error">
  >({})

  // Intersection Observer setup
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const fileId = entry.target.getAttribute("data-file-id")
          if (fileId && entry.isIntersecting) {
            setImageLoadStates((prev) => ({
              ...prev,
              [fileId]: "loading",
            }))

            const img = entry.target.querySelector("img")
            if (img) {
              img.onload = () => {
                setImageLoadStates((prev) => ({
                  ...prev,
                  [fileId]: "loaded",
                }))
              }
              img.onerror = () => {
                setImageLoadStates((prev) => ({
                  ...prev,
                  [fileId]: "error",
                }))
              }
            }

            observerRef.current?.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: "50px",
        threshold: 0.1,
      }
    )

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  // ファイル変換処理
  const convertFiles = useCallback(
    async (rawFiles: File[]): Promise<UnifiedFile[]> => {
      const results: UnifiedFile[] = []
      let processedCount = 0

      for (const file of rawFiles) {
        try {
          if (file.type === "application/pdf") {
            // PDF処理
            try {
              // PDF処理は一旦簡素化
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
            } catch (pdfError: any) {
              console.error(`PDF conversion failed for ${file.name}:`, pdfError)
              // パスワードエラー等は一旦スキップ
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
          setPdfProcessingProgress(Math.round((processedCount / rawFiles.length) * 100))
        } catch (error) {
          console.error(`Error converting file ${file.name}:`, error)
          toast.error(`${file.name}: 変換に失敗しました`)
        }
      }

      return results
    },
    []
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
        if (error instanceof Error && error.message !== "Password dialog cancelled") {
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
      setUploadProgress(0)

      try {
        let successCount = 0
        for (let i = 0; i < uploadData.length; i++) {
          const data = uploadData[i]
          const result = await window.electronAPI.uploadAnswerSheets(projectId, [data])

          if (result.success) {
            successCount++
          } else {
            console.error(`Upload failed for ${data.name}:`, result.error)
          }

          setUploadProgress(Math.round(((i + 1) / uploadData.length) * 100))
        }

        if (successCount > 0) {
          toast.success(`${successCount}件の答案をアップロードしました`)
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
        setUploadProgress(0)
      }
    },
    [onUploadComplete]
  )

  return {
    // State
    isUploading,
    isConverting,
    files,
    pdfProcessingProgress,
    fileOrder,
    uploadProgress,
    passwordDialog,
    imageLoadStates,
    observerRef,

    // Actions
    setFiles,
    setFileOrder,
    setPasswordDialog,
    handleDrop,
    handleUpload,
  }
}