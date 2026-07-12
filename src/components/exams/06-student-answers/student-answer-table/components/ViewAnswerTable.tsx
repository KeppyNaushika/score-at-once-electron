"use client"

import { AnswerTableShell } from "@/components/exams/06-student-answers/student-answer-table/components/AnswerTableShell"
import { useAnswerTableCore } from "@/components/exams/06-student-answers/student-answer-table/hooks/useAnswerTableCore"
import type { ViewAnswerTableProps } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type { AnswerItem } from "@/components/exams/06-student-answers/types"

// 参照安定な既定値（view は補正しないため常に空）
const EMPTY_CORRECTING: Set<string> = new Set()

/**
 * 配置済み答案の確認（view）モードの答案テーブル。DB答案の投射 AnswerItem を実セル座標へ
 * 描画し、方式B（グリッドドロップ＋swap）で誤配置を修正する。マスに置けない孤立答案は
 * 専用枠に出して再配置できるようにする。マーカー補正・アップロードは持たない。
 */
export function ViewAnswerTable(props: ViewAnswerTableProps) {
  const core = useAnswerTableCore<AnswerItem>({
    examId: props.examId,
    students: props.students,
    files: props.files,
    modelAnswerCount: props.modelAnswerCount,
    mode: "view",
    onFilesChange: props.onFilesChange,
    onReloadData: props.onReloadData,
    onUpdatePendingChanges: props.onUpdatePendingChanges,
    existingStudentAnswers: props.existingStudentAnswers,
  })

  const enabledFiles = core.getEnabledFiles()

  return (
    <AnswerTableShell
      mode="view"
      maxPages={core.maxPages}
      enabledFilesCount={enabledFiles.length}
      trashFiles={core.trashFiles}
      onFileRestore={core.toggleFileDisabled}
      isUploading={false}
      onUpload={() => {}}
      fileOrder="page-first"
      previewMode={core.previewMode}
      onPreviewModeChange={core.handlePreviewModeChange}
      hasNameRegion={core.hasNameRegion}
      allowOverwrite={core.allowOverwrite}
      onAllowOverwriteChange={core.setAllowOverwrite}
      sensors={core.sensors}
      activeFile={core.activeFile}
      sortableItemIds={enabledFiles.map((file) => file.id)}
      onDragStart={core.handleDragStart}
      onDragEnd={core.handleDragEnd}
      tableData={core.tableData}
      sortedStudents={core.sortedStudents}
      disabledState={core.disabledState}
      nameRegionAvailable={core.nameRegionAvailable}
      cellsWithExistingAnswers={core.cellsWithExistingAnswers}
      files={props.files}
      affectedCells={props.affectedCells}
      imageLoadStates={props.imageLoadStates}
      correctingFileIds={EMPTY_CORRECTING}
      getFileColor={core.getFileColor}
      drawNameRegionCanvas={core.drawNameRegionCanvas}
      toggleRowDisabled={core.toggleRowDisabled}
      toggleColDisabled={core.toggleColDisabled}
      toggleCellDisabled={core.toggleCellDisabled}
      toggleFileDisabled={core.toggleFileDisabled}
      onDeleteAnswerSheet={core.handleDeleteAnswerSheet}
      orphanItems={core.orphanItems}
      canvasRef={core.canvasRef}
    />
  )
}
