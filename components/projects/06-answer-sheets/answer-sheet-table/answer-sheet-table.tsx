"use client"

import {
  TableContent,
  TableDragOverlay,
  TableHeader,
  UploadModalWrapper,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/components"
import { useAnswerSheetTableLogic } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks"
import type { AnswerSheetTableProps } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import { Card, CardContent } from "@/components/ui/card"
import { closestCenter, DndContext } from "@dnd-kit/core"
import { FileImage } from "lucide-react"


export function AnswerSheetTable(props: AnswerSheetTableProps) {
  const {
    imageLoadStates = {},
    observerRef,
    mode = "upload",
    affectedCells,
  } = props


  // メインロジックを含むカスタムフック
  const {
    canvasRef,
    drawNameRegionCanvas,
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    togglePositionDisabled,
    toggleFileDisabled,
    sortedStudents,
    getEnabledFiles,
    getFileColor,
    tableData,
    positionsWithExistingAnswers,
    sensors,
    activeFile,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    allowOverwrite,
    setAllowOverwrite,
    previewMode,
    uploadModalState,
    handlePreviewModeChange,
    handleUpload,
    handleUploadModalOpen,
    handleUploadModalClose,
    handleUploadToCell,
    handleDeleteAnswerSheet,
    maxPages,
    trashFiles,
    hasNameRegion,
    nameRegionAvailable,
  } = useAnswerSheetTableLogic(props)

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
            isUploading={props.isUploading || false}
            mode={mode}
            onUpload={handleUpload}
            fileOrder={props.fileOrder || "page-first"}
            onFileOrderChange={props.onFileOrderChange}
            previewMode={previewMode}
            onPreviewModeChange={handlePreviewModeChange}
            hasNameRegion={hasNameRegion}
            allowOverwrite={allowOverwrite}
            onAllowOverwriteChange={setAllowOverwrite}
          />

          <CardContent className="min-h-0 flex-1 overflow-auto p-4">
            <TableContent
              tableData={tableData}
              sortedStudents={sortedStudents}
              maxPages={maxPages}
              disabledState={disabledState}
              mode={mode}
              previewMode={previewMode}
              nameRegionAvailable={nameRegionAvailable}
              positionsWithExistingAnswers={positionsWithExistingAnswers}
              allowOverwrite={allowOverwrite}
              files={props.files}
              affectedCells={affectedCells}
              imageLoadStates={imageLoadStates}
              observerRef={observerRef}
              getEnabledFiles={getEnabledFiles}
              getFileColor={getFileColor}
              drawNameRegionCanvas={drawNameRegionCanvas}
              toggleRowDisabled={toggleRowDisabled}
              toggleColDisabled={toggleColDisabled}
              togglePositionDisabled={togglePositionDisabled}
              toggleFileDisabled={toggleFileDisabled}
              onUploadModalOpen={handleUploadModalOpen}
              onDeleteAnswerSheet={handleDeleteAnswerSheet}
            />
          </CardContent>
        </Card>

        <TableDragOverlay
          activeFile={activeFile}
          previewMode={previewMode}
          getFileColor={getFileColor}
          drawNameRegionCanvas={drawNameRegionCanvas}
        />
      </DndContext>

      {/* 氏名欄クリッピング用の隠しcanvas */}
      <canvas ref={canvasRef} className="hidden" width={0} height={0} />

      {/* セルにアップロードモーダル */}
      <UploadModalWrapper
        uploadModalState={uploadModalState}
        onClose={handleUploadModalClose}
        onUpload={handleUploadToCell}
      />
    </div>
  )
}
