import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"

/**
 * 現在のファイル配列を新しい配置戦略に基づいて再配置する
 */
export function reorderFilesByStrategy(
  currentFiles: UnifiedFile[],
  students: UnifiedStudent[],
  masterImageCount: number,
  newFileOrder: PlacementStrategy,
): UnifiedFile[] {
  // 1. 実際のファイル（空でないもの）を抽出
  const actualFiles = currentFiles.filter((file) => file && file.id)

  if (actualFiles.length === 0) {
    return []
  }

  // 2. 生徒のソート（customOrder準拠）
  const sortedStudents = [...students].sort((a, b) => {
    const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })

  // 3. 新しい配置戦略に基づく理想的な位置順序を計算
  const newIdealPositions: Array<{ studentIndex: number; pageIndex: number }> =
    []

  if (newFileOrder === "page-first") {
    // ページ順: ページごとに全生徒
    for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        newIdealPositions.push({ studentIndex, pageIndex })
      }
    }
  } else {
    // 生徒順: 生徒ごとに全ページ
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        newIdealPositions.push({ studentIndex, pageIndex })
      }
    }
  }

  // 4. 新しい順序に基づいてファイル配列を再構築
  const reorderedFiles: UnifiedFile[] = []

  newIdealPositions.forEach((pos) => {
    const targetStudent = sortedStudents[pos.studentIndex]
    const targetPageNumber = pos.pageIndex + 1

    // 現在のファイル配列から対応するファイルを検索
    const matchingFile = actualFiles.find(
      (file) =>
        file.studentId === targetStudent.id &&
        file.pageNumber === targetPageNumber,
    )

    if (matchingFile) {
      reorderedFiles.push(matchingFile)
    }
    // ファイルが見つからない場合は配列に追加しない（動的無効化で処理）
  })

  return reorderedFiles
}

/**
 * 既存の答案データから配置戦略に基づく統一ファイル配列を構築
 */
export function buildOrderedFileArrayFromAnswerSheets(
  answerSheets: any[],
  students: UnifiedStudent[],
  masterImageCount: number,
  fileOrder: PlacementStrategy,
): UnifiedFile[] {
  // 基本的なファイル変換を取得
  const { convertAnswerSheetsToFiles } = require("./convertAnswerSheetsToFiles")
  const basicFiles: UnifiedFile[] = convertAnswerSheetsToFiles(answerSheets)

  // 生徒のソート（受験生徒順：customOrder準拠）
  const sortedStudents = [...students].sort((a, b) => {
    const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })

  // 配置戦略に基づく理想的な位置順序を計算
  const idealPositions: Array<{ studentIndex: number; pageIndex: number }> = []

  if (fileOrder === "page-first") {
    // ページ順: ページごとに全生徒
    for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        idealPositions.push({ studentIndex, pageIndex })
      }
    }
  } else {
    // 生徒順: 生徒ごとに全ページ
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        idealPositions.push({ studentIndex, pageIndex })
      }
    }
  }

  // 理想的な位置順序に基づいてファイル配列を構築
  const orderedFiles: UnifiedFile[] = []

  idealPositions.forEach((pos) => {
    const targetStudent = sortedStudents[pos.studentIndex]
    const targetPageNumber = pos.pageIndex + 1

    // 対応するファイルをDBデータから検索
    const matchingFile = basicFiles.find(
      (file) =>
        file.studentId === targetStudent.id &&
        file.pageNumber === targetPageNumber,
    )

    if (matchingFile) {
      orderedFiles.push(matchingFile)
    }
    // ファイルが見つからない場合は配列に追加しない（動的無効化で処理）
  })

  return orderedFiles
}
