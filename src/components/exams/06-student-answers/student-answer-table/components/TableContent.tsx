import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"

import { EmptyTableCell } from "@/components/exams/06-student-answers/student-answer-table/components/EmptyTableCell"
import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import { SortableTableCell } from "@/components/exams/06-student-answers/student-answer-table/components/SortableTableCell"
import type {
  ExtendedDisabledState,
  PreviewMode,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type { CellLookup } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import { lookupHasCell } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type { UnifiedFile } from "@/components/exams/06-student-answers/types"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader as UITableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface TableContentProps {
  tableData: Array<
    Array<{
      type: "file" | "empty" | "disabled"
      file?: UnifiedFile
      disabledReason?: DisabledReason
    }>
  >
  sortedStudents: ExamStudentWithMemberships[]
  maxPages: number
  disabledState: ExtendedDisabledState
  mode: "upload" | "view"
  previewMode: PreviewMode
  nameRegionAvailable: Record<number, boolean>
  cellsWithExistingAnswers: CellLookup
  allowOverwrite: boolean
  files: UnifiedFile[]
  affectedCells?: Set<string>
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  observerRef?: React.RefObject<IntersectionObserver | null>
  correctingFileIds?: Set<string>
  getEnabledFiles: () => UnifiedFile[]
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (
    file: UnifiedFile,
    pageNumber: number
  ) => Promise<string | null>
  toggleRowDisabled: (examStudentId: string) => void
  toggleColDisabled: (pageNumber: number) => void
  toggleCellDisabled: (studentId: string, pageNumber: number) => void
  toggleFileDisabled: (fileId: string) => void
  onUploadModalOpen: (
    studentName: string | undefined,
    pageNumber: number | undefined
  ) => void
  onDeleteAnswerSheet?: (fileId: string) => void
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
  observerRef,
  correctingFileIds,
  getEnabledFiles,
  getFileColor,
  drawNameRegionCanvas,
  toggleRowDisabled,
  toggleColDisabled,
  toggleCellDisabled,
  toggleFileDisabled,
  onUploadModalOpen,
  onDeleteAnswerSheet,
}: TableContentProps) {
  return (
    <SortableContext
      items={getEnabledFiles().map((file) => file.id)}
      strategy={rectSortingStrategy}
    >
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
                  return (
                    <EmptyTableCellWithLogic
                      key={pageNumber}
                      cellData={cellData}
                      examStudent={examStudent}
                      pageNumber={pageNumber}
                      mode={mode}
                      cellsWithExistingAnswers={cellsWithExistingAnswers}
                      allowOverwrite={allowOverwrite}
                      files={files}
                      disabledFiles={disabledState.files}
                      toggleCellDisabled={toggleCellDisabled}
                      toggleFileDisabled={toggleFileDisabled}
                      onUploadModalOpen={onUploadModalOpen}
                    />
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
                  <SortableTableCell
                    key={file.id}
                    id={file.id}
                    hasFile={true}
                    isPositionDisabled={isDragDisabledByOverwrite}
                    isFileDisabled={isFileDisabled}
                    onTogglePosition={
                      mode === "upload"
                        ? () =>
                            toggleCellDisabled(
                              examStudent.studentId,
                              pageNumber
                            )
                        : () => {}
                    }
                    onToggleFileDisabled={
                      mode === "upload"
                        ? () => toggleFileDisabled(file.id)
                        : () => {}
                    }
                    onUploadToCell={() => {}}
                    fileId={file.id}
                    observerRef={observerRef}
                    mode={mode}
                    studentName={
                      examStudent
                        ? `${examStudent.student.lastName} ${examStudent.student.firstName}`
                        : undefined
                    }
                    pageNumber={pageNumber}
                    hasScoreData={true}
                    onDeleteFileWithScoring={() => {
                      if (onDeleteAnswerSheet) {
                        onDeleteAnswerSheet(file.id)
                      }
                    }}
                  >
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
                  </SortableTableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SortableContext>
  )
}

// 空セル・無効セルの表示ロジック。無効理由は生成側で確定済みのものを
// 受け取り（cellData.disabledReason）、ここでは再計算せず「流す」だけ。
interface EmptyTableCellWithLogicProps {
  cellData: {
    type: "empty" | "disabled" | "file"
    file?: UnifiedFile
    disabledReason?: DisabledReason
  }
  examStudent: ExamStudentWithMemberships
  pageNumber: number
  mode: "upload" | "view"
  cellsWithExistingAnswers: CellLookup
  allowOverwrite: boolean
  files: UnifiedFile[]
  disabledFiles: Set<string>
  toggleCellDisabled: (studentId: string, pageNumber: number) => void
  toggleFileDisabled: (fileId: string) => void
  onUploadModalOpen: (
    studentName: string | undefined,
    pageNumber: number | undefined
  ) => void
}

function EmptyTableCellWithLogic({
  cellData,
  examStudent,
  pageNumber,
  mode,
  cellsWithExistingAnswers,
  allowOverwrite,
  files,
  disabledFiles,
  toggleCellDisabled,
  toggleFileDisabled,
  onUploadModalOpen,
}: EmptyTableCellWithLogicProps) {
  // 既存答案があるか（オーバーレイ用）
  const hasExistingAnswerForEmpty =
    mode === "upload" &&
    (cellData.type === "empty" || cellData.type === "disabled") &&
    lookupHasCell(cellsWithExistingAnswers, examStudent.studentId, pageNumber)

  // そのセルに新しく追加しようとしている画像ファイルがあるか
  const newFileInCell = files.find(
    (file) =>
      file.studentId === examStudent.studentId &&
      file.pageNumber === pageNumber &&
      !disabledFiles.has(file.id)
  )
  const hasNewFileToUpload = !!newFileInCell

  const studentName = `${examStudent.student.lastName} ${examStudent.student.firstName}`

  return (
    <EmptyTableCell
      examStudent={examStudent}
      pageNumber={pageNumber}
      isPositionDisabled={cellData.type === "disabled"}
      isPendingChange={false}
      mode={mode}
      hasExistingAnswer={hasExistingAnswerForEmpty}
      allowOverwrite={allowOverwrite}
      disabledReason={cellData.disabledReason}
      onTogglePosition={() =>
        toggleCellDisabled(examStudent.studentId, pageNumber)
      }
      onUploadToCell={() => onUploadModalOpen(studentName, pageNumber)}
      onToggleAnswerDisabled={() => {
        if (newFileInCell) {
          toggleFileDisabled(newFileInCell.id)
        }
      }}
      hasNewFileToUpload={hasNewFileToUpload}
    />
  )
}
