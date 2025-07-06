import type {
  CellData,
  ExtendedDisabledState,
} from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"
import { useCallback, useMemo } from "react"

export function useTableData(
  files: UnifiedFile[],
  students: UnifiedStudent[],
  masterImageCount: number,
  fileOrder: PlacementStrategy,
  disabledState: ExtendedDisabledState,
  isPositionDisabled: (studentIndex: number, pageIndex: number) => boolean,
) {
  // 生徒のソート（customOrder準拠）
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
      return aOrder - bOrder
    })
  }, [students])

  // 有効/無効ファイルの取得
  const getEnabledFiles = useCallback(() => {
    return files.filter((file) => !disabledState.files.has(file.id))
  }, [files, disabledState.files])

  const getDisabledFiles = useCallback(() => {
    return files.filter((file) => disabledState.files.has(file.id))
  }, [files, disabledState.files])

  // ファイルカラーの取得
  const getFileColor = useCallback((file: UnifiedFile) => {
    const colors = [
      "bg-red-200",
      "bg-blue-200",
      "bg-green-200",
      "bg-yellow-200",
      "bg-purple-200",
      "bg-pink-200",
      "bg-indigo-200",
      "bg-teal-200",
    ]
    const hash = file.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }, [])

  // テーブルデータの生成
  const tableData = useMemo(() => {
    const enabledFiles = getEnabledFiles()
    const data: CellData[][] = []

    // 各生徒の行を生成
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      const student = sortedStudents[studentIndex]
      const row: CellData[] = []

      // 各ページの列を生成
      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        const position = studentIndex * masterImageCount + pageIndex
        const isDisabled = isPositionDisabled(studentIndex, pageIndex)

        if (isDisabled) {
          row.push({
            type: "disabled",
            position,
            student,
            pageNumber: pageIndex + 1,
          })
        } else {
          // 配置戦略に基づいてファイルを取得
          let fileIndex: number
          if (fileOrder === "page-first") {
            fileIndex = pageIndex * sortedStudents.length + studentIndex
          } else {
            fileIndex = studentIndex * masterImageCount + pageIndex
          }

          const file = enabledFiles[fileIndex]
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

    return data
  }, [
    sortedStudents,
    masterImageCount,
    fileOrder,
    getEnabledFiles,
    isPositionDisabled,
  ])

  return {
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
  }
}
