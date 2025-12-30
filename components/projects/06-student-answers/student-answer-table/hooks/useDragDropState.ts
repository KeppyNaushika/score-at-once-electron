import type { FileState } from "@/components/projects/06-student-answers/student-answer-table/types/dragDropTypes"
import { buildDnDArrayFromFileStates } from "@/components/projects/06-student-answers/student-answer-table/utils/dragDropUtils"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/components/projects/06-student-answers/types"
import { useCallback, useEffect, useRef, useState } from "react"

interface UseDragDropStateParams {
  files: UnifiedFile[]
  students?: UnifiedStudent[]
  modelAnswerCount?: number
  mode?: "upload" | "view"
  fileOrder?: PlacementStrategy
  onFilesChange: (files: UnifiedFile[]) => void
}

/**
 * ドラッグ&ドロップの状態管理を行うカスタムフック
 */
export function useDragDropState({
  files,
  students,
  modelAnswerCount,
  mode,
  fileOrder,
  onFilesChange,
}: UseDragDropStateParams) {
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)

  // メイン状態: 3つ組を管理
  const fileStatesRef = useRef<FileState[]>([])
  const initialFileStatesRef = useRef<FileState[]>([])
  const prevFileOrderRef = useRef<PlacementStrategy | undefined>(undefined)

  // 3つ組からDnD配列を構築する関数（メモ化）
  const buildDnDArray = useCallback(
    (fileStates: FileState[], strategy: PlacementStrategy): UnifiedFile[] => {
      if (!students || !modelAnswerCount) return []
      return buildDnDArrayFromFileStates(
        fileStates,
        strategy,
        students,
        modelAnswerCount,
        files
      )
    },
    [students, modelAnswerCount, files]
  )

  // 1. 初期化: DB → 3つ組（実データから直接生成）
  useEffect(() => {
    if (mode === "view" && files.length > 0) {
      // DBから直接3つ組を生成（推測ではなく実データ）
      const states: FileState[] = files.map((file) => ({
        fileId: file.id,
        studentId: file.studentId || null, // DBの実際の値
        pageNumber: file.pageNumber, // DBの実際の値
      }))

      fileStatesRef.current = [...states]
      initialFileStatesRef.current = [...states] // 常に最新のDBデータを初期状態として設定
    }
  }, [mode, files.length, files])

  // 2. 戦略変更時: 初期状態の3つ組 → DnD配列再構築
  useEffect(() => {
    if (
      initialFileStatesRef.current.length > 0 &&
      prevFileOrderRef.current !== fileOrder
    ) {
      const newFiles = buildDnDArray(
        initialFileStatesRef.current,
        fileOrder || "page-first"
      )
      if (newFiles.length > 0) {
        onFilesChange(newFiles)
        // 戦略変更後、現在の3つ組も初期状態に戻す
        fileStatesRef.current = [...initialFileStatesRef.current]
      }
      prevFileOrderRef.current = fileOrder
    }
  }, [fileOrder, buildDnDArray, onFilesChange])

  return {
    activeFile,
    setActiveFile,
    fileStatesRef,
    initialFileStatesRef,
  }
}
