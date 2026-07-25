"use client"

import { useMemo } from "react"

import { AnswerTableShell } from "@/components/exams/06-student-answers/student-answer-table/components/AnswerTableShell"
import { useAnswerTableCore } from "@/components/exams/06-student-answers/student-answer-table/hooks/useAnswerTableCore"
import type { FilePreviewSource } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { ViewAnswerTableProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { PlacedAnswerImage } from "@/types/prismaExtensions"

// 参照安定な既定値（view は補正しないため常に空）
const EMPTY_CORRECTING: Set<string> = new Set()

interface ViewAnswerTableExtraProps {
  // 直近アップロードのマーカー補正結果（(studentId, examPageId) → status）。表示オーバーレイ専用。
  correctionStatusMap?: Map<string, "corrected" | "skipped">
}

/**
 * 配置済み答案の確認（view）モードの答案テーブル。保存済み実体 PlacedAnswerImage を実セル座標へ
 * 描画し、方式B（グリッドドロップ＋swap）で誤配置を修正する。マスに置けない孤立答案は
 * 専用枠に出して再配置できるようにする。マーカー補正・アップロードは持たない。
 */
export function ViewAnswerTable(
  props: ViewAnswerTableProps & ViewAnswerTableExtraProps
) {
  const core = useAnswerTableCore<PlacedAnswerImage>({
    examId: props.examId,
    students: props.students,
    files: props.files,
    examPages: props.examPages,
    mode: "view",
    onFilesChange: props.onFilesChange,
    onReloadData: props.onReloadData,
    onUpdatePendingChanges: props.onUpdatePendingChanges,
    existingAnswers: props.existingAnswers,
  })

  // 表示ソースをエンティティから導出（fileId 別）。DB データは射影せず、表示時に計算する。
  const correctionStatusMap = props.correctionStatusMap
  const fileDisplayById = useMemo(() => {
    const map = new Map<string, FilePreviewSource>()
    for (const answer of props.files) {
      const correctionStatus = correctionStatusMap?.get(
        `${answer.studentId}-${answer.examPageId}`
      )
      map.set(answer.id, {
        imagePath: answer.imagePath,
        altName: answer.student
          ? `${answer.student.lastName} ${answer.student.firstName}`
          : answer.id,
        correctionStatus,
      })
    }
    return map
  }, [props.files, correctionStatusMap])

  return (
    <AnswerTableShell
      mode="view"
      maxPages={core.maxPages}
      examPages={props.examPages}
      enabledFilesCount={core.getEnabledFiles().length}
      trashFiles={[]}
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
      sortableItemIds={[]}
      onDragStart={core.handleDragStart}
      onDragEnd={core.handleDragEnd}
      tableRows={core.tableRows}
      disabledState={core.disabledState}
      nameRegionAvailable={core.nameRegionAvailable}
      cellsWithExistingAnswers={core.cellsWithExistingAnswers}
      files={props.files}
      affectedCells={props.affectedCells}
      imageLoadStates={props.imageLoadStates}
      correctingFileIds={EMPTY_CORRECTING}
      fileDisplayById={fileDisplayById}
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
