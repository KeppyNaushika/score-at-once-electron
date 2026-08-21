import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  PlacementStrategy,
  UnsavedAnswerImage,
  UploadData,
} from "@/components/exams/06-student-answers/types"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import { uploadStudentAnswersMutation } from "@/queries/answerSheet"
import { examDetailQuery, updateExamMutation } from "@/queries/exam"
import { masterMarkersQuery } from "@/queries/omr"

/** 答案ファイルのドロップ・変換・アップロード処理を統合するフック */
export function useStudentAnswerUpload(
  examId: string,
  onUploadComplete?: () => void,
  onCorrectionStatusUpdate?: (
    map: Map<string, "corrected" | "skipped">
  ) => void,
  mode: "upload" | "view" = "upload"
) {
  // 試験を更新すると一覧の要約も古くなる。取り直す先は利用者ごとなので、
  // 誰が見ている一覧かを添える
  const currentUser = useCurrentUser()
  const updateExam = useMutation(updateExamMutation(examId, currentUser.id))
  const uploadStudentAnswers = useMutation(
    uploadStudentAnswersMutation(examId ?? "")
  )

  // State管理
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [files, setFiles] = useState<UnsavedAnswerImage[]>([])
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(0)
  const [fileOrder, setFileOrder] = useState<PlacementStrategy>("page-first")

  // マーカー補正
  const [markerCorrectionEnabled, setMarkerCorrectionEnabledState] =
    useState(false)
  const filesRef = useRef<UnsavedAnswerImage[]>([])
  const prevFilesRef = useRef<UnsavedAnswerImage[]>([])

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

  // ファイル変換処理
  const convertFiles = useCallback(
    async (rawFiles: File[]): Promise<UnsavedAnswerImage[]> => {
      const results: UnsavedAnswerImage[] = []
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
                  examStudentId: null,
                  examPageId: null,
                  imagePath: null,
                  name: image.name,
                  originalFileName: file.name,
                  fileType: image.type,
                  size: image.buffer.byteLength,
                  buffer: image.buffer,
                  preview,
                  isSelected: false,
                })
              }
            }
          } else {
            // 画像ファイル処理
            const buffer = await file.arrayBuffer()
            results.push({
              id: crypto.randomUUID(),
              examStudentId: null,
              examPageId: null,
              imagePath: null,
              name: file.name,
              originalFileName: file.name,
              fileType: file.type,
              size: file.size,
              buffer,
              preview: URL.createObjectURL(file),
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

  // 試験の markerCorrectionEnabled をトグルの初期値にする
  const { data: exam } = useQuery({
    ...examDetailQuery(examId ?? ""),
    enabled: mode === "upload" && Boolean(examId),
  })
  const [seededExamId, setSeededExamId] = useState<string | null>(null)
  if (exam && seededExamId !== exam.id) {
    setSeededExamId(exam.id)
    setMarkerCorrectionEnabledState(exam.markerCorrectionEnabled)
  }

  // トグル変更時はDBにも反映（次回アップロード時の初期値となる）
  const setMarkerCorrectionEnabled = useCallback(
    (enabled: boolean) => {
      setMarkerCorrectionEnabledState(enabled)
      if (!examId) return
      // 試験のキャッシュは他の画面も見ているので、紐づくものごと取り直す（meta）
      updateExam.mutate({ markerCorrectionEnabled: enabled })
    },
    [examId, updateExam]
  )

  // マスターマーカー検出（補正可否判定のみ。トグル状態は試験設定に従う）
  const { data: masterMarkers } = useQuery({
    ...masterMarkersQuery(examId ?? ""),
    enabled: mode === "upload" && Boolean(examId),
  })

  // マーカーを検出できたページ（同定は ExamPage.id）
  const markerAvailableExamPageIds = useMemo(
    () =>
      new Set(
        (masterMarkers?.pages ?? [])
          .filter((page) => page.result.success)
          .map((page) => page.examPageId)
      ),
    [masterMarkers]
  )
  const markerCorrectionAvailable = markerAvailableExamPageIds.size > 0

  // 検出できなかったページの内訳（表示用）
  const markerDiagnostics = useMemo(() => {
    const lines: string[] = []
    for (const page of masterMarkers?.pages ?? []) {
      if (page.result.success || !page.result.diagnostics) continue
      lines.push(`ページ${page.pageNumber}:`)
      for (const diagnostic of page.result.diagnostics) {
        if (!diagnostic.detected) {
          lines.push(
            `  ${diagnostic.corner}: ${diagnostic.failReason ?? "不明"} (黒px: ${diagnostic.darkPixels}/${diagnostic.totalPixels})`
          )
        }
      }
    }
    return lines.join("\n")
  }, [masterMarkers])

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
        // クライアント側補正結果からマップ構築（キーは (examStudentId, examPageId)＝セル同定）
        const correctionMap = new Map<string, "corrected" | "skipped">()
        for (const uploadItem of uploadData) {
          if (
            uploadItem.correctionStatus &&
            uploadItem.correctionStatus !== "not_requested" &&
            uploadItem.examStudentId
          ) {
            const key = `${uploadItem.examStudentId}-${uploadItem.examPageId}`
            correctionMap.set(
              key,
              uploadItem.correctionStatus as "corrected" | "skipped"
            )
          }
        }

        const uploaded = await uploadStudentAnswers.mutateAsync(uploadData)

        toast.success(`${uploaded.length}件の答案をアップロードしました`)
        setFiles([])
        if (correctionMap.size > 0) {
          onCorrectionStatusUpdate?.(correctionMap)
        }
        onUploadComplete?.()
      } catch {
        // 失敗の知らせは中央のトーストが出す
      } finally {
        setIsUploading(false)
      }
    },
    [onUploadComplete, onCorrectionStatusUpdate, uploadStudentAnswers]
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

    // Marker correction
    markerCorrectionEnabled,
    markerCorrectionAvailable,
    markerDiagnostics,
    markerAvailableExamPageIds,
    setMarkerCorrectionEnabled,

    // Actions
    setFiles,
    setFileOrder,
    handleDrop,
    handleUpload,
  }
}
