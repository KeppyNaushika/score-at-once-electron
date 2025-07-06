"use client"

// 新しいリファクタリングされたコンポーネントをインポート
import TableDndKitAnswerGridRefactored from "./table-grid/TableDndKitAnswerGrid"

// 統一型定義
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/types/answer-sheet.types"

// ============================================================================
// Props定義 (互換性維持のためのラッパー)
// ============================================================================

interface TableDndKitAnswerGridProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  masterImageCount: number
  fileOrder?: PlacementStrategy
  isUploading?: boolean
  onFileOrderChange?: (order: PlacementStrategy) => void
  onFilesChange: (files: UnifiedFile[]) => void
  onUpload: (data: UploadData[]) => void
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  observerRef?: React.RefObject<IntersectionObserver | null>
  mode?: "upload" | "view" // アップロードモードか表示モードか
}

// ============================================================================
// 互換性維持のためのラッパーコンポーネント
// ============================================================================

export default function TableDndKitAnswerGrid(props: TableDndKitAnswerGridProps) {
  // 新しいリファクタリングされたコンポーネントにそのまま渡す
  return <TableDndKitAnswerGridRefactored {...props} />
}