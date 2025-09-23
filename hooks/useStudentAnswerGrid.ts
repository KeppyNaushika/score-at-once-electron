/**
 * 簡素化された答案シートグリッド管理フック
 * table-dnd-kit-test統合版
 */

import type { UnifiedFile, UnifiedStudent } from "@/types/student-answer.types"
import {
  convertToUnifiedStudent,
  convertToUploadData,
} from "@/utils/studentAnswerConverter"
import { sortStudentsForTable } from "@/utils/studentOrderUtils"
import type { ProjectStudent, Student } from "@prisma/client"
import { useCallback, useState } from "react"
import { toast } from "sonner"

// ============================================================================
// フックのProps
// ============================================================================

interface UseAnswerSheetGridProps {
  projectId: string
  students: (Student & {
    projectStudent?: ProjectStudent
    customOrder?: number | null
    status?: string
    attendanceNumber?: number | null
  })[] // Student with project-specific data
  onUploadComplete?: () => void
}

// ============================================================================
// フックの戻り値
// ============================================================================

interface UseAnswerSheetGridReturn {
  // State
  files: UnifiedFile[]
  unifiedStudents: UnifiedStudent[]
  isUploading: boolean
  uploadProgress: number

  // Actions
  setFiles: (files: UnifiedFile[]) => void
  addFiles: (newFiles: UnifiedFile[]) => void
  handleUpload: (filesToUpload: UnifiedFile[]) => Promise<void>

  // Computed
  sortedStudents: UnifiedStudent[]
  placedFiles: UnifiedFile[]
  unplacedFiles: UnifiedFile[]
  totalFiles: number
  placedCount: number
}

// ============================================================================
// メインフック
// ============================================================================

export function useAnswerSheetGrid({
  projectId,
  students,
  onUploadComplete,
}: UseAnswerSheetGridProps): UseAnswerSheetGridReturn {
  // ============================================================================
  // State管理
  // ============================================================================

  const [files, setFiles] = useState<UnifiedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // ============================================================================
  // 生徒データの変換
  // ============================================================================

  const unifiedStudents = students.map(convertToUnifiedStudent)
  const sortedStudents = sortStudentsForTable(unifiedStudents)

  // ============================================================================
  // 計算済みプロパティ
  // ============================================================================

  const placedFiles = files.filter((f) => f.studentId)
  const unplacedFiles = files.filter((f) => !f.studentId)
  const totalFiles = files.length
  const placedCount = placedFiles.length

  // ============================================================================
  // ファイル管理
  // ============================================================================

  const addFiles = useCallback((newFiles: UnifiedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  // ============================================================================
  // アップロード処理
  // ============================================================================

  const handleUpload = useCallback(
    async (filesToUpload: UnifiedFile[]) => {
      if (filesToUpload.length === 0) {
        toast.error("アップロードするファイルがありません")
        return
      }

      try {
        setIsUploading(true)
        setUploadProgress(0)

        // UploadData形式に変換
        const uploadData = convertToUploadData(filesToUpload, unifiedStudents)

        // プログレス更新（簡易版）
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return 90
            }
            return prev + 10
          })
        }, 100)

        // ElectronAPIを呼び出し
        const result = await window.electronAPI.uploadStudentAnswers(
          projectId,
          uploadData,
        )

        clearInterval(progressInterval)

        if (result.success) {
          setUploadProgress(100)
          toast.success(
            `${filesToUpload.length}件のファイルをアップロードしました`,
          )

          setFiles((prev) =>
            prev.filter(
              (f) => !filesToUpload.some((uploaded) => uploaded.id === f.id),
            ),
          )

          onUploadComplete?.()
        } else {
          throw new Error(result.error || "アップロードに失敗しました")
        }
      } catch (error) {
        console.error("アップロードエラー:", error)
        toast.error(
          error instanceof Error
            ? `アップロードに失敗しました: ${error.message}`
            : "アップロードに失敗しました",
        )
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    },
    [projectId, unifiedStudents, onUploadComplete],
  )

  return {
    // State
    files,
    unifiedStudents,
    isUploading,
    uploadProgress,

    // Actions
    setFiles,
    addFiles,
    handleUpload,

    // Computed
    sortedStudents,
    placedFiles,
    unplacedFiles,
    totalFiles,
    placedCount,
  }
}
