import { useMemo } from "react"

import type {
  CellData,
  ExtendedDisabledState,
} from "@/components/projects/06-student-answers/student-answer-table/types"
import { getEnabledFiles } from "@/components/projects/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/components/projects/06-student-answers/types"

interface UseTableDataGenerationParams {
  files: UnifiedFile[]
  sortedStudents: UnifiedStudent[]
  modelAnswerCount: number
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  mode?: "upload" | "view"
  enhancedIsPositionDisabled: (
    studentIndex: number,
    pageIndex: number
  ) => boolean
  allowOverwrite?: boolean
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
}

/**
 * テーブルデータの生成を行うカスタムフック
 */
export function useTableDataGeneration({
  files,
  sortedStudents,
  modelAnswerCount,
  fileOrder,
  disabledState,
  mode,
  enhancedIsPositionDisabled,
  allowOverwrite = false,
  existingStudentAnswers = [],
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
        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
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

        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
          const position = studentIndex * modelAnswerCount + pageIndex
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
      // アップロードモード: 配置戦略に基づく自動配置（新規ファイル用）

      // 既存答案がある位置を特定（上書き無効時にスキップするため）
      const existingAnswerPositions = new Set<string>()
      if (!allowOverwrite && existingStudentAnswers) {
        existingStudentAnswers.forEach((answerSheet) => {
          if (answerSheet.studentId && answerSheet.pageNumber) {
            // 既存答案の学生IDとページ番号から位置を特定
            const studentIndex = sortedStudents.findIndex(
              (s) => s.id === answerSheet.studentId
            )
            const pageIndex = answerSheet.pageNumber - 1
            if (studentIndex >= 0 && pageIndex >= 0) {
              existingAnswerPositions.add(`${studentIndex}-${pageIndex}`)
            }
          }
        })
      }

      // 有効セル（無効でないセル）の位置を事前に計算
      const validPositions: Array<{ studentIndex: number; pageIndex: number }> =
        []
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
          const position = studentIndex * modelAnswerCount + pageIndex
          const positionKey = `${studentIndex}-${pageIndex}`

          const isManuallyDisabled =
            disabledState.rows.has(studentIndex) ||
            disabledState.cols.has(pageIndex) ||
            disabledState.positions.has(position)

          // 既存答案がある場合は上書き設定をチェック
          const hasExistingAnswer = existingAnswerPositions.has(positionKey)
          const shouldSkipExisting = hasExistingAnswer && !allowOverwrite

          if (!isManuallyDisabled && !shouldSkipExisting) {
            validPositions.push({ studentIndex, pageIndex })
          }
        }
      }

      // 既存答案がある位置を優先してソート（上書き有効時のみ）
      validPositions.sort((a, b) => {
        const aKey = `${a.studentIndex}-${a.pageIndex}`
        const bKey = `${b.studentIndex}-${b.pageIndex}`
        const aHasExisting = existingAnswerPositions.has(aKey)
        const bHasExisting = existingAnswerPositions.has(bKey)

        // 既存答案がある位置を優先（上書き有効時）
        if (allowOverwrite && aHasExisting && !bHasExisting) return -1
        if (allowOverwrite && !aHasExisting && bHasExisting) return 1

        // 同じ条件の場合は配置戦略に基づいてソート
        if (fileOrder === "page-first") {
          // ページ順: ページ番号を優先してソート
          if (a.pageIndex !== b.pageIndex) {
            return a.pageIndex - b.pageIndex
          }
          return a.studentIndex - b.studentIndex
        } else {
          // 生徒順: 生徒番号を優先してソート（デフォルト）
          if (a.studentIndex !== b.studentIndex) {
            return a.studentIndex - b.studentIndex
          }
          return a.pageIndex - b.pageIndex
        }
      })

      // ファイルと有効セルをマッピング（ファイル配列の順序で自動配置）
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

        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
          const position = studentIndex * modelAnswerCount + pageIndex
          const pageNumber = pageIndex + 1

          // 位置無効化チェック（手動無効化のみ）
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
            // 有効セル: ファイルがマッピングされていればファイルセル、なければ空セル
            const key = `${studentIndex}-${pageIndex}`
            const file = filePositionMap.get(key)

            // 既存答案がある場合の処理
            const hasExistingAnswer = existingAnswerPositions.has(key)
            const shouldShowAsDisabled = hasExistingAnswer && !allowOverwrite

            if (file) {
              // ファイルあり（自動配置されたファイル）
              row.push({
                type: "file",
                position,
                student,
                pageNumber,
                file: file,
              })
            } else if (shouldShowAsDisabled) {
              // 既存答案があり上書き無効の場合は無効セルとして表示
              row.push({
                type: "disabled",
                position,
                student,
                pageNumber,
                disabledReason: "existing_answer",
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
    modelAnswerCount,
    fileOrder,
    disabledState,
    mode,
    enhancedIsPositionDisabled,
    allowOverwrite,
    existingStudentAnswers,
  ])

  return { tableData }
}
