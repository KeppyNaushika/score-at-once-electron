"use client"

import { PasswordDialog } from "@/components/ui/password-dialog"
import { Progress } from "@/components/ui/progress"
import { convertPdfToImages, getPdfPageCount } from "@/lib/pdfConverter"
import { useCallback, useState, useEffect } from "react"
import { toast } from "sonner"

// table-dnd-kit-test準拠のコンポーネント
import FileUploadZone from "./FileUploadZone"
import TableDndKitAnswerGrid from "./TableDndKitAnswerGrid"

// 統一型定義
import type {
  ConvertedFileTemp,
  PasswordDialogState,
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/types/answer-sheet.types"

// ============================================================================
// Props定義（table-dnd-kit-test準拠）
// ============================================================================

interface AnswerSheetUploadNewProps {
  projectId: string
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
    attendanceNumber?: number | null
    status?: "participating" | "expected" | "absent"
    customOrder?: number | null
  }>
  masterImageCount: number // 模範解答のページ数
  onUploadComplete?: () => void
  existingAnswerSheets?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
    originalImagePath: string | null
    isAbsent: boolean
    student: {
      id: string
      lastName: string
      firstName: string
      studentId: string
    } | null
  }>
  mode?: "upload" | "view" // 新規アップロード or 既存データ表示
}

// ============================================================================
// メインコンポーネント（table-dnd-kit-test準拠）
// ============================================================================

export default function AnswerSheetUploadNew({
  projectId,
  students,
  masterImageCount,
  onUploadComplete,
  existingAnswerSheets,
  mode = "upload",
}: AnswerSheetUploadNewProps) {
  // ============================================================================
  // State管理（table-dnd-kit-test準拠のシンプル構造）
  // ============================================================================

  const [files, setFiles] = useState<UnifiedFile[]>([])
  const [placementStrategy, setPlacementStrategy] =
    useState<PlacementStrategy>("page-first")
  const [isUploading, setIsUploading] = useState(false)

  // ファイル処理関連state
  const [isConverting, setIsConverting] = useState(false)
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(0)
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>({
    isOpen: false,
    attempts: 0,
    hasError: false,
  })
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  // 統一された生徒データ
  const unifiedStudents: UnifiedStudent[] = students.map((s) => ({
    id: s.id,
    lastName: s.lastName,
    firstName: s.firstName,
    lastNameKana: s.lastNameKana,
    firstNameKana: s.firstNameKana,
    studentId: s.studentId,
    attendanceNumber: s.attendanceNumber,
    status: s.status,
    customOrder: s.customOrder,
  }))

  // 既存答案データの初期化
  useEffect(() => {
    const loadExistingFiles = async () => {
      if (mode === "view" && existingAnswerSheets) {
        const convertedFiles: UnifiedFile[] = []
        
        for (const sheet of existingAnswerSheets) {
          let previewUrl: string | undefined = undefined
          
          // ファイルパスが存在する場合、Base64として読み込み
          if (sheet.originalImagePath) {
            try {
              const result = await window.electronAPI.readFileAsBase64(sheet.originalImagePath)
              if (result.success && result.data) {
                previewUrl = result.data
              } else {
                console.warn(`Failed to load image: ${sheet.originalImagePath}`, result.error)
              }
            } catch (error) {
              console.error(`Error loading image: ${sheet.originalImagePath}`, error)
            }
          }
          
          convertedFiles.push({
            id: sheet.id,
            name: `ページ ${sheet.pageNumber}`,
            type: "image/png",
            size: 0,
            preview: previewUrl,
            studentId: sheet.studentId || undefined,
            pageNumber: sheet.pageNumber,
            isSelected: false,
            pageLabel: `ページ ${sheet.pageNumber}`,
            buffer: new ArrayBuffer(0),
            originalFileName: `ページ ${sheet.pageNumber}`,
            position: (sheet.pageNumber - 1), // customOrderは別の仕組みで管理される
            // isDisabled: sheet.isAbsent, // UnifiedFileにはisDisabledプロパティが存在しない
          })
        }
        
        setFiles(convertedFiles)
      }
    }
    
    loadExistingFiles()
  }, [mode, existingAnswerSheets, masterImageCount])

  // ============================================================================
  // ファイル変換処理（シンプル化）
  // ============================================================================

  const convertSingleFileToImages = useCallback(
    async (
      file: File,
      password?: string,
      onProgress?: (current: number, total: number) => void,
    ): Promise<ConvertedFileTemp[]> => {
      try {
        if (file.type === "application/pdf") {
          const convertedImages = await convertPdfToImages(
            file,
            password,
            onProgress,
          )
          return convertedImages.map((img, index) => {
            // バッファからプレビューURLを生成
            const blob = new Blob([img.buffer], { type: img.type })
            const preview = URL.createObjectURL(blob)

            return {
              id: `${file.name}-page-${index + 1}-${Date.now()}`,
              name: `${file.name} - ページ ${index + 1}`,
              type: "image/png",
              size: img.buffer.byteLength,
              buffer: img.buffer,
              preview,
              originalFileName: file.name,
              pageNumber: index + 1,
              pageLabel: `ページ ${index + 1}`,
            }
          })
        } else {
          // 画像ファイルの場合
          const buffer = await file.arrayBuffer()
          const preview = URL.createObjectURL(file)
          return [
            {
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              type: file.type,
              size: file.size,
              buffer,
              preview,
              originalFileName: file.name,
              pageNumber: 1,
              pageLabel: "ページ 1",
            },
          ]
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("password") ||
            error.message === "password-required" ||
            error.message === "invalid-password")
        ) {
          // パスワードエラーの場合は静かに再スロー（ログ出力なし）
          throw error
        } else {
          toast.error(`ファイル ${file.name} の変換に失敗しました`)
        }
      }
      return []
    },
    [],
  )

  // ============================================================================
  // ファイル処理（自動配置ロジック統合）
  // ============================================================================

  const processFiles = useCallback(
    async (fileList: File[], password?: string) => {
      try {
        setIsConverting(true)
        setPdfProcessingProgress(0)


        // 総ページ数計算
        let totalPages = 0

        for (const file of fileList) {
          if (file.type === "application/pdf") {
            try {
              const pageCount = await getPdfPageCount(file, password)
              totalPages += pageCount
            } catch (error) {
              if (
                error instanceof Error &&
                (error.message.includes("password") ||
                  error.message === "password-required" ||
                  error.message === "invalid-password")
              ) {
                // パスワードが必要な場合は即座にダイアログを表示
                throw error
              }
              totalPages += 1 // エラー時は1ページと仮定
            }
          } else {
            totalPages += 1
          }
        }


        let processedPages = 0
        const allConvertedFiles: ConvertedFileTemp[] = []

        // ファイル変換処理
        for (const file of fileList) {
          const expectedPages =
            file.type === "application/pdf"
              ? await getPdfPageCount(file, password).catch((error) => {
                  if (
                    error instanceof Error &&
                    (error.message.includes("password") ||
                      error.message === "password-required" ||
                      error.message === "invalid-password")
                  ) {
                    throw error
                  }
                  return 1
                })
              : 1

          try {

            const convertedFiles = await convertSingleFileToImages(
              file,
              password,
              (currentPage, totalPagesInFile) => {
                const currentFileProgress = processedPages + currentPage
                const progress = Math.round(
                  (currentFileProgress / totalPages) * 100,
                )
                setPdfProcessingProgress(progress)

              },
            )

            allConvertedFiles.push(...convertedFiles)
            processedPages += expectedPages

          } catch (error) {
            if (
              error instanceof Error &&
              (error.message.includes("password") ||
                error.message === "password-required" ||
                error.message === "invalid-password")
            ) {
              // パスワード必要エラーの場合は静かに再スロー
              throw error
            } else {
              toast.error(`ファイル ${file.name} の処理に失敗しました`)
              processedPages += expectedPages // エラー時も予想ページ数分進める
              setPdfProcessingProgress(
                Math.round((processedPages / totalPages) * 100),
              )
            }
          }
        }

        // table-dnd-kit-test準拠の自動配置ロジック

        const newFiles: UnifiedFile[] = allConvertedFiles.map(
          (convertedFile, index) => {
            // ページ優先配置ロジック（table-dnd-kit-test準拠）
            const studentIndex =
              Math.floor(index / masterImageCount) % unifiedStudents.length
            const pageIndex = index % masterImageCount
            const targetStudent = unifiedStudents[studentIndex]


            return {
              id: convertedFile.id,
              name: convertedFile.name,
              type: convertedFile.type,
              size: convertedFile.size,
              buffer: convertedFile.buffer,
              preview: convertedFile.preview,
              originalFileName: convertedFile.originalFileName,
              pageNumber: pageIndex + 1,
              pageLabel: convertedFile.pageLabel,
              studentId: targetStudent?.id, // 直接配置
              isSelected: false,
              position: studentIndex * masterImageCount + pageIndex,
            }
          },
        )

        setFiles((prev) => [...prev, ...newFiles])


        setPdfProcessingProgress(100)
        toast.success(`${allConvertedFiles.length}個のページを処理しました`)
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("password") ||
            error.message === "password-required" ||
            error.message === "invalid-password")
        ) {
          // パスワードが必要な場合
          setCurrentPdfFile(fileList[0]) // 最初のファイルを設定
          setPendingFiles(fileList)
          setPasswordDialog({
            isOpen: true,
            attempts: 0,
            hasError: false,
          })
        } else {
          // パスワード関連以外のエラーのみログ出力
          toast.error("ファイル処理に失敗しました")
        }
      } finally {
        setIsConverting(false)
        setPdfProcessingProgress(0)
      }
    },
    [masterImageCount, unifiedStudents, convertSingleFileToImages],
  )

  // ============================================================================
  // ファイルドロップ処理
  // ============================================================================

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast.error("サポートされていないファイル形式です")
        return
      }


      processFiles(acceptedFiles)
    },
    [processFiles],
  )

  // ============================================================================
  // パスワード処理
  // ============================================================================

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!currentPdfFile || pendingFiles.length === 0) {
        return
      }


      try {
        setPasswordDialog((prev) => ({ ...prev, isOpen: false }))

        if (pendingFiles.length === 1) {
          // 単一ファイルの場合
          await processFiles([currentPdfFile], password)
        } else {
          // 複数ファイルの場合
          setIsConverting(true)
          setPdfProcessingProgress(0)

          await processFiles(pendingFiles, password)
        }


        // 成功時のクリーンアップ
        setCurrentPdfFile(null)
        setPendingFiles([])
        setPasswordDialog({ isOpen: false, attempts: 0, hasError: false })
      } catch (error) {

        setPasswordDialog((prev) => ({
          ...prev,
          attempts: prev.attempts + 1,
          hasError: true,
          isOpen: true,
        }))

        if (
          error instanceof Error &&
          (error.message.includes("password") ||
            error.message === "password-required" ||
            error.message === "invalid-password")
        ) {
          toast.error("パスワードが正しくありません")
        } else {
          toast.error("ファイル処理に失敗しました")
        }
      }
    },
    [currentPdfFile, pendingFiles, processFiles],
  )

  // ============================================================================
  // アップロード処理（table-dnd-kit-test準拠）
  // ============================================================================

  const handleUpload = useCallback(
    async (uploadData: UploadData[]) => {
      if (uploadData.length === 0) {
        toast.error("アップロードするファイルがありません")
        return
      }

      try {
        setIsUploading(true)

        const result = await window.electronAPI.uploadAnswerSheets(
          projectId,
          uploadData,
        )

        if (result.success) {
          toast.success(
            `${uploadData.length}件のファイルをアップロードしました`,
          )

          // アップロード完了後、該当ファイルを削除
          const uploadedIds = new Set(
            uploadData.map(
              (d) => d.name.split(" - ページ")[0] + "-page-" + d.pageNumber,
            ),
          )
          setFiles((prev) =>
            prev.filter(
              (f) => !uploadedIds.has(f.id.split("-").slice(0, -1).join("-")),
            ),
          )

          onUploadComplete?.()
        } else {
          throw new Error(result.error || "アップロードに失敗しました")
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `アップロードに失敗しました: ${error.message}`
            : "アップロードに失敗しました",
        )
      } finally {
        setIsUploading(false)
      }
    },
    [projectId, onUploadComplete],
  )

  // ============================================================================
  // 統計情報
  // ============================================================================

  const stats = {
    totalFiles: files.length,
    placedFiles: files.filter((f) => f.studentId).length,
    unplacedFiles: files.filter((f) => !f.studentId).length,
    totalStudents: unifiedStudents.length,
  }

  // ============================================================================
  // レンダリング
  // ============================================================================

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* ファイルアップロードゾーン（uploadモードのみ表示） */}
      {mode === "upload" && (
        <div className="space-y-4">
          <FileUploadZone
            onDrop={handleFilesDrop}
            isConverting={isConverting}
            disabled={isConverting || isUploading}
            masterImageCount={masterImageCount}
            pdfProcessingProgress={pdfProcessingProgress}
          />

          {/* 処理中プログレス */}
        </div>
      )}

      {/* 統計情報 */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-4 p-4 text-center">
          <div>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <div className="text-muted-foreground text-sm">総ファイル数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {stats.placedFiles}
            </div>
            <div className="text-muted-foreground text-sm">配置済み</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.unplacedFiles}
            </div>
            <div className="text-muted-foreground text-sm">未配置</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <div className="text-muted-foreground text-sm">総生徒数</div>
          </div>
        </div>
      )}

      {/* table-dnd-kit-test準拠のテーブルグリッド */}
      <div className="min-h-0 flex-1">
        <TableDndKitAnswerGrid
          projectId={projectId}
          students={unifiedStudents}
          files={files}
          masterImageCount={masterImageCount}
          fileOrder={placementStrategy}
          isUploading={isUploading}
          onFileOrderChange={setPlacementStrategy}
          onFilesChange={setFiles}
          onUpload={handleUpload}
        />
      </div>

      {/* パスワードダイアログ */}
      <PasswordDialog
        isOpen={passwordDialog.isOpen}
        fileName={currentPdfFile?.name || ""}
        error={
          passwordDialog.hasError ? "パスワードが正しくありません" : undefined
        }
        isFirstAttempt={passwordDialog.attempts === 0}
        onSubmit={handlePasswordSubmit}
        onClose={() => {
          setPasswordDialog({ isOpen: false, attempts: 0, hasError: false })
          setCurrentPdfFile(null)
          setPendingFiles([])
        }}
      />
    </div>
  )
}
