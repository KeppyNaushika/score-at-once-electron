import type {
  CellData,
  ExtendedDisabledState,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import { getEnabledFiles } from "@/components/projects/06-answer-sheets/answer-sheet-table/utils/table-data-utils"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"
import { useMemo } from "react"

interface UseTableDataGenerationParams {
  files: UnifiedFile[]
  sortedStudents: UnifiedStudent[]
  masterImageCount: number
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  mode?: "upload" | "view"
  enhancedIsPositionDisabled: (studentIndex: number, pageIndex: number) => boolean
}

/**
 * テーブルデータの生成を行うカスタムフック
 */
export function useTableDataGeneration({
  files,
  sortedStudents,
  masterImageCount,
  fileOrder,
  disabledState,
  mode,
  enhancedIsPositionDisabled,
}: UseTableDataGenerationParams) {
  const tableData = useMemo(() => {
    const enabledFiles = getEnabledFiles(files, disabledState)
    const data: CellData[][] = []

    if (mode === "view") {
      // 確認モード: ファイル配列の順序に基づく配置戦略適用（動的無効化対応）

      // 有効セル（無効でないセル）の位置を事前に計算（動的無効化考慮）
      const validPositions: Array<{ studentIndex: number; pageIndex: number }> =
        []
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
          if (!enhancedIsPositionDisabled(studentIndex, pageIndex)) {
            validPositions.push({ studentIndex, pageIndex })
          }
        }
      }

      // 配置戦略に基づいて有効セルをソート
      if (fileOrder === "page-first") {
        // ページ順: ページ番号を優先してソート
        validPositions.sort((a, b) => {
          if (a.pageIndex !== b.pageIndex) {
            return a.pageIndex - b.pageIndex
          }
          return a.studentIndex - b.studentIndex
        })
      } else {
        // 生徒順: 生徒番号を優先してソート（デフォルトで既にこの順序）
        validPositions.sort((a, b) => {
          if (a.studentIndex !== b.studentIndex) {
            return a.studentIndex - b.studentIndex
          }
          return a.pageIndex - b.pageIndex
        })
      }

      // ファイルと有効セルをマッピング（ファイル配列の順序で）
      const filePositionMap = new Map<string, UnifiedFile>()
      validPositions.forEach((pos, fileIndex) => {
        const file = enabledFiles[fileIndex]
        if (file) {
          const key = `${pos.studentIndex}-${pos.pageIndex}`
          filePositionMap.set(key, file)
        }
      })

      // テーブルデータを生成
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        const student = sortedStudents[studentIndex]
        const row: CellData[] = []

        for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
          const position = studentIndex * masterImageCount + pageIndex
          const isDisabled = enhancedIsPositionDisabled(studentIndex, pageIndex)

          if (isDisabled) {
            // 無効セル（手動無効化 + 動的無効化）
            row.push({
              type: "disabled",
              position,
              student,
              pageNumber: pageIndex + 1,
            })
          } else {
            // 有効セル: ファイルがマッピングされていればファイルセル、なければ空セル
            const key = `${studentIndex}-${pageIndex}`
            const file = filePositionMap.get(key)

            if (file) {
              row.push({
                type: "file",
                position,
                student,
                pageNumber: pageIndex + 1,
                file,
              })
            } else {
              row.push({
                type: "empty",
                position,
                student,
                pageNumber: pageIndex + 1,
              })
            }
          }
        }

        data.push(row)
      }
    } else {
      // アップロードモード: 各ファイルの実際のstudentId・pageNumberに基づく配置
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        const student = sortedStudents[studentIndex]
        const row: CellData[] = []

        for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
          const position = studentIndex * masterImageCount + pageIndex
          const pageNumber = pageIndex + 1

          // 位置無効化チェック（手動無効化のみ、動的無効化は含まない）
          const isManuallyDisabled =
            disabledState.rows.has(studentIndex) ||
            disabledState.cols.has(pageIndex) ||
            disabledState.positions.has(position)

          if (isManuallyDisabled) {
            // 手動無効化セル
            row.push({
              type: "disabled",
              position,
              student,
              pageNumber,
            })
          } else {
            // その位置に対応するファイルがあるかチェック
            const fileForPosition = enabledFiles.find(
              (file) =>
                file.studentId === student.id && file.pageNumber === pageNumber,
            )

            if (fileForPosition) {
              // ファイルあり
              row.push({
                type: "file",
                position,
                student,
                pageNumber,
                file: fileForPosition,
              })
            } else {
              // ファイルなし（空セル）
              row.push({
                type: "empty",
                position,
                student,
                pageNumber,
              })
            }
          }
        }

        data.push(row)
      }
    }

    return data
  }, [
    files,
    sortedStudents,
    masterImageCount,
    fileOrder,
    disabledState,
    mode,
    enhancedIsPositionDisabled,
  ])

  return { tableData }
}