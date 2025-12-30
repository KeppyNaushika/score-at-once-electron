import { EmptyTableCell } from "@/components/projects/06-student-answers/student-answer-table/components/EmptyTableCell"
import { FilePreviewCell } from "@/components/projects/06-student-answers/student-answer-table/components/FilePreviewCell"
import { SortableTableCell } from "@/components/projects/06-student-answers/student-answer-table/components/SortableTableCell"
import type { PreviewMode } from "@/components/projects/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/projects/06-student-answers/student-answer-table/types/local-types"
import {
  Table,
  TableBody,
  TableHead,
  TableRow,
  TableHeader as UITableHeader,
} from "@/components/ui/table"
import type {
  UnifiedFile,
  UnifiedStudent,
} from "@/components/projects/06-student-answers/types"
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"

interface TableContentProps {
  tableData: Array<
    Array<{
      type: "file" | "empty" | "disabled"
      position: number
      file?: UnifiedFile
      student?: UnifiedStudent
      pageNumber?: number
    }>
  >
  sortedStudents: UnifiedStudent[]
  maxPages: number
  disabledState: {
    rows: Set<number>
    cols: Set<number>
    positions: Set<number>
    files: Set<string>
  }
  mode: "upload" | "view"
  previewMode: PreviewMode
  nameRegionAvailable: Record<number, boolean>
  positionsWithExistingAnswers: Set<number>
  allowOverwrite: boolean
  files: UnifiedFile[]
  affectedCells?: Set<string>
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  observerRef?: React.RefObject<IntersectionObserver | null>
  getEnabledFiles: () => UnifiedFile[]
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (
    file: UnifiedFile,
    pageNumber: number
  ) => Promise<string | null>
  toggleRowDisabled: (index: number) => void
  toggleColDisabled: (index: number) => void
  togglePositionDisabled: (position: number) => void
  toggleFileDisabled: (fileId: string) => void
  onUploadModalOpen: (
    position: number,
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
  positionsWithExistingAnswers,
  allowOverwrite,
  files,
  affectedCells,
  imageLoadStates = {},
  observerRef,
  getEnabledFiles,
  getFileColor,
  drawNameRegionCanvas,
  toggleRowDisabled,
  toggleColDisabled,
  togglePositionDisabled,
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
            <TableHead
              className={`w-32 border text-center ${mode === "upload" ? "cursor-pointer" : ""}`}
              onClick={
                mode === "upload" ? () => toggleColDisabled(-1) : undefined
              }
            >
              生徒名
            </TableHead>
            {/* ページ列ヘッダー */}
            {Array.from({ length: maxPages }, (_, pageIndex) => (
              <TableHead
                key={pageIndex}
                className={`w-32 border text-center ${
                  mode === "upload" ? "cursor-pointer" : ""
                } ${
                  disabledState.cols.has(pageIndex) ? "bg-gray-200" : "bg-white"
                }`}
                onClick={
                  mode === "upload"
                    ? () => toggleColDisabled(pageIndex)
                    : undefined
                }
              >
                ページ {pageIndex + 1}
              </TableHead>
            ))}
          </TableRow>
        </UITableHeader>
        <TableBody>
          {tableData.map((row, studentIndex) => (
            <TableRow key={sortedStudents[studentIndex].id}>
              {/* 生徒名セル */}
              <TableHead
                className={`border text-center ${
                  mode === "upload" ? "cursor-pointer" : ""
                } ${
                  disabledState.rows.has(studentIndex)
                    ? "bg-gray-200"
                    : "bg-white"
                }`}
                onClick={
                  mode === "upload"
                    ? () => toggleRowDisabled(studentIndex)
                    : undefined
                }
              >
                <div className="px-2 py-1">
                  <div className="text-sm font-medium">
                    {sortedStudents[studentIndex].lastName}{" "}
                    {sortedStudents[studentIndex].firstName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {sortedStudents[studentIndex].studentId}
                  </div>
                </div>
              </TableHead>

              {/* ファイルセル */}
              {row.map((cellData, pageIndex) => {
                if (cellData.type === "disabled" || cellData.type === "empty") {
                  return (
                    <EmptyTableCellWithLogic
                      key={cellData.position}
                      cellData={cellData}
                      studentIndex={studentIndex}
                      pageIndex={pageIndex}
                      sortedStudents={sortedStudents}
                      disabledState={disabledState}
                      mode={mode}
                      positionsWithExistingAnswers={
                        positionsWithExistingAnswers
                      }
                      allowOverwrite={allowOverwrite}
                      files={files}
                      togglePositionDisabled={togglePositionDisabled}
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
                  positionsWithExistingAnswers.has(cellData.position)
                // 上書き無効時で既存答案がある場合はドラッグ無効
                const isDragDisabledByOverwrite =
                  hasExistingAnswer && !allowOverwrite

                return (
                  <SortableTableCell
                    key={file.id}
                    id={file.id}
                    position={cellData.position}
                    hasFile={true}
                    isPositionDisabled={isDragDisabledByOverwrite}
                    isFileDisabled={isFileDisabled}
                    onTogglePosition={
                      mode === "upload"
                        ? () => togglePositionDisabled(cellData.position)
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
                      cellData.student
                        ? `${cellData.student.lastName} ${cellData.student.firstName}`
                        : undefined
                    }
                    pageNumber={cellData.pageNumber ?? undefined}
                    hasScoreData={true}
                    onDeleteFileWithScoring={() => {
                      if (onDeleteAnswerSheet) {
                        onDeleteAnswerSheet(file.id)
                      }
                    }}
                  >
                    <FilePreviewCell
                      file={file}
                      pageNumber={cellData.pageNumber || 1}
                      previewMode={previewMode}
                      isFileDisabled={isFileDisabled}
                      nameRegionAvailable={
                        nameRegionAvailable[cellData.pageNumber || 1]
                      }
                      getFileColor={getFileColor}
                      drawNameRegionCanvas={drawNameRegionCanvas}
                      imageLoadState={imageLoadStates[file.id]}
                      isPendingChange={affectedCells?.has(file.id) || false}
                      hasExistingAnswer={hasExistingAnswer}
                      allowOverwrite={allowOverwrite}
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

// 空セルのロジックを分離したコンポーネント
interface EmptyTableCellWithLogicProps {
  cellData: {
    type: "empty" | "disabled" | "file"
    position: number
    student?: UnifiedStudent
    pageNumber?: number
    file?: UnifiedFile
  }
  studentIndex: number
  pageIndex: number
  sortedStudents: UnifiedStudent[]
  disabledState: {
    rows: Set<number>
    cols: Set<number>
    positions: Set<number>
    files: Set<string>
  }
  mode: "upload" | "view"
  positionsWithExistingAnswers: Set<number>
  allowOverwrite: boolean
  files: UnifiedFile[]
  togglePositionDisabled: (position: number) => void
  toggleFileDisabled: (fileId: string) => void
  onUploadModalOpen: (
    position: number,
    studentName: string | undefined,
    pageNumber: number | undefined
  ) => void
}

function EmptyTableCellWithLogic({
  cellData,
  studentIndex,
  pageIndex,
  sortedStudents,
  disabledState,
  mode,
  positionsWithExistingAnswers,
  allowOverwrite,
  files,
  togglePositionDisabled,
  toggleFileDisabled,
  onUploadModalOpen,
}: EmptyTableCellWithLogicProps) {
  // 既存答案があるかチェック（空セルまたは無効セル用）
  const hasExistingAnswerForEmpty =
    mode === "upload" &&
    (cellData.type === "empty" || cellData.type === "disabled") &&
    positionsWithExistingAnswers.has(cellData.position)

  // そのセルに新しく追加しようとしている画像ファイルがあるかチェック
  const newFileInCell = files.find(
    (file) =>
      file.studentId === cellData.student?.id &&
      file.pageNumber === cellData.pageNumber &&
      !disabledState.files.has(file.id)
  )
  const hasNewFileToUpload = !!newFileInCell

  // 無効化の理由を判定
  let disabledReason: DisabledReason = undefined
  if (cellData.type === "disabled") {
    const student = sortedStudents[studentIndex]

    if (disabledState.rows.has(studentIndex)) {
      // 行無効の場合、欠席生徒かどうかをチェック
      if (student?.status === "absent") {
        disabledReason = "absent_student"
      } else {
        disabledReason = "row"
      }
    } else if (disabledState.cols.has(pageIndex)) {
      disabledReason = "column"
    } else if (disabledState.positions.has(cellData.position)) {
      disabledReason = "position"
    } else if (
      mode === "upload" &&
      !allowOverwrite &&
      positionsWithExistingAnswers.has(cellData.position)
    ) {
      disabledReason = "existing_answer"
    } else {
      // 他の理由で無効化されている場合はundefinedのまま
      disabledReason = undefined
    }
  }

  return (
    <EmptyTableCell
      position={cellData.position}
      student={cellData.student || null}
      pageNumber={cellData.pageNumber || null}
      isPositionDisabled={cellData.type === "disabled"}
      isPendingChange={false}
      mode={mode}
      hasExistingAnswer={hasExistingAnswerForEmpty}
      allowOverwrite={allowOverwrite}
      disabledReason={disabledReason}
      onTogglePosition={() => togglePositionDisabled(cellData.position)}
      onUploadToCell={() => {
        onUploadModalOpen(
          cellData.position,
          cellData.student
            ? `${cellData.student.lastName} ${cellData.student.firstName}`
            : undefined,
          cellData.pageNumber ?? undefined
        )
      }}
      onToggleAnswerDisabled={() => {
        if (newFileInCell) {
          toggleFileDisabled(newFileInCell.id)
        }
      }}
      hasNewFileToUpload={hasNewFileToUpload}
    />
  )
}
