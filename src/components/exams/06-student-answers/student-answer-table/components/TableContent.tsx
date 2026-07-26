import { Ban, X } from "lucide-react"

import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type {
  AnswerTableRow,
  ExtendedDisabledState,
  FilePreviewSource,
  PreviewMode,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { CellLookup } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import { lookupHasCell } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  AnswerImageIdentity,
  ExamPageColumn,
} from "@/components/exams/06-student-answers/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
// 行は AnswerTableRow が持つ ExamStudent 実体、列は各マスが持つ ExamPage 実体で回す
// （添字で別配列と突き合わせない）。表示値（pageNumber・氏名・プレビュー）は行・列の実体と
// fileDisplayById から導出する。
// ============================================================================

/** ファイルセル（答案あり）のラッパーへ渡す情報。children は FilePreviewCell。
 * 生徒・ページは Prisma 構造（ExamStudentWithMemberships / ExamPage 実体）のまま渡す。 */
export interface FileCellSlotProps {
  fileId: string
  examStudent: ExamStudentWithMemberships
  examPage: ExamPageColumn
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
  examPage: ExamPageColumn
  isPositionDisabled: boolean
  hasExistingAnswer: boolean
  disabledReason?: DisabledReason
  onTogglePosition: () => void
}

/** 行・列をまとめて無効化する操作。upload でのみ提供され、有無がメニューの表示可否になる。 */
export interface BulkDisablingHandlers {
  disableRowsExcept: (keptExamStudentId: string) => void
  disableColsExcept: (keptExamPageId: string) => void
  enableAllRows: () => void
  enableAllCols: () => void
}

interface TableContentProps {
  // 行（ExamStudent 実体）とマス（ExamPage 実体を同梱）。列ヘッダーだけは examPages で描く。
  tableRows: AnswerTableRow<AnswerImageIdentity>[]
  examPages: ExamPageColumn[]
  disabledState: ExtendedDisabledState
  mode: "upload" | "view"
  previewMode: PreviewMode
  nameRegionExamPageIds: Set<string>
  cellsWithExistingAnswers: CellLookup
  allowOverwrite: boolean
  affectedCells?: Set<string>
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  correctingFileIds?: Set<string>
  // fileId → 表示ソース（プレビュー・パス・氏名・補正）。同定と分離した表示専用の派生。
  fileDisplayById: Map<string, FilePreviewSource>
  drawNameRegionCanvas: (
    previewUrl: string | null,
    examPageId: string | null
  ) => Promise<string | null>
  toggleRowDisabled: (examStudentId: string) => void
  toggleColDisabled: (examPageId: string) => void
  // 行・列の一括無効化（upload のみ。view は行・列無効が配置に効かないので渡さない）
  bulkDisabling?: BulkDisablingHandlers
  toggleCellDisabled: (studentId: string, examPageId: string) => void
  toggleFileDisabled: (fileId: string) => void
  onDeleteAnswerSheet?: (fileId: string) => void
  // DnD ラッパー（モード別に注入）
  renderFileCell: (props: FileCellSlotProps) => React.ReactNode
  renderEmptyCell: (props: EmptyCellSlotProps) => React.ReactNode
}

export function TableContent({
  tableRows,
  examPages,
  disabledState,
  mode,
  previewMode,
  nameRegionExamPageIds,
  cellsWithExistingAnswers,
  allowOverwrite,
  affectedCells,
  imageLoadStates = {},
  correctingFileIds,
  fileDisplayById,
  drawNameRegionCanvas,
  toggleRowDisabled,
  toggleColDisabled,
  bulkDisabling,
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
          {/* ページ列ヘッダー（列＝ExamPage 実体） */}
          {examPages.map((examPage) => (
            <TableHead
              key={examPage.id}
              className={`w-32 border text-center ${
                mode === "upload" ? "cursor-pointer" : ""
              } ${
                disabledState.cols.includes(examPage.id)
                  ? "bg-gray-200"
                  : "bg-white"
              }`}
              onClick={
                mode === "upload"
                  ? () => toggleColDisabled(examPage.id)
                  : undefined
              }
            >
              <ContextMenu>
                <ContextMenuTrigger asChild disabled={!bulkDisabling}>
                  <div>ページ {examPage.pageNumber}</div>
                </ContextMenuTrigger>
                {bulkDisabling && (
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() =>
                        bulkDisabling.disableColsExcept(examPage.id)
                      }
                      className="flex items-center gap-2"
                    >
                      <Ban className="h-4 w-4" />
                      この列以外を無効
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={bulkDisabling.enableAllCols}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      列の無効をすべて解除
                    </ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            </TableHead>
          ))}
        </TableRow>
      </UITableHeader>
      <TableBody>
        {tableRows.map(({ examStudent, cells }) => (
          <TableRow key={examStudent.id}>
            {/* 生徒名セル */}
            <TableHead
              className={`border text-center ${
                mode === "upload" ? "cursor-pointer" : ""
              } ${
                disabledState.rows.includes(examStudent.id)
                  ? "bg-gray-200"
                  : "bg-white"
              }`}
              onClick={
                mode === "upload"
                  ? () => toggleRowDisabled(examStudent.id)
                  : undefined
              }
            >
              <ContextMenu>
                <ContextMenuTrigger asChild disabled={!bulkDisabling}>
                  <div className="px-2 py-1">
                    <div className="text-sm font-medium">
                      {examStudent.student.lastName}{" "}
                      {examStudent.student.firstName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {examStudent.student.studentNumber}
                    </div>
                  </div>
                </ContextMenuTrigger>
                {bulkDisabling && (
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() =>
                        bulkDisabling.disableRowsExcept(examStudent.id)
                      }
                      className="flex items-center gap-2"
                    >
                      <Ban className="h-4 w-4" />
                      この行以外を無効
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={bulkDisabling.enableAllRows}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      行の無効を解除（欠席を除く）
                    </ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            </TableHead>

            {/* ファイルセル */}
            {cells.map((cellData) => {
              // 列（ExamPage 実体）はマス自身が持つ。行の実体は上の分割代入から使う。
              const examPage = cellData.examPage

              if (cellData.type === "disabled" || cellData.type === "empty") {
                // 既存答案があるか（オーバーレイ用・upload のみ）
                const hasExistingAnswerForEmpty =
                  mode === "upload" &&
                  lookupHasCell(
                    cellsWithExistingAnswers,
                    examStudent.studentId,
                    examPage.id
                  )

                return (
                  <ClientCell key={examPage.id}>
                    {renderEmptyCell({
                      examStudent,
                      examPage,
                      isPositionDisabled: cellData.type === "disabled",
                      hasExistingAnswer: hasExistingAnswerForEmpty,
                      disabledReason: cellData.disabledReason,
                      onTogglePosition: () =>
                        toggleCellDisabled(examStudent.studentId, examPage.id),
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
                  examPage.id
                )
              // 上書き無効時で既存答案がある場合はドラッグ無効
              const isDragDisabledByOverwrite =
                hasExistingAnswer && !allowOverwrite

              const display = fileDisplayById.get(file.id)

              return (
                <ClientCell key={file.id}>
                  {renderFileCell({
                    fileId: file.id,
                    examStudent,
                    examPage,
                    isDragDisabled: isDragDisabledByOverwrite,
                    isFileDisabled,
                    onTogglePosition: () =>
                      toggleCellDisabled(examStudent.studentId, examPage.id),
                    onToggleFileDisabled: () => toggleFileDisabled(file.id),
                    onDelete: () => onDeleteAnswerSheet?.(file.id),
                    children: (
                      <FilePreviewCell
                        previewUrl={display?.previewUrl}
                        imagePath={display?.imagePath}
                        altName={
                          display?.altName ??
                          `${examStudent.student.lastName} ${examStudent.student.firstName}`
                        }
                        examPageId={examPage.id}
                        previewMode={previewMode}
                        isFileDisabled={isFileDisabled}
                        nameRegionAvailable={nameRegionExamPageIds.has(
                          examPage.id
                        )}
                        drawNameRegionCanvas={drawNameRegionCanvas}
                        imageLoadState={imageLoadStates[file.id]}
                        correctionStatus={display?.correctionStatus}
                        correctionError={display?.correctionError}
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
