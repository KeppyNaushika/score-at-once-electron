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
  // 動的無効化計算：ファイル数不足による無効位置
  const calculateDynamicDisabledPositions = useCallback(() => {
    const dynamicDisabled = new Set<number>()
    
    // 有効ファイル数を取得
    const enabledFiles = files.filter((file) => !disabledState.files.has(file.id))
    const enabledFileCount = enabledFiles.length
    
    // 有効セル位置を配置戦略に基づいて計算
    const validPositions: Array<{ studentIndex: number; pageIndex: number }> = []
    for (let studentIndex = 0; studentIndex < students.length; studentIndex++) {
      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        const position = studentIndex * masterImageCount + pageIndex
        if (!disabledState.rows.has(studentIndex) && 
            !disabledState.cols.has(pageIndex) && 
            !disabledState.positions.has(position)) {
          validPositions.push({ studentIndex, pageIndex })
        }
      }
    }
    
    // 配置戦略に基づいてソート
    if (fileOrder === "page-first") {
      validPositions.sort((a, b) => {
        if (a.pageIndex !== b.pageIndex) {
          return a.pageIndex - b.pageIndex
        }
        return a.studentIndex - b.studentIndex
      })
    } else {
      validPositions.sort((a, b) => {
        if (a.studentIndex !== b.studentIndex) {
          return a.studentIndex - b.studentIndex
        }
        return a.pageIndex - b.pageIndex
      })
    }
    
    // ファイル数を超える位置を動的無効化
    for (let i = enabledFileCount; i < validPositions.length; i++) {
      const pos = validPositions[i]
      const position = pos.studentIndex * masterImageCount + pos.pageIndex
      dynamicDisabled.add(position)
    }
    
    return dynamicDisabled
  }, [files, students, masterImageCount, fileOrder, disabledState])
  
  // 動的無効化位置の計算
  const dynamicDisabledPositions = useMemo(() => 
    calculateDynamicDisabledPositions(), 
    [calculateDynamicDisabledPositions]
  )
  
  // 拡張されたisPositionDisabled関数
  const enhancedIsPositionDisabled = useCallback((studentIndex: number, pageIndex: number) => {
    const position = studentIndex * masterImageCount + pageIndex
    
    // 元の無効化チェック
    if (isPositionDisabled(studentIndex, pageIndex)) return true
    
    // 動的無効化チェック
    return dynamicDisabledPositions.has(position)
  }, [isPositionDisabled, masterImageCount, dynamicDisabledPositions])
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
    } else {
      // アップロードモード: 配置戦略に基づいて順次配置（スキップ対応、動的無効化対応）

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
          const isDisabled = enhancedIsPositionDisabled(studentIndex, pageIndex)

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
    enhancedIsPositionDisabled,
  ])

  return {
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
  }
}
