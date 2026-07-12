import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type {
  CellData,
  ExtendedDisabledState,
  PreviewMode,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type { CellLookup } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import { lookupHasCell } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type { AnswerItem } from "@/components/exams/06-student-answers/types"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader as UITableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// ============================================================================
// セルの DnD ラッパーはスロット（render prop）で外から注入する。
// 表本体（TableContent）は @dnd-kit も sortable/droppable セルも import せず、
// グリッドのレイアウトとセル中身の描画（プレビュー・空・無効理由）だけを担う。
// upload は sortable セル、view は droppable セルをそれぞれ注入する。
// ============================================================================

/** ファイルセル（答案あり）のラッパーへ渡す情報。children は FilePreviewCell。
 * 生徒は Prisma 構造（ExamStudentWithMemberships）のまま渡す（studentId/氏名を手で
 * バラした scalar にしない＝EmptyCellSlotProps と同じ流儀）。 */
export interface FileCellSlotProps {
  fileId: string
  examStudent: ExamStudentWithMemberships
  pageNumber: number
  isDragDisabled: boolean
  isFileDisabled: boolean
  onTogglePosition: () => void
  onToggleFileDisabled: () => void
  onDelete: () => void
  children: React.ReactNode
}

/** 空セル・無効セルのラッパーへ渡す情報（中身の描画もラッパー側が行う）。 */
export interface EmptyCellSlotProps {
  examStudent: ExamStudentWithMemberships
  pageNumber: number
  isPositionDisabled: boolean
  hasExistingAnswer: boolean
  disabledReason?: DisabledReason
  hasNewFileToUpload: boolean
  onTogglePosition: () => void
  onToggleAnswerDisabled: () => void
}

interface TableContentProps {
  tableData: CellData<AnswerItem>[][]
  sortedStudents: ExamStudentWithMemberships[]
  maxPages: number
  disabledState: ExtendedDisabledState
  mode: "upload" | "view"
  previewMode: PreviewMode
  nameRegionAvailable: Record<number, boolean>
  cellsWithExistingAnswers: CellLookup
  allowOverwrite: boolean
  files: AnswerItem[]
  affectedCells?: Set<string>
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  correctingFileIds?: Set<string>
  getFileColor: (file: AnswerItem) => string
  drawNameRegionCanvas: (
    file: AnswerItem,
    pageNumber: number
  ) => Promise<string | null>
  toggleRowDisabled: (examStudentId: string) => void
  toggleColDisabled: (pageNumber: number) => void
  toggleCellDisabled: (studentId: string, pageNumber: number) => void
  toggleFileDisabled: (fileId: string) => void
  onDeleteAnswerSheet?: (fileId: string) => void
  // DnD ラッパー（モード別に注入）
  renderFileCell: (props: FileCellSlotProps) => React.ReactNode
  renderEmptyCell: (props: EmptyCellSlotProps) => React.ReactNode
}

export function TableContent({
  tableData,
  sortedStudents,
  maxPages,
  disabledState,
  mode,
  previewMode,
  nameRegionAvailable,
  cellsWithExistingAnswers,
  allowOverwrite,
  files,
  affectedCells,
  imageLoadStates = {},
  correctingFileIds,
  getFileColor,
  drawNameRegionCanvas,
  toggleRowDisabled,
  toggleColDisabled,
  toggleCellDisabled,
  toggleFileDisabled,
  onDeleteAnswerSheet,
  renderFileCell,
  renderEmptyCell,
}: TableContentProps) {
  return (
    <Table>
      <UITableHeader>
        <TableRow>
          {/* 生徒名列ヘッダー */}
          <TableHead className="w-32 border text-center">生徒名</TableHead>
          {/* ページ列ヘッダー */}
          {Array.from({ length: maxPages }, (_, pageIndex) => {
            const pageNumber = pageIndex + 1
            return (
              <TableHead
                key={pageNumber}
                className={`w-32 border text-center ${
                  mode === "upload" ? "cursor-pointer" : ""
                } ${
                  disabledState.cols.includes(pageNumber)
                    ? "bg-gray-200"
                    : "bg-white"
                }`}
                onClick={
                  mode === "upload"
                    ? () => toggleColDisabled(pageNumber)
                    : undefined
                }
              >
                ページ {pageNumber}
              </TableHead>
            )
          })}
        </TableRow>
      </UITableHeader>
      <TableBody>
        {tableData.map((row, studentIndex) => (
          <TableRow key={sortedStudents[studentIndex].studentId}>
            {/* 生徒名セル */}
            <TableHead
              className={`border text-center ${
                mode === "upload" ? "cursor-pointer" : ""
              } ${
                disabledState.rows.includes(sortedStudents[studentIndex].id)
                  ? "bg-gray-200"
                  : "bg-white"
              }`}
              onClick={
                mode === "upload"
                  ? () => toggleRowDisabled(sortedStudents[studentIndex].id)
                  : undefined
              }
            >
              <div className="px-2 py-1">
                <div className="text-sm font-medium">
                  {sortedStudents[studentIndex].student.lastName}{" "}
                  {sortedStudents[studentIndex].student.firstName}
                </div>
                <div className="text-xs text-gray-500">
                  {sortedStudents[studentIndex].student.studentNumber}
                </div>
              </div>
            </TableHead>

            {/* ファイルセル */}
            {row.map((cellData, pageIndex) => {
              // セル座標から生徒・ページを投射（セルは同一性を保持しない）
              const examStudent = sortedStudents[studentIndex]
              const pageNumber = pageIndex + 1

              if (cellData.type === "disabled" || cellData.type === "empty") {
                // 既存答案があるか（オーバーレイ用・upload のみ）
                const hasExistingAnswerForEmpty =
                  mode === "upload" &&
                  lookupHasCell(
                    cellsWithExistingAnswers,
                    examStudent.studentId,
                    pageNumber
                  )

                // そのセルに新しく追加しようとしている画像ファイルがあるか
                const newFileInCell = files.find(
                  (file) =>
                    file.studentId === examStudent.studentId &&
                    file.pageNumber === pageNumber &&
                    !disabledState.files.has(file.id)
                )

                return (
                  <ClientCell key={pageNumber}>
                    {renderEmptyCell({
                      examStudent,
                      pageNumber,
                      isPositionDisabled: cellData.type === "disabled",
                      hasExistingAnswer: hasExistingAnswerForEmpty,
                      disabledReason: cellData.disabledReason,
                      hasNewFileToUpload: !!newFileInCell,
                      onTogglePosition: () =>
                        toggleCellDisabled(examStudent.studentId, pageNumber),
                      onToggleAnswerDisabled: () => {
                        if (newFileInCell) {
                          toggleFileDisabled(newFileInCell.id)
                        }
                      },
                    })}
                  </ClientCell>
                )
              }

              // ファイルセル
              const file = cellData.file!
              const isFileDisabled = disabledState.files.has(file.id)
              const hasExistingAnswer =
                mode === "upload" &&
                lookupHasCell(
                  cellsWithExistingAnswers,
                  examStudent.studentId,
                  pageNumber
                )
              // 上書き無効時で既存答案がある場合はドラッグ無効
              const isDragDisabledByOverwrite =
                hasExistingAnswer && !allowOverwrite

              return (
                <ClientCell key={file.id}>
                  {renderFileCell({
                    fileId: file.id,
                    examStudent,
                    pageNumber,
                    isDragDisabled: isDragDisabledByOverwrite,
                    isFileDisabled,
                    onTogglePosition: () =>
                      toggleCellDisabled(examStudent.studentId, pageNumber),
                    onToggleFileDisabled: () => toggleFileDisabled(file.id),
                    onDelete: () => onDeleteAnswerSheet?.(file.id),
                    children: (
                      <FilePreviewCell
                        file={file}
                        pageNumber={pageNumber}
                        previewMode={previewMode}
                        isFileDisabled={isFileDisabled}
                        nameRegionAvailable={nameRegionAvailable[pageNumber]}
                        getFileColor={getFileColor}
                        drawNameRegionCanvas={drawNameRegionCanvas}
                        imageLoadState={imageLoadStates[file.id]}
                        isPendingChange={affectedCells?.has(file.id) || false}
                        hasExistingAnswer={hasExistingAnswer}
                        allowOverwrite={allowOverwrite}
                        isCorrecting={correctingFileIds?.has(file.id) || false}
                      />
                    ),
                  })}
                </ClientCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// スロットが返すセル（TableCell）をそのまま行に並べるための素通しラッパー。
// renderFileCell/renderEmptyCell は <TableCell> を返すため、ここでは Fragment で受ける。
function ClientCell({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
