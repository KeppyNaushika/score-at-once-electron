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
  // 既存答案（DB答案の占有信号）があるマス。呼び出し側が導出済みのものを受け取り、
  // ここで組み直さない（オーバーレイ表示と配置判断で同じ集合を使うため）。
  cellsWithExistingAnswers: CellLookup
}

/**
 * テーブル行の生成を行うカスタムフック（entity-first）。
 * 行は ExamStudent 実体、列は ExamPage 実体で回し、各マスに列の実体を同梱して返す。
 * 生徒・ページの同定は常に id（studentId / examPageId）で行い、序数は一切使わない
 * （upload の配置順もループの入れ子の向きで表現する）。
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
  cellsWithExistingAnswers,
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

      // 上書き無効のときだけ、既存答案（DB答案の占有信号）のあるマスを避けて詰める。
      const skipsExistingAnswers = !allowOverwrite

      // 有効セル（無効でないセル）を詰める順に列挙する。順序は入れ子の向きで表現し、
      // page-first は列を外側、student-first は行を外側に回す（序数の比較子を持たない）。
      const validPositions: Array<{
        examStudent: ExamStudentWithMemberships
        examPage: ExamPageColumn
      }> = []
      const collectPosition = (
        examStudent: ExamStudentWithMemberships,
        examPage: ExamPageColumn
      ) => {
        const isManuallyDisabled =
          manualDisabledReason(disabledState, examStudent, examPage.id) !==
          undefined
        const shouldSkipExisting =
          skipsExistingAnswers &&
          lookupHasCell(
            cellsWithExistingAnswers,
            examStudent.studentId,
            examPage.id
          )

        if (!isManuallyDisabled && !shouldSkipExisting) {
          validPositions.push({ examStudent, examPage })
        }
      }
      if (fileOrder === "page-first") {
        // ページ順: 同一ページを生徒順に埋めてから次のページへ
        for (const examPage of examPages) {
          for (const examStudent of sortedStudents) {
            collectPosition(examStudent, examPage)
          }
        }
      } else {
        // 生徒順（デフォルト）: 同一生徒のページを埋めてから次の生徒へ
        for (const examStudent of sortedStudents) {
          for (const examPage of examPages) {
            collectPosition(examStudent, examPage)
          }
        }
      }

      // ファイルと有効セルをマッピング（ファイル配列の順序で自動配置）。
      // 有効セルより多いファイルは配置されない（＝アップロード対象にならない）。
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
          if (
            skipsExistingAnswers &&
            lookupHasCell(
              cellsWithExistingAnswers,
              examStudent.studentId,
              examPage.id
            )
          ) {
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
    cellsWithExistingAnswers,
  ])

  return { tableRows, orphanItems }
}
