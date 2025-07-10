import type {
  CellData,
  ExtendedDisabledState,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
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

    // 確認モードか判定（既存答案データかどうか）
    const isViewMode =
      enabledFiles.length > 0 && enabledFiles.some((file) => file.imagePath)

    if (isViewMode) {
      // 確認モード: 実際の生徒IDとページ番号に基づいて配置
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
            // 実際の生徒IDとページ番号に一致するファイルを検索
            const file = enabledFiles.find(
              (f) =>
                f.studentId === student.id && f.pageNumber === pageIndex + 1,
            )

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
      // アップロードモード: 配置戦略に基づいて順次配置（スキップ対応）

      // 有効セル（無効でないセル）の位置を事前に計算
      const validPositions: Array<{ studentIndex: number; pageIndex: number }> =
        []
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
          if (!isPositionDisabled(studentIndex, pageIndex)) {
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

      // ファイルと有効セルをマッピング
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
          const isDisabled = isPositionDisabled(studentIndex, pageIndex)

          if (isDisabled) {
            // 無効セル（欠席者等）
            row.push({
              type: "disabled",
              position,
              student,
              pageNumber: pageIndex + 1,
            })
          } else {
            // 有効セル: マッピングからファイルを取得
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
