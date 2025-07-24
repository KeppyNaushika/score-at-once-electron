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
  mode?: "upload" | "view",
  allowOverwrite?: boolean,
  existingAnswerSheets?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>,
) {
  // 生徒のソート（customOrder準拠）
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
      return aOrder - bOrder
    })
  }, [students])

  // 動的無効化計算：答案がない位置を無効化（確認モードのみ）
  const calculateDynamicDisabledPositions = useCallback(() => {
    const dynamicDisabled = new Set<number>()

    // 確認モードでは答案がない位置のみ無効化
    if (mode === "view") {
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        const student = sortedStudents[studentIndex]

        for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
          const pageNumber = pageIndex + 1
          const position = studentIndex * masterImageCount + pageIndex

          // 手動無効化済みの位置はスキップ
          if (
            disabledState.rows.has(studentIndex) ||
            disabledState.cols.has(pageIndex) ||
            disabledState.positions.has(position)
          ) {
            continue
          }

          // その位置に対応する答案があるかチェック
          const hasAnswerForPosition = files.some(
            (file) =>
              file.studentId === student.id &&
              file.pageNumber === pageNumber &&
              !disabledState.files.has(file.id),
          )

          // 答案がない場合は動的無効化
          if (!hasAnswerForPosition) {
            dynamicDisabled.add(position)
          }
        }
      }
    }
    // アップロードモードでは動的無効化は行わない（警告オーバーレイのみ）

    return dynamicDisabled
  }, [files, sortedStudents, masterImageCount, disabledState, mode])

  // 動的無効化位置の計算
  const dynamicDisabledPositions = useMemo(
    () => calculateDynamicDisabledPositions(),
    [calculateDynamicDisabledPositions],
  )

  // 拡張されたisPositionDisabled関数
  const enhancedIsPositionDisabled = useCallback(
    (studentIndex: number, pageIndex: number) => {
      const position = studentIndex * masterImageCount + pageIndex

      // 元の無効化チェック
      if (isPositionDisabled(studentIndex, pageIndex)) return true

      // 動的無効化チェック
      return dynamicDisabledPositions.has(position)
    },
    [isPositionDisabled, masterImageCount, dynamicDisabledPositions],
  )

  // 既存答案がある位置の計算（警告オーバーレイ用）
  // sortedStudentsを使用してテーブル表示順序と一致させる
  const positionsWithExistingAnswers = useMemo(() => {
    const positions = new Set<number>()

    // sortedStudentsを使用してテーブル表示順序と一致させる
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      const student = sortedStudents[studentIndex]

      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        const pageNumber = pageIndex + 1
        const position = studentIndex * masterImageCount + pageIndex

        // その位置に対応する答案があるかチェック
        let hasAnswerForPosition = false

        if (mode === "upload" && existingAnswerSheets) {
          // アップロードモード: existingAnswerSheets から判定
          hasAnswerForPosition = existingAnswerSheets.some(
            (sheet) =>
              sheet.studentId === student.id && sheet.pageNumber === pageNumber,
          )
        } else {
          // 確認モード: files から判定
          hasAnswerForPosition = files.some(
            (file) =>
              file.studentId === student.id &&
              file.pageNumber === pageNumber &&
              !disabledState.files.has(file.id),
          )
        }

        if (hasAnswerForPosition) {
          positions.add(position)
        }
      }
    }

    return positions
  }, [
    files,
    sortedStudents,
    masterImageCount,
    disabledState.files,
    mode,
    existingAnswerSheets,
  ])

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

      // アップロードモード: 新規ファイルのみを配置戦略に基づいて配置
      const filePositionMap = new Map<string, UnifiedFile>()

      // アップロードモードでは新規ファイル（既存答案でない）のみを配置
      const newFiles = enabledFiles.filter(
        (file) => !file.studentId || !file.pageNumber,
      )

      // 新規ファイルがある場合のみ配置処理を行う
      if (newFiles.length > 0) {
        // 有効な位置を配置戦略に基づいて取得
        const availablePositions = []
        for (let si = 0; si < sortedStudents.length; si++) {
          for (let pi = 0; pi < masterImageCount; pi++) {
            if (!enhancedIsPositionDisabled(si, pi)) {
              availablePositions.push({ studentIndex: si, pageIndex: pi })
            }
          }
        }

        // 配置戦略に基づいてソート
        if (fileOrder === "page-first") {
          availablePositions.sort((a, b) => {
            if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
            return a.studentIndex - b.studentIndex
          })
        } else {
          availablePositions.sort((a, b) => {
            if (a.studentIndex !== b.studentIndex)
              return a.studentIndex - b.studentIndex
            return a.pageIndex - b.pageIndex
          })
        }

        // 新規ファイルを順次配置
        let newFileIndex = 0
        for (const pos of availablePositions) {
          const posKey = `${pos.studentIndex}-${pos.pageIndex}`
          if (newFileIndex < newFiles.length) {
            filePositionMap.set(posKey, newFiles[newFileIndex])
            newFileIndex++
          }
        }
      }

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
          const isManuallyDisabled = enhancedIsPositionDisabled(
            studentIndex,
            pageIndex,
          )

          // 上書き無効時の既存答案チェック
          const hasExistingAnswer =
            mode === "upload" &&
            !allowOverwrite &&
            positionsWithExistingAnswers.has(position)

          // 総合的な無効化判定（手動無効化 OR 上書き無効時の既存答案）
          const isDisabled = isManuallyDisabled || hasExistingAnswer

          if (isDisabled) {
            // 無効セル（手動無効化、上書き無効時の既存答案等）
            row.push({
              type: "disabled",
              position,
              student,
              pageNumber: pageIndex + 1,
            })
          } else {
            // 有効セル: 新規ファイルまたは空セル
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
              // 空セル（ファイルドロップ可能、右クリックメニュー表示）
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
    mode,
    allowOverwrite,
    positionsWithExistingAnswers,
  ])

  return {
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
    positionsWithExistingAnswers,
  }
}
