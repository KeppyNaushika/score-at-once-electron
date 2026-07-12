import { useMemo } from "react"

import type {
  CellData,
  ExtendedDisabledState,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import {
  getEnabledFiles,
  manualDisabledReason,
  partitionAnswerItemsByPlacement,
} from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  AnswerItem,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseTableDataGenerationParams<TItem extends AnswerItem> {
  files: TItem[]
  sortedStudents: ExamStudentWithMemberships[]
  modelAnswerCount: number
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  mode?: "upload" | "view"
  enhancedIsCellDisabled: (
    examStudent: ExamStudentWithMemberships,
    pageNumber: number
  ) => boolean
  allowOverwrite?: boolean
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
}

/**
 * テーブルデータの生成を行うカスタムフック。
 * view では、表のマスに配置できない答案（除籍・ページ範囲外＝孤立答案）を
 * `orphanItems` として返す（呼び出し側が専用枠で可視化・再配置できるようにする）。
 */
export function useTableDataGeneration<TItem extends AnswerItem>({
  files,
  sortedStudents,
  modelAnswerCount,
  fileOrder,
  disabledState,
  mode,
  enhancedIsCellDisabled,
  allowOverwrite = false,
  existingStudentAnswers = [],
}: UseTableDataGenerationParams<TItem>) {
  const { tableData, orphanItems } = useMemo(() => {
    const enabledFiles = getEnabledFiles(files, disabledState)

    const data: CellData<TItem>[][] = []
    const orphans: TItem[] = []

    if (mode === "view") {
      // 確認モード（方式B）: 各答案を自身の実セル座標 (studentId, pageNumber) に配置する。
      // 配列順ではなく座標基準にすることで、DnD の move/swap が座標更新だけで完結し、
      // 任意マスへの移動・占有マスとの入れ替えが素直に描画へ反映される。
      // 配置できない答案（除籍・ページ範囲外）は placeable にならず orphans に落ちる。
      const { placedByCell, orphans: orphanItems } =
        partitionAnswerItemsByPlacement(
          enabledFiles,
          sortedStudents.map((examStudent) => examStudent.studentId),
          modelAnswerCount
        )
      orphans.push(...orphanItems)

      // テーブルデータを生成
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        const examStudent = sortedStudents[studentIndex]
        const row: CellData<TItem>[] = []

        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
          const file = placedByCell.get(`${studentIndex}-${pageIndex}`)

          if (file) {
            // 答案が居るセルは常にファイルセル（動的無効化は答案なしセルにのみ効く）
            row.push({ type: "file", file })
          } else if (enhancedIsCellDisabled(examStudent, pageIndex + 1)) {
            // 答案なしセル。確認モードは表示上「答案なし」
            row.push({ type: "disabled" })
          } else {
            row.push({ type: "empty" })
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
              (examStudent) => examStudent.studentId === answerSheet.studentId
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
        const examStudent = sortedStudents[studentIndex]
        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
          const pageNumber = pageIndex + 1
          const placementKey = `${studentIndex}-${pageIndex}`

          const isManuallyDisabled =
            manualDisabledReason(disabledState, examStudent, pageNumber) !==
            undefined

          // 既存答案がある場合は上書き設定をチェック
          const hasExistingAnswer = existingAnswerPositions.has(placementKey)
          const shouldSkipExisting = hasExistingAnswer && !allowOverwrite

          if (!isManuallyDisabled && !shouldSkipExisting) {
            validPositions.push({ studentIndex, pageIndex })
          }
        }
      }

      // 既存答案がある位置を優先してソート（上書き有効時のみ）
      validPositions.sort((positionA, positionB) => {
        const positionAKey = `${positionA.studentIndex}-${positionA.pageIndex}`
        const positionBKey = `${positionB.studentIndex}-${positionB.pageIndex}`
        const positionAHasExisting = existingAnswerPositions.has(positionAKey)
        const positionBHasExisting = existingAnswerPositions.has(positionBKey)

        // 既存答案がある位置を優先（上書き有効時）
        if (allowOverwrite && positionAHasExisting && !positionBHasExisting)
          return -1
        if (allowOverwrite && !positionAHasExisting && positionBHasExisting)
          return 1

        // 同じ条件の場合は配置戦略に基づいてソート
        if (fileOrder === "page-first") {
          // ページ順: ページ番号を優先してソート
          if (positionA.pageIndex !== positionB.pageIndex) {
            return positionA.pageIndex - positionB.pageIndex
          }
          return positionA.studentIndex - positionB.studentIndex
        } else {
          // 生徒順: 生徒番号を優先してソート（デフォルト）
          if (positionA.studentIndex !== positionB.studentIndex) {
            return positionA.studentIndex - positionB.studentIndex
          }
          return positionA.pageIndex - positionB.pageIndex
        }
      })

      // ファイルと有効セルをマッピング（ファイル配列の順序で自動配置）
      const filePositionMap = new Map<string, TItem>()
      validPositions.forEach((position, fileIndex) => {
        const file = enabledFiles[fileIndex]
        if (file) {
          const key = `${position.studentIndex}-${position.pageIndex}`
          filePositionMap.set(key, file)
        }
      })

      // テーブルデータを生成
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        const examStudent = sortedStudents[studentIndex]
        const row: CellData<TItem>[] = []

        for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
          const pageNumber = pageIndex + 1

          // 手動無効化の判定と理由を1回の評価で確定（ちゃんとやる側）
          const manualReason = manualDisabledReason(
            disabledState,
            examStudent,
            pageNumber
          )

          if (manualReason) {
            // 手動無効化セル（無効理由も権威的にここで確定）
            row.push({ type: "disabled", disabledReason: manualReason })
          } else {
            // 有効セル: ファイルがマッピングされていればファイルセル、なければ空セル
            const key = `${studentIndex}-${pageIndex}`
            const file = filePositionMap.get(key)

            // 既存答案がある場合の処理
            const hasExistingAnswer = existingAnswerPositions.has(key)
            const shouldShowAsDisabled = hasExistingAnswer && !allowOverwrite

            if (file) {
              // ファイルあり（自動配置されたファイル）
              row.push({ type: "file", file })
            } else if (shouldShowAsDisabled) {
              // 既存答案があり上書き無効の場合は無効セルとして表示
              row.push({ type: "disabled", disabledReason: "existing_answer" })
            } else {
              // ファイルなし（空セル）
              row.push({ type: "empty" })
            }
          }
        }

        data.push(row)
      }
    }

    return { tableData: data, orphanItems: orphans }
  }, [
    files,
    sortedStudents,
    modelAnswerCount,
    fileOrder,
    disabledState,
    mode,
    enhancedIsCellDisabled,
    allowOverwrite,
    existingStudentAnswers,
  ])

  return { tableData, orphanItems }
}
