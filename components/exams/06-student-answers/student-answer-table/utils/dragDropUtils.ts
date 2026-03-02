import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/components/exams/06-student-answers/types"

/**
 * 3つ組からDnD配列を構築する関数（戦略ベース順序）
 */
export function buildDnDArrayFromFileStates(
  fileStates: FileState[],
  strategy: PlacementStrategy,
  students: UnifiedStudent[],
  masterImageCount: number,
  files: UnifiedFile[]
): UnifiedFile[] {
  if (!students || !masterImageCount || fileStates.length === 0) return []

  // 生徒のソート（受験生徒順：customOrder準拠）
  const sortedStudents = [...students].sort((a, b) => {
    const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })

  // 配置戦略に基づいて論理位置の順序を決定（Math.floor不使用）
  const orderedPositions: Array<{
    studentId: string | null
    pageNumber: number
  }> = []

  if (strategy === "student-first") {
    // 生徒順: s1p1, s1p2, s2p1, s2p2, ...
    sortedStudents.forEach((student) => {
      for (let pageNum = 1; pageNum <= masterImageCount; pageNum++) {
        orderedPositions.push({
          studentId: student.id,
          pageNumber: pageNum,
        })
      }
    })
  } else {
    // ページ順: s1p1, s2p1, s3p1, ..., s1p2, s2p2, s3p2, ...
    for (let pageNum = 1; pageNum <= masterImageCount; pageNum++) {
      sortedStudents.forEach((student) => {
        orderedPositions.push({
          studentId: student.id,
          pageNumber: pageNum,
        })
      })
    }
  }

  // 論理位置の順序に基づいてファイルを配置
  const orderedFiles: UnifiedFile[] = []

  orderedPositions.forEach((position) => {
    // 3つ組から対応するファイルを検索
    const matchingFileState = fileStates.find(
      (state) =>
        state.studentId === position.studentId &&
        state.pageNumber === position.pageNumber
    )

    if (matchingFileState) {
      // 元のfiles配列から実際のUnifiedFileオブジェクトを取得
      const actualFile = files.find(
        (file) => file.id === matchingFileState.fileId
      )
      if (actualFile) {
        orderedFiles.push(actualFile)
      }
    }
  })

  return orderedFiles
}

/**
 * DnD配列から3つ組を更新する関数（ファイル実データを直接使用）
 */
export function updateFileStatesFromDnDArray(
  dndArray: UnifiedFile[]
): FileState[] {
  // ファイルの実データをそのまま使用（推測ではない）
  return dndArray.map((file) => ({
    fileId: file.id,
    studentId: file.studentId || null, // ファイルの実データ
    pageNumber: file.pageNumber, // ファイルの実データ
  }))
}

/**
 * ファイル状態を比較して変更されたファイルを検知する関数
 */
export function compareFileStates(
  initialStates: FileState[],
  currentStates: FileState[]
) {
  const changedFiles: Array<{
    fileId: string
    fromState: FileState
    toState: FileState
  }> = []

  // 各ファイルについて、初期状態と現在状態を比較
  currentStates.forEach((currentState) => {
    const initialState = initialStates.find(
      (state) => state.fileId === currentState.fileId
    )

    if (initialState) {
      // studentId または pageNumber が変わった場合
      if (
        initialState.studentId !== currentState.studentId ||
        initialState.pageNumber !== currentState.pageNumber
      ) {
        changedFiles.push({
          fileId: currentState.fileId,
          fromState: initialState,
          toState: currentState,
        })
      }
    }
  })

  return changedFiles
}
