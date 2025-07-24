"use client"

import {
  EmptyTableCell,
  FilePreviewCell,
  SortableTableCell,
  TableHeader,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/components"
import {
  useDisabledState,
  useDragDrop,
  useNameRegion,
  useTableData,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks"
import type { PreviewMode } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableRow,
  TableHeader as UITableHeader,
} from "@/components/ui/table"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
  PendingChange,
} from "@/types/answer-sheet.types"
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core"
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { FileImage } from "lucide-react"
import { useEffect, useState } from "react"

// ============================================================================
// Props定義
// ============================================================================

interface AnswerSheetTableProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  masterImageCount: number
  fileOrder?: PlacementStrategy
  isUploading?: boolean
  onFileOrderChange?: (order: PlacementStrategy) => void
  onFilesChange: (files: UnifiedFile[]) => void
  onUpload: (data: UploadData[]) => void
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  observerRef?: React.RefObject<IntersectionObserver | null>
  mode?: "upload" | "view"
  onReloadData?: () => void

  // 変更状態管理用（確認モードのみ）
  pendingChanges?: PendingChange[]
  affectedCells?: Set<string>
  onUpdatePendingChanges?: (changedFiles: Array<{ fileId: string; fromState: any; toState: any }>) => void
  onResetDragDrop?: React.MutableRefObject<(() => void) | null>
}

// ============================================================================
// メインコンポーネント
// ============================================================================

export function AnswerSheetTable({
  projectId,
  students,
  files,
  masterImageCount,
  fileOrder = "page-first",
  isUploading = false,
  onFileOrderChange,
  onFilesChange,
  onUpload,
  imageLoadStates = {},
  observerRef,
  mode = "upload",
  onReloadData,
  pendingChanges,
  affectedCells,  
  onUpdatePendingChanges,
  onResetDragDrop,
}: AnswerSheetTableProps) {
  // ============================================================================
  // カスタムフック
  // ============================================================================

  const {
    nameRegionAvailable,
    canvasRef,
    checkNameRegionAvailability,
    drawNameRegionCanvas,
  } = useNameRegion(projectId)

  const {
    disabledState,
    setDisabledState,
    toggleRowDisabled,
    toggleColDisabled,
    togglePositionDisabled,
    toggleFileDisabled,
    isPositionDisabled,
    initializeStudentsWithoutAnswers,
  } = useDisabledState()

  const {
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
  } = useTableData(
    files,
    students,
    masterImageCount,
    fileOrder,
    disabledState,
    isPositionDisabled,
  )

  const {
    sensors,
    activeFile,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetToInitialState,
  } = useDragDrop(
    files,
    onFilesChange,
    getEnabledFiles,
    getDisabledFiles,
    disabledState,
    setDisabledState,
    students,
    masterImageCount,
    mode,
    fileOrder,
    onReloadData,
    onUpdatePendingChanges,
  )

  // コールバック関数をプロップとして渡すためのuseEffect
  useEffect(() => {
    if (onResetDragDrop) {
      onResetDragDrop.current = resetToInitialState
    }
  }, [onResetDragDrop, resetToInitialState])

  // ============================================================================
  // ローカルState
  // ============================================================================

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")

  // デバッグ用のpreviewMode変更ハンドラー
  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode)
  }

  // ============================================================================
  // 初期化処理
  // ============================================================================

  useEffect(() => {
    checkNameRegionAvailability()
  }, [checkNameRegionAvailability])

  // ============================================================================
  // イベントハンドラー
  // ============================================================================


  const handleUpload = () => {
    const uploadData: UploadData[] = []

    // 動的テーブルデータから配置済みファイルのアップロードデータを生成
    tableData.forEach((row) => {
      row.forEach((cell) => {
        if (
          cell.type === "file" &&
          cell.file &&
          cell.student &&
          cell.pageNumber
        ) {
          uploadData.push({
            name: cell.file.name,
            fileName: cell.file.name,
            originalFileName: cell.file.originalFileName,
            type: cell.file.type,
            buffer: cell.file.buffer,
            studentId: cell.student.id,
            pageNumber: cell.pageNumber,
            overwrite: false,
          })
        }
      })
    })

    onUpload(uploadData)
  }

  // ============================================================================
  // 初期化処理
  // ============================================================================

  // 答案がない生徒の自動無効化（DBベース）
  useEffect(() => {
    initializeStudentsWithoutAnswers(students, files)
  }, [students, files, initializeStudentsWithoutAnswers])

  // ============================================================================
  // 計算済みプロパティ
  // ============================================================================

  const maxPages = masterImageCount
  const trashFiles = getDisabledFiles()
  const hasNameRegion = Object.values(nameRegionAvailable).some(Boolean)

  // デバッグログ

  // ============================================================================
  // レンダリング
  // ============================================================================

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

  return (
    <div className="flex h-full flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Card className="flex h-full flex-col">
          <TableHeader
            maxPages={maxPages}
            enabledFilesCount={getEnabledFiles().length}
            trashFiles={trashFiles}
            onFileRestore={toggleFileDisabled}
            isUploading={isUploading}
            mode={mode}
            onUpload={handleUpload}
            fileOrder={fileOrder}
            onFileOrderChange={onFileOrderChange}
            previewMode={previewMode}
            onPreviewModeChange={handlePreviewModeChange}
            hasNameRegion={hasNameRegion}
          />

          <CardContent className="min-h-0 flex-1 overflow-auto p-4">
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
                      onClick={mode === "upload" ? () => toggleColDisabled(-1) : undefined}
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
                          disabledState.cols.has(pageIndex)
                            ? "bg-gray-200"
                            : "bg-white"
                        }`}
                        onClick={mode === "upload" ? () => toggleColDisabled(pageIndex) : undefined}
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
                        onClick={mode === "upload" ? () => toggleRowDisabled(studentIndex) : undefined}
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
                        if (
                          cellData.type === "disabled" ||
                          cellData.type === "empty"
                        ) {
                          return (
                            <EmptyTableCell
                              key={cellData.position}
                              position={cellData.position}
                              student={cellData.student}
                              pageNumber={cellData.pageNumber}
                              isPositionDisabled={cellData.type === "disabled"}
                              isPendingChange={false} // 空のセルは通常変更対象外
                            />
                          )
                        }

                        // ファイルセル
                        const file = cellData.file!
                        const isFileDisabled = disabledState.files.has(file.id)

                        return (
                          <SortableTableCell
                            key={file.id}
                            id={file.id}
                            position={cellData.position}
                            hasFile={true}
                            isPositionDisabled={false}
                            isFileDisabled={isFileDisabled}
                            onTogglePosition={mode === "upload" ? () =>
                              togglePositionDisabled(cellData.position)
                            : () => {}}
                            onToggleFileDisabled={mode === "upload" ? () =>
                              toggleFileDisabled(file.id)
                            : () => {}}
                            onUploadToCell={() => {
                              // アップロードはアップロードタブから行う
                            }}
                            fileId={file.id}
                            observerRef={observerRef}
                            mode={mode}
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
                              isPendingChange={
                                affectedCells?.has(file.id) || false
                              }
                            />
                          </SortableTableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SortableContext>
          </CardContent>
        </Card>

        <DragOverlay dropAnimation={null}>
          {activeFile ? (
            <div className="h-32 w-32 scale-110 rotate-3 transform rounded border-2 border-blue-400 bg-white shadow-2xl">
              <FilePreviewCell
                file={activeFile}
                pageNumber={1}
                previewMode={previewMode}
                isFileDisabled={false}
                nameRegionAvailable={false}
                getFileColor={getFileColor}
                drawNameRegionCanvas={drawNameRegionCanvas}
                imageLoadState="loaded"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 氏名欄クリッピング用の隠しcanvas */}
      <canvas ref={canvasRef} className="hidden" width={0} height={0} />
    </div>
  )
}
