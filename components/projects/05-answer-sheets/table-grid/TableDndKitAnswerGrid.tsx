"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader as UITableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  closestCenter,
  DndContext,
  DragOverlay,
} from "@dnd-kit/core"
import {
  rectSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable"
import { FileImage } from "lucide-react"

// コンポーネントインポート
import {
  FilePreviewCell,
  SortableTableCell,
  EmptyTableCell,
  TableHeader,
} from "./components"

// フックインポート
import {
  useNameRegion,
  useDisabledState,
  useTableData,
  useDragAndDrop,
} from "./hooks"

// 型インポート
import type { PreviewMode } from "./types"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/types/answer-sheet.types"

// ============================================================================
// Props定義
// ============================================================================

interface TableDndKitAnswerGridProps {
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
  mode?: "upload" | "view" // アップロードモードか表示モードか
}

// ============================================================================
// メインコンポーネント（table-dnd-kit-test準拠）
// ============================================================================

export default function TableDndKitAnswerGrid({
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
}: TableDndKitAnswerGridProps) {
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
  } = useDragAndDrop(
    files,
    onFilesChange,
    getEnabledFiles,
    getDisabledFiles,
    disabledState,
    setDisabledState,
  )

  // ============================================================================
  // ローカルState
  // ============================================================================

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")

  // ============================================================================
  // 初期化処理
  // ============================================================================

  useEffect(() => {
    checkNameRegionAvailability()
  }, [checkNameRegionAvailability])

  // ============================================================================
  // イベントハンドラー
  // ============================================================================

  const handleUploadToCell = (position: number) => {
    console.log(`Upload to cell at position ${position}`)
    // TODO: セル特定位置へのアップロード処理
  }

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
  // 計算済みプロパティ
  // ============================================================================

  const maxPages = masterImageCount
  const trashFiles = getDisabledFiles()
  const hasNameRegion = Object.values(nameRegionAvailable).some(Boolean)

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
            onPreviewModeChange={setPreviewMode}
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
                      className="w-32 cursor-pointer border text-center"
                      onClick={() => toggleColDisabled(-1)}
                    >
                      生徒名
                    </TableHead>
                    {/* ページ列ヘッダー */}
                    {Array.from({ length: maxPages }, (_, pageIndex) => (
                      <TableHead
                        key={pageIndex}
                        className={`w-32 cursor-pointer border text-center ${
                          disabledState.cols.has(pageIndex)
                            ? "bg-gray-200"
                            : "bg-white"
                        }`}
                        onClick={() => toggleColDisabled(pageIndex)}
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
                          disabledState.rows.has(studentIndex)
                            ? "bg-gray-200"
                            : "bg-white"
                        }`}
                        onClick={() => toggleRowDisabled(studentIndex)}
                      >
                        <div className="cursor-pointer px-2 py-1">
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
                            <EmptyTableCell
                              key={cellData.position}
                              position={cellData.position}
                              student={cellData.student}
                              pageNumber={cellData.pageNumber}
                              isPositionDisabled={cellData.type === "disabled"}
                              onTogglePosition={() =>
                                togglePositionDisabled(cellData.position)
                              }
                              onUploadToCell={() =>
                                handleUploadToCell(cellData.position)
                              }
                            />
                          )
                        }

                        // ファイルセル（table-dnd-kit-test準拠）
                        const file = cellData.file!
                        const isFileDisabled = disabledState.files.has(file.id)

                        return (
                          <SortableTableCell
                            key={file.id}
                            id={file.id}
                            position={cellData.position}
                            hasFile={true}
                            isPositionDisabled={false} // 動的配置では無効セルにファイルは配置されない
                            isFileDisabled={isFileDisabled}
                            onTogglePosition={() =>
                              togglePositionDisabled(cellData.position)
                            }
                            onToggleFileDisabled={() =>
                              toggleFileDisabled(file.id)
                            }
                            onUploadToCell={() =>
                              handleUploadToCell(cellData.position)
                            }
                            fileId={file.id}
                            observerRef={observerRef}
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
            <div className="ring-opacity-30 scale-110 rotate-3 transform rounded-lg border-2 border-blue-400 bg-white p-4 shadow-2xl ring-4 ring-blue-200 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded ${getFileColor(activeFile)} flex-shrink-0`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-gray-800">
                    {activeFile.name.split(" - ページ")[0] || activeFile.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {(activeFile.size / 1024).toFixed(1)}KB
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 氏名欄クリッピング用の隠しcanvas */}
      <canvas ref={canvasRef} className="hidden" width={0} height={0} />
    </div>
  )
}