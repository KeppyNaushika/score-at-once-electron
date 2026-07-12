"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core"
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { FileImage } from "lucide-react"

import { DraggableAnswerCell } from "@/components/exams/06-student-answers/student-answer-table/components/DraggableAnswerCell"
import { EmptyTableCell } from "@/components/exams/06-student-answers/student-answer-table/components/EmptyTableCell"
import { OrphanAnswerCard } from "@/components/exams/06-student-answers/student-answer-table/components/OrphanAnswerCard"
import { SortableTableCell } from "@/components/exams/06-student-answers/student-answer-table/components/SortableTableCell"
import {
  type EmptyCellSlotProps,
  type FileCellSlotProps,
  TableContent,
} from "@/components/exams/06-student-answers/student-answer-table/components/TableContent"
import { TableDragOverlay } from "@/components/exams/06-student-answers/student-answer-table/components/TableDragOverlay"
import { TableHeader } from "@/components/exams/06-student-answers/student-answer-table/components/TableHeader"
import type {
  CellData,
  ExtendedDisabledState,
  PreviewMode,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { CellLookup } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  AnswerItem,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import { Card, CardContent } from "@/components/ui/card"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface AnswerTableShellProps {
  mode: "upload" | "view"

  // ヘッダー
  maxPages: number
  enabledFilesCount: number
  trashFiles: Array<{ id: string; name: string; size?: number }>
  onFileRestore: (fileId: string) => void
  isUploading: boolean
  onUpload: () => void
  fileOrder: PlacementStrategy
  onFileOrderChange?: (order: PlacementStrategy) => void
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
  allowOverwrite: boolean
  onAllowOverwriteChange: (allow: boolean) => void
  markerCorrectionEnabled?: boolean
  markerCorrectionAvailable?: boolean
  markerDiagnostics?: string
  onMarkerCorrectionChange?: (enabled: boolean) => void

  // DnD
  sensors: SensorDescriptor<SensorOptions>[]
  activeFile: AnswerItem | null
  sortableItemIds: string[]
  onDragStart: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void

  // テーブルデータ
  tableData: CellData<AnswerItem>[][]
  sortedStudents: ExamStudentWithMemberships[]
  disabledState: ExtendedDisabledState
  nameRegionAvailable: Record<number, boolean>
  cellsWithExistingAnswers: CellLookup
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

  // 孤立答案（view のみ）
  orphanItems: AnswerItem[]

  // 氏名欄クリッピング用 canvas
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

/**
 * upload / view 共通の答案テーブル外枠（Card・DndContext・ヘッダー・グリッド・
 * ドラッグオーバーレイ・孤立答案ストリップ・モーダル）。DnD の振る舞いはスロット
 * （renderFileCell / renderEmptyCell）で注入し、TableContent は DnD 非依存に保つ。
 */
export function AnswerTableShell({
  mode,
  maxPages,
  enabledFilesCount,
  trashFiles,
  onFileRestore,
  isUploading,
  onUpload,
  fileOrder,
  onFileOrderChange,
  previewMode,
  onPreviewModeChange,
  hasNameRegion,
  allowOverwrite,
  onAllowOverwriteChange,
  markerCorrectionEnabled,
  markerCorrectionAvailable,
  markerDiagnostics,
  onMarkerCorrectionChange,
  sensors,
  activeFile,
  sortableItemIds,
  onDragStart,
  onDragEnd,
  tableData,
  sortedStudents,
  disabledState,
  nameRegionAvailable,
  cellsWithExistingAnswers,
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
  orphanItems,
  canvasRef,
}: AnswerTableShellProps) {
  // 模範解答が存在しない場合
  if (maxPages === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 text-center text-gray-500">
            <FileImage className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-lg">模範解答が登録されていません</p>
            <p className="text-sm">まず模範解答をアップロードしてください</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 孤立答案のカード（表示ラベル付き）。孤立が無いときは Set も確保しない。
  // 分類は partitionAnswerItemsByPlacement（tableDataUtils）の配置可能規則に対応する
  // ——名簿外（除籍）か、ページ範囲外か。規則を増やす場合は両者を揃えること。
  const orphanCards =
    mode === "view" && orphanItems.length > 0
      ? (() => {
          const rosterStudentIds = new Set(
            sortedStudents.map((examStudent) => examStudent.studentId)
          )
          return orphanItems.map((answerItem) => ({
            answerItem,
            reasonLabel:
              answerItem.studentId && rosterStudentIds.has(answerItem.studentId)
                ? `ページ${answerItem.pageNumber}（範囲外）`
                : "配置先の生徒が名簿にありません",
          }))
        })()
      : []

  // ファイルセルの DnD ラッパー（モード別に注入）:
  // - upload（方式A）: SortableTableCell（sortable による並べ替え）
  // - view（方式B）: DraggableAnswerCell（素の draggable＋マス droppable）。sortable を使わないので
  //   掴んでも他マスに reflow が起きず、単独移動／占有マスとの入れ替えだけが反映される。
  const renderFileCell = (slot: FileCellSlotProps) =>
    mode === "view" ? (
      <DraggableAnswerCell
        fileId={slot.fileId}
        examStudent={slot.examStudent}
        pageNumber={slot.pageNumber}
        hasScoreData
        onDelete={slot.onDelete}
      >
        {slot.children}
      </DraggableAnswerCell>
    ) : (
      <SortableTableCell
        id={slot.fileId}
        hasFile
        isPositionDisabled={slot.isDragDisabled}
        isFileDisabled={slot.isFileDisabled}
        onTogglePosition={slot.onTogglePosition}
        onToggleFileDisabled={slot.onToggleFileDisabled}
        fileId={slot.fileId}
      >
        {slot.children}
      </SortableTableCell>
    )

  // 空セル・無効セルの DnD ラッパー（view のみ droppable、upload は無効）
  const renderEmptyCell = (slot: EmptyCellSlotProps) => (
    <EmptyTableCell
      examStudent={slot.examStudent}
      pageNumber={slot.pageNumber}
      isPositionDisabled={slot.isPositionDisabled}
      isPendingChange={false}
      mode={mode}
      hasExistingAnswer={slot.hasExistingAnswer}
      allowOverwrite={allowOverwrite}
      disabledReason={slot.disabledReason}
      onTogglePosition={slot.onTogglePosition}
      onToggleAnswerDisabled={slot.onToggleAnswerDisabled}
      hasNewFileToUpload={slot.hasNewFileToUpload}
    />
  )

  // 表本体＋孤立答案枠。upload は SortableContext で包み、view はそのまま置く。
  const tableBody = (
    <>
      <TableContent
        tableData={tableData}
        sortedStudents={sortedStudents}
        maxPages={maxPages}
        disabledState={disabledState}
        mode={mode}
        previewMode={previewMode}
        nameRegionAvailable={nameRegionAvailable}
        cellsWithExistingAnswers={cellsWithExistingAnswers}
        allowOverwrite={allowOverwrite}
        files={files}
        affectedCells={affectedCells}
        imageLoadStates={imageLoadStates}
        correctingFileIds={correctingFileIds}
        getFileColor={getFileColor}
        drawNameRegionCanvas={drawNameRegionCanvas}
        toggleRowDisabled={toggleRowDisabled}
        toggleColDisabled={toggleColDisabled}
        toggleCellDisabled={toggleCellDisabled}
        toggleFileDisabled={toggleFileDisabled}
        onDeleteAnswerSheet={onDeleteAnswerSheet}
        renderFileCell={renderFileCell}
        renderEmptyCell={renderEmptyCell}
      />

      {/* 孤立答案（表のマスに配置できない答案）の救済枠（view のみ） */}
      {mode === "view" && orphanCards.length > 0 && (
        <div className="mt-4 rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-3">
          <div className="mb-2 text-sm font-medium text-amber-800">
            未配置の答案（{orphanCards.length}件）
            <span className="ml-2 font-normal text-amber-700">
              除籍・ページ数変更などでマスに置けない答案です。正しいマスへドラッグしてください。
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {orphanCards.map(({ answerItem, reasonLabel }) => (
              <OrphanAnswerCard
                key={answerItem.id}
                item={answerItem}
                reasonLabel={reasonLabel}
                previewMode={previewMode}
                getFileColor={getFileColor}
                drawNameRegionCanvas={drawNameRegionCanvas}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <Card>
          <TableHeader
            maxPages={maxPages}
            enabledFilesCount={enabledFilesCount}
            trashFiles={trashFiles}
            onFileRestore={onFileRestore}
            isUploading={isUploading}
            mode={mode}
            onUpload={onUpload}
            fileOrder={fileOrder}
            onFileOrderChange={onFileOrderChange}
            previewMode={previewMode}
            onPreviewModeChange={onPreviewModeChange}
            hasNameRegion={hasNameRegion}
            allowOverwrite={allowOverwrite}
            onAllowOverwriteChange={onAllowOverwriteChange}
            markerCorrectionEnabled={markerCorrectionEnabled}
            markerCorrectionAvailable={markerCorrectionAvailable}
            markerDiagnostics={markerDiagnostics}
            onMarkerCorrectionChange={onMarkerCorrectionChange}
          />

          <CardContent className="p-4">
            <div className="min-h-96">
              {/* upload（方式A）だけ SortableContext で並べ替え文脈を張る。
                  view（方式B）は素の droppable マス＋draggable 答案で構成し、
                  sortable の reflow で周囲が動かないようにする。 */}
              {mode === "upload" ? (
                <SortableContext
                  items={sortableItemIds}
                  strategy={rectSortingStrategy}
                >
                  {tableBody}
                </SortableContext>
              ) : (
                tableBody
              )}
            </div>
          </CardContent>
        </Card>

        <TableDragOverlay
          activeFile={activeFile}
          previewMode={previewMode}
          nameRegionAvailable={
            activeFile ? nameRegionAvailable[activeFile.pageNumber] : false
          }
          getFileColor={getFileColor}
          drawNameRegionCanvas={drawNameRegionCanvas}
        />
      </DndContext>

      {/* 氏名欄クリッピング用の隠しcanvas */}
      <canvas ref={canvasRef} className="hidden" width={0} height={0} />
    </div>
  )
}
