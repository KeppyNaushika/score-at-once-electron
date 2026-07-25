import { useMemo } from "react"

import type {
  AnswerTableCell,
  AnswerTableRow,
  ExtendedDisabledState,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  CellLookup,
  CellValueMap,
} from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import {
  addCellToLookup,
  getCellValue,
  getEnabledFiles,
  lookupHasCell,
  manualDisabledReason,
  partitionAnswerItemsByPlacement,
  setCellValue,
} from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  AnswerImageIdentity,
  ExamPageColumn,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseTableDataGenerationParams<TItem extends AnswerImageIdentity> {
  files: TItem[]
  sortedStudents: ExamStudentWithMemberships[]
  examPages: ExamPageColumn[]
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  mode?: "upload" | "view"
  enhancedIsCellDisabled: (
    examStudent: ExamStudentWithMemberships,
    examPageId: string
  ) => boolean
  allowOverwrite?: boolean
  existingAnswers?: AnswerImageIdentity[]
}

/**
 * テーブル行の生成を行うカスタムフック（entity-first）。
 * 行は ExamStudent 実体、列は ExamPage 実体で回し、各マスに列の実体を同梱して返す。
 * 生徒・ページの同定は常に id（studentId / examPageId）で行い、配列の添字は
 * upload の配置順を決めるソートキーとしてのみ使う（同定には使わない）。
 * view では、表のマスに配置できない答案（除籍・列に無い examPageId＝孤立答案）を
 * `orphanItems` として返す（呼び出し側が専用枠で再配置できる）。
 */
export function useTableDataGeneration<TItem extends AnswerImageIdentity>({
  files,
  sortedStudents,
  examPages,
  fileOrder,
  disabledState,
  mode,
  enhancedIsCellDisabled,
  allowOverwrite = false,
  existingAnswers = [],
}: UseTableDataGenerationParams<TItem>) {
  const { tableRows, orphanItems } = useMemo(() => {
    const enabledFiles = getEnabledFiles(files, disabledState)

    const rows: AnswerTableRow<TItem>[] = []
    const orphans: TItem[] = []

    if (mode === "view") {
      // 確認モード（方式B）: 各答案を自身の実セル座標 (studentId, examPageId) に配置する。
      // 配列順ではなく id 対を基準にすることで、DnD の move/swap が座標更新だけで完結し、
      // 任意マスへの移動・占有マスとの入れ替えが素直に描画へ反映される。
      // 配置できない答案（除籍・列に無い examPageId）は placeable にならず orphans に落ちる。
      const { placedByCell, orphans: orphanItems } =
        partitionAnswerItemsByPlacement(
          enabledFiles,
          sortedStudents.map((examStudent) => examStudent.studentId),
          examPages.map((examPage) => examPage.id)
        )
      orphans.push(...orphanItems)

      for (const examStudent of sortedStudents) {
        const cells = examPages.map<AnswerTableCell<TItem>>((examPage) => {
          const file = getCellValue(
            placedByCell,
            examStudent.studentId,
            examPage.id
          )

          // 答案が居るセルは常にファイルセル（動的無効化は答案なしセルにのみ効く）
          if (file) return { examPage, type: "file", file }

          // 答案なしセル。確認モードは表示上「答案なし」
          if (enhancedIsCellDisabled(examStudent, examPage.id)) {
            return { examPage, type: "disabled" }
          }

          return { examPage, type: "empty" }
        })

        rows.push({ examStudent, cells })
      }
    } else {
      // アップロードモード: 配置戦略に基づく自動配置（新規ファイル用）

      // 既存答案（DB答案の占有信号）があるセルを id 対で引けるようにする。
      // 上書き有効時は収集しない（＝上書き可なら占有を無視して素直に詰める既存動作）。
      const existingAnswerCells: CellLookup = new Map()
      if (!allowOverwrite) {
        for (const answer of existingAnswers) {
          if (!answer.studentId || !answer.examPageId) continue
          addCellToLookup(
            existingAnswerCells,
            answer.studentId,
            answer.examPageId
          )
        }
      }

      // 有効セル（無効でないセル）を実体で列挙する。studentIndex / pageIndex は
      // 「どの順にファイルを詰めるか」の並べ替えキー専用で、セルの同定には使わない。
      const validPositions: Array<{
        examStudent: ExamStudentWithMemberships
        examPage: ExamPageColumn
        studentIndex: number
        pageIndex: number
      }> = []
      sortedStudents.forEach((examStudent, studentIndex) => {
        examPages.forEach((examPage, pageIndex) => {
          const isManuallyDisabled =
            manualDisabledReason(disabledState, examStudent, examPage.id) !==
            undefined

          // 既存答案がある場合は上書き設定をチェック
          const hasExistingAnswer = lookupHasCell(
            existingAnswerCells,
            examStudent.studentId,
            examPage.id
          )
          const shouldSkipExisting = hasExistingAnswer && !allowOverwrite

          if (!isManuallyDisabled && !shouldSkipExisting) {
            validPositions.push({
              examStudent,
              examPage,
              studentIndex,
              pageIndex,
            })
          }
        })
      })

      // 既存答案がある位置を優先してソート（上書き有効時のみ）
      validPositions.sort((positionA, positionB) => {
        const positionAHasExisting = lookupHasCell(
          existingAnswerCells,
          positionA.examStudent.studentId,
          positionA.examPage.id
        )
        const positionBHasExisting = lookupHasCell(
          existingAnswerCells,
          positionB.examStudent.studentId,
          positionB.examPage.id
        )

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
      const filePlacement: CellValueMap<TItem> = new Map()
      validPositions.forEach((position, fileIndex) => {
        const file = enabledFiles[fileIndex]
        if (file) {
          setCellValue(
            filePlacement,
            position.examStudent.studentId,
            position.examPage.id,
            file
          )
        }
      })

      for (const examStudent of sortedStudents) {
        const cells = examPages.map<AnswerTableCell<TItem>>((examPage) => {
          // 手動無効化の判定と理由を1回の評価で確定（ちゃんとやる側）
          const manualReason = manualDisabledReason(
            disabledState,
            examStudent,
            examPage.id
          )
          if (manualReason) {
            // 手動無効化セル（無効理由も権威的にここで確定）
            return { examPage, type: "disabled", disabledReason: manualReason }
          }

          // 有効セル: ファイルがマッピングされていればファイルセル、なければ空セル
          const file = getCellValue(
            filePlacement,
            examStudent.studentId,
            examPage.id
          )
          if (file) return { examPage, type: "file", file }

          // 既存答案があり上書き無効の場合は無効セルとして表示
          const hasExistingAnswer = lookupHasCell(
            existingAnswerCells,
            examStudent.studentId,
            examPage.id
          )
          if (hasExistingAnswer && !allowOverwrite) {
            return {
              examPage,
              type: "disabled",
              disabledReason: "existing_answer",
            }
          }

          return { examPage, type: "empty" }
        })

        rows.push({ examStudent, cells })
      }
    }

    return { tableRows: rows, orphanItems: orphans }
  }, [
    files,
    sortedStudents,
    examPages,
    fileOrder,
    disabledState,
    mode,
    enhancedIsCellDisabled,
    allowOverwrite,
    existingAnswers,
  ])

  return { tableRows, orphanItems }
}
