"use client"

import { AnswerTableShell } from "@/components/exams/06-student-answers/student-answer-table/components/AnswerTableShell"
import { useAnswerTableCore } from "@/components/exams/06-student-answers/student-answer-table/hooks/useAnswerTableCore"
import { useMarkerCorrection } from "@/components/exams/06-student-answers/student-answer-table/hooks/useMarkerCorrection"
import type { UploadAnswerTableProps } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type {
  PendingImage,
  UploadData,
} from "@/components/exams/06-student-answers/types"

// 参照安定な既定値（毎レンダーで新規 Set を作らないため）
const EMPTY_PAGES: Set<number> = new Set()

/**
 * 新規追加（upload）モードの答案テーブル。未保存の PendingImage を配置（方式A＝並べ替え）し、
 * マーカー補正・アップロードを担う。DB答案は占有信号としてのみ扱い、描画しない。
 */
export function UploadAnswerTable(props: UploadAnswerTableProps) {
  const core = useAnswerTableCore<PendingImage>({
    examId: props.examId,
    students: props.students,
    files: props.files,
    modelAnswerCount: props.modelAnswerCount,
    fileOrder: props.fileOrder ?? "page-first",
    mode: "upload",
    onFilesChange: props.onFilesChange,
    onReloadData: props.onReloadData,
    existingStudentAnswers: props.existingStudentAnswers,
  })

  // マーカー補正（PendingImage の buffer を扱うため upload 専用）
  const { correctingFileIds } = useMarkerCorrection({
    examId: props.examId,
    files: props.files,
    tableData: core.tableData,
    markerCorrectionEnabled: props.markerCorrectionEnabled ?? false,
    markerAvailablePages: props.markerAvailablePages ?? EMPTY_PAGES,
    onFilesChange: props.onFilesChange,
  })

  // 配置済みファイルのアップロードデータを生成。生徒とページはセル座標から投射する。
  const handleUpload = () => {
    const uploadData: UploadData[] = []
    core.tableData.forEach((row, studentIndex) => {
      row.forEach((cell, pageIndex) => {
        // 未保存画像のみ本物の buffer を持つ（占有信号は buffer なし＝対象外）。
        if (cell.type === "file" && cell.file && cell.file.buffer) {
          const examStudent = core.sortedStudents[studentIndex]
          uploadData.push({
            name: cell.file.name,
            fileName: cell.file.name,
            originalFileName: cell.file.originalFileName,
            type: cell.file.type,
            buffer: cell.file.buffer,
            studentId: examStudent.studentId,
            pageNumber: pageIndex + 1,
            overwrite: core.allowOverwrite,
            correctWithMarkers: false, // クライアント側で補正済み
            correctionStatus: cell.file.correctionStatus,
          })
        }
      })
    })
    props.onUpload(uploadData)
  }

  const enabledFiles = core.getEnabledFiles()

  return (
    <AnswerTableShell
      mode="upload"
      maxPages={core.maxPages}
      enabledFilesCount={enabledFiles.length}
      trashFiles={core.trashFiles}
      onFileRestore={core.toggleFileDisabled}
      isUploading={props.isUploading ?? false}
      onUpload={handleUpload}
      fileOrder={props.fileOrder ?? "page-first"}
      onFileOrderChange={props.onFileOrderChange}
      previewMode={core.previewMode}
      onPreviewModeChange={core.handlePreviewModeChange}
      hasNameRegion={core.hasNameRegion}
      allowOverwrite={core.allowOverwrite}
      onAllowOverwriteChange={core.setAllowOverwrite}
      markerCorrectionEnabled={props.markerCorrectionEnabled}
      markerCorrectionAvailable={props.markerCorrectionAvailable}
      markerDiagnostics={props.markerDiagnostics}
      onMarkerCorrectionChange={props.onMarkerCorrectionChange}
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
      imageLoadStates={props.imageLoadStates}
      correctingFileIds={correctingFileIds}
      getFileColor={core.getFileColor}
      drawNameRegionCanvas={core.drawNameRegionCanvas}
      toggleRowDisabled={core.toggleRowDisabled}
      toggleColDisabled={core.toggleColDisabled}
      toggleCellDisabled={core.toggleCellDisabled}
      toggleFileDisabled={core.toggleFileDisabled}
      orphanItems={core.orphanItems}
      canvasRef={core.canvasRef}
    />
  )
}
