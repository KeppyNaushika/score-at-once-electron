"use client"

import { useMemo } from "react"

import { AnswerTableShell } from "@/components/exams/06-student-answers/student-answer-table/components/AnswerTableShell"
import { useAnswerTableCore } from "@/components/exams/06-student-answers/student-answer-table/hooks/useAnswerTableCore"
import { useMarkerCorrection } from "@/components/exams/06-student-answers/student-answer-table/hooks/useMarkerCorrection"
import type { FilePreviewSource } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { UploadAnswerTableProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  UnsavedAnswerImage,
  UploadData,
} from "@/components/exams/06-student-answers/types"

// 参照安定な既定値（毎レンダーで新規 Set を作らないため）
const EMPTY_PAGES: Set<number> = new Set()

/**
 * 新規追加（upload）モードの答案テーブル。未保存の UnsavedAnswerImage を配置（方式A＝並べ替え）し、
 * マーカー補正・アップロードを担う。DB答案は占有信号としてのみ扱い、描画しない。
 */
export function UploadAnswerTable(props: UploadAnswerTableProps) {
  const core = useAnswerTableCore<UnsavedAnswerImage>({
    examId: props.examId,
    students: props.students,
    files: props.files,
    examPages: props.examPages,
    fileOrder: props.fileOrder ?? "page-first",
    mode: "upload",
    onFilesChange: props.onFilesChange,
    onReloadData: props.onReloadData,
    existingAnswers: props.existingAnswers,
  })

  // マーカー補正（UnsavedAnswerImage の buffer を扱うため upload 専用）
  const { correctingFileIds } = useMarkerCorrection({
    examId: props.examId,
    files: props.files,
    tableRows: core.tableRows,
    markerCorrectionEnabled: props.markerCorrectionEnabled ?? false,
    markerAvailablePages: props.markerAvailablePages ?? EMPTY_PAGES,
    onFilesChange: props.onFilesChange,
  })

  // 表示ソースを未保存項目から導出（fileId 別）。
  const fileDisplayById = useMemo(() => {
    const map = new Map<string, FilePreviewSource>()
    for (const file of props.files) {
      map.set(file.id, {
        previewUrl: file.preview,
        imagePath: null,
        altName: file.name,
        correctionStatus: file.correctionStatus,
        correctionError: file.correctionError,
      })
    }
    return map
  }, [props.files])

  // 配置済みファイルのアップロードデータを生成。書き込み先の生徒・ページは行が持つ
  // ExamStudent 実体・マスが持つ ExamPage 実体から直に取る（別配列との添字突き合わせをしない）。
  const handleUpload = () => {
    const uploadData: UploadData[] = []
    for (const { examStudent, cells } of core.tableRows) {
      for (const cell of cells) {
        // 未保存画像のみ本物の buffer を持つ（占有信号は buffer なし＝対象外）。
        if (cell.type !== "file" || !cell.file?.buffer) continue
        uploadData.push({
          name: cell.file.name,
          fileName: cell.file.name,
          originalFileName: cell.file.originalFileName,
          type: cell.file.fileType,
          buffer: cell.file.buffer,
          studentId: examStudent.studentId,
          examPageId: cell.examPage.id,
          overwrite: core.allowOverwrite,
          correctWithMarkers: false, // クライアント側で補正済み
          correctionStatus: cell.file.correctionStatus,
        })
      }
    }
    props.onUpload(uploadData)
  }

  const enabledFiles = core.getEnabledFiles()

  return (
    <AnswerTableShell
      mode="upload"
      maxPages={core.maxPages}
      examPages={props.examPages}
      enabledFilesCount={enabledFiles.length}
      trashFiles={core.trashFiles.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
      }))}
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
      tableRows={core.tableRows}
      disabledState={core.disabledState}
      nameRegionAvailable={core.nameRegionAvailable}
      cellsWithExistingAnswers={core.cellsWithExistingAnswers}
      files={props.files}
      imageLoadStates={props.imageLoadStates}
      correctingFileIds={correctingFileIds}
      fileDisplayById={fileDisplayById}
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
