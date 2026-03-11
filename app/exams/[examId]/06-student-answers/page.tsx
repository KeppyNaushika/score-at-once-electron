"use client"

import { FileEdit } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import type { DirtyDetail } from "@/contexts/NavigationGuardContext"
import { useNavigationGuard } from "@/hooks/useNavigationGuard"

import {
  LoadingSpinner,
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
  const { helpButton } = usePageHelp()
  const examId = params.examId as string

  const [activeTab, setActiveTab] = useState<StudentAnswerTab>("new-grid")
  const [uploadFileCount, setUploadFileCount] = useState(0)

  // Data loading hook
  const { students, studentAnswers, modelAnswerCount, isLoading, loadData } =
    useStudentAnswersData(examId)

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
  } = usePendingChanges(loadData, students, studentAnswers)

  // Navigation guard
  const isDirty = uploadFileCount > 0 || pendingChanges.length > 0
  const dirtyDetails = useMemo<DirtyDetail[]>(
    () => [
      { label: "未アップロードの画像", count: uploadFileCount },
      { label: "配置済み答案の変更", count: pendingChanges.length },
    ],
    [uploadFileCount, pendingChanges.length]
  )
  const { guardedNavigate } = useNavigationGuard(isDirty, dirtyDetails)

  // Reset function will be obtained directly from components

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [examId, loadData])

  /**
   * Handles upload completion for new uploads
   */
  const handleUploadComplete = useCallback(() => {
    loadData()
  }, [loadData])

  /**
   * Handles student answer updates in view mode
   */
  const handleStudentAnswerUpdate = useCallback(() => {
    toast.info("変更が保存されました", {
      description: "「変更を反映」ボタンで最新データを確認してください",
    })
  }, [])

  // Show loading spinner while data is loading
  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="生徒答案の追加と関連付け" helpButton={helpButton}>
          <div className="flex gap-2">
            {pendingChanges.length > 0 && (
              <Button
                variant="default"
                onClick={openConfirmModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <FileEdit className="h-4 w-4" />
                {pendingChanges.length}件の変更を反映
              </Button>
            )}
            <Button
              onClick={() =>
                guardedNavigate(`/exams/${examId}/07-score-at-once`)
              }
            >
              次へ: 一括採点
            </Button>
          </div>
        </PageHeader>

        <div className="flex-1 overflow-auto p-3">
          <StudentAnswersTabsNavigation
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as StudentAnswerTab)}
          >
            <StudentAnswersTabContent
              examId={examId}
              students={students}
              modelAnswerCount={modelAnswerCount}
              studentAnswers={studentAnswers}
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
            />
          </StudentAnswersTabsNavigation>
        </div>
      </div>
    </ProtectedRoute>
  )
}
