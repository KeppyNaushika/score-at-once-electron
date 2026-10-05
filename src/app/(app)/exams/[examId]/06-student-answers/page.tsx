"use client"

import { FileEdit } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useAssignedExamStudents } from "@/components/exams/shared/useAssignedExamStudents"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { DirtyDetail } from "@/contexts/NavigationGuardContext"
import { useNavigationGuard } from "@/hooks/useNavigationGuard"

import {
  StudentAnswersTabContent,
  StudentAnswersTabsNavigation,
  type StudentAnswerTab,
} from "./components"
import { usePendingChanges, useStudentAnswersData } from "./hooks"

/**
 * StudentAnswersPage - Main page component for student answer management
 *
 * Features:
 * - Upload and manage student answers
 * - Associate student answers with students
 * - Optimistic updates for student answer placement changes
 * - Tabbed interface for new uploads and existing answers
 *
 * @returns JSX component for student answers page
 */

export default function StudentAnswersPage() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""
  const currentUser = useCurrentUser()

  const [activeTab, setActiveTab] = useState<StudentAnswerTab>("new-grid")
  const [uploadFileCount, setUploadFileCount] = useState(0)
  const [correctionStatusMap, setCorrectionStatusMap] = useState<
    Map<string, "corrected" | "skipped">
  >(new Map())

  // Data loading hook
  const {
    students: loadedStudents,
    examPages: loadedExamPages,
    isLoading,
    loadData,
  } = useStudentAnswersData(examId)

  /**
   * 受験生徒の担当による絞り込み（07 と同じ規則。担当0人の生徒は全員に出る）。
   * 行だけでなく配置済み答案も同じ規則で絞る。行の無い生徒の答案は「孤立答案」として
   * 扱われるので、行だけ絞ると他の先生の生徒の答案が孤立して見えてしまう。
   */
  const [showAllAssignments, setShowAllAssignments] = useState(false)
  const { isVisibleExamStudent, isAssignedToMe } = useAssignedExamStudents({
    examId,
    userId: currentUser.id,
    showAll: showAllAssignments,
  })
  const students = useMemo(
    () =>
      loadedStudents.filter((examStudent) =>
        isVisibleExamStudent(examStudent.id)
      ),
    [loadedStudents, isVisibleExamStudent]
  )
  const examPages = useMemo(
    () =>
      loadedExamPages.map((examPage) => ({
        ...examPage,
        studentAnswerImages: examPage.studentAnswerImages.filter(
          (answerImage) => isVisibleExamStudent(answerImage.examStudentId)
        ),
      })),
    [loadedExamPages, isVisibleExamStudent]
  )
  const assignedStudentCount = loadedStudents.filter((examStudent) =>
    isAssignedToMe(examStudent.id)
  ).length
  const isStudentSetNarrowed = assignedStudentCount < loadedStudents.length

  // Pending changes management hook
  const {
    pendingChanges,
    affectedCells,
    isConfirmModalOpen,
    handleUpdatePendingChanges,
    handleApplyChanges,
    handleResetChanges,
    openConfirmModal,
    closeConfirmModal,
  } = usePendingChanges(examId, loadData, students, examPages)

  // Navigation guard
  const isDirty = uploadFileCount > 0 || pendingChanges.length > 0
  const dirtyDetails = useMemo<DirtyDetail[]>(
    () => [
      { label: "未アップロードの画像", count: uploadFileCount },
      { label: "配置済み答案の変更", count: pendingChanges.length },
    ],
    [uploadFileCount, pendingChanges.length]
  )
  // 戻り値は使わない（段の移動はヘッダーのタブと「次へ」が担う）。ここでは
  // 書きかけを抱えていることを登録し、離脱の確認を出させるために呼ぶ
  useNavigationGuard(isDirty, dirtyDetails)

  // Reset function will be obtained directly from components

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [examId, loadData])

  /**
   * Handles correction status updates from upload
   */
  const handleCorrectionStatusUpdate = useCallback(
    (map: Map<string, "corrected" | "skipped">) => {
      setCorrectionStatusMap((prev) => {
        const merged = new Map(prev)
        map.forEach((value, key) => merged.set(key, value))
        return merged
      })
    },
    []
  )

  /**
   * Handles upload completion for new uploads
   */
  const handleUploadComplete = useCallback(() => {
    loadData()
  }, [loadData])

  /**
   * Handles student answer updates in view mode (e.g. deletion).
   * Reloads data so the table reflects the current DB state.
   */
  const handleStudentAnswerUpdate = useCallback(() => {
    loadData()
  }, [loadData])

  // Show loading spinner while data is loading
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto size-12 text-primary" />
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/*
        担当で生徒が絞られていることと「すべて表示」。書きかけ（未アップロード・未反映の
        配置）がある間は切り替えさせない。行が入れ替わると、書きかけの置き場所が消える
      */}
      {isStudentSetNarrowed && (
        <div className="flex items-center gap-2 border-b bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
          <span className="flex-1">
            {showAllAssignments
              ? `すべての生徒を表示しています（自分の担当は${assignedStudentCount}/${loadedStudents.length}人）`
              : `自分の担当の生徒だけ表示しています（${assignedStudentCount}/${loadedStudents.length}人）`}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={isDirty}
            title={
              isDirty
                ? "未アップロードの画像や未反映の変更があるあいだは切り替えられません"
                : undefined
            }
            onClick={() => setShowAllAssignments(!showAllAssignments)}
          >
            {showAllAssignments ? "担当だけに戻す" : "すべて表示"}
          </Button>
        </div>
      )}
      {/*
        書きかけの反映だけはこの画面固有の操作なので、ヘッダーではなく中身の側に
        置く（段の題・使い方・次へは `WorkflowTabHeader` が出す）。
      */}
      {pendingChanges.length > 0 && (
        <div className="flex justify-end border-b px-3 py-2">
          <Button
            variant="default"
            onClick={openConfirmModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <FileEdit className="h-4 w-4" />
            {pendingChanges.length}件の変更を反映
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        <StudentAnswersTabsNavigation
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as StudentAnswerTab)}
        >
          <StudentAnswersTabContent
            examId={examId}
            students={students}
            examPages={examPages}
            pendingChanges={pendingChanges}
            affectedCells={affectedCells}
            onUploadComplete={handleUploadComplete}
            onStudentAnswerUpdate={handleStudentAnswerUpdate}
            onUpdatePendingChanges={handleUpdatePendingChanges}
            isConfirmModalOpen={isConfirmModalOpen}
            onCloseConfirmModal={closeConfirmModal}
            onApplyChanges={handleApplyChanges}
            onResetChanges={handleResetChanges}
            onUploadFileCountChange={setUploadFileCount}
            correctionStatusMap={correctionStatusMap}
            onCorrectionStatusUpdate={handleCorrectionStatusUpdate}
          />
        </StudentAnswersTabsNavigation>
      </div>
    </div>
  )
}
