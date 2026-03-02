"use client"

import { closestCenter, DndContext } from "@dnd-kit/core"
import { FileImage } from "lucide-react"

import { TableContent } from "@/components/exams/06-student-answers/student-answer-table/components/TableContent"
import { TableDragOverlay } from "@/components/exams/06-student-answers/student-answer-table/components/TableDragOverlay"
import { TableHeader } from "@/components/exams/06-student-answers/student-answer-table/components/TableHeader"
import { UploadModalWrapper } from "@/components/exams/06-student-answers/student-answer-table/components/UploadModalWrapper"
import { useStudentAnswerTableLogic } from "@/components/exams/06-student-answers/student-answer-table/hooks/useStudentAnswerTableLogic"
import type { StudentAnswerTableProps } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import { Card, CardContent } from "@/components/ui/card"

export function StudentAnswerTable(props: StudentAnswerTableProps) {
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
  } = useStudentAnswerTableLogic(props)

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
    <div className="flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Card>
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

          <CardContent className="p-4">
            <div className="min-h-96">
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
            </div>
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
