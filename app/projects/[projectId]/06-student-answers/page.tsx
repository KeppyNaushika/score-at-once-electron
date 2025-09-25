"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { FileEdit } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  StudentAnswersTabContent,
  StudentAnswersTabsNavigation,
  LoadingSpinner,
  type StudentAnswerTab,
} from "./components"
import { useStudentAnswersData, usePendingChanges } from "./hooks"

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
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [activeTab, setActiveTab] = useState<StudentAnswerTab>("new-grid")

  // Data loading hook
  const { students, studentAnswers, modelAnswerCount, isLoading, loadData } =
    useStudentAnswersData(projectId)

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

  // Reset function will be obtained directly from components

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [projectId, loadData])

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
      <div className="flex h-full flex-col overflow-y-auto">
        <PageHeader
          title="生徒答案のアップロード・関連付け"
          helpButton={helpButton}
        >
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
              onClick={() => router.push(`/projects/${projectId}/07-score-at-once`)}
            >
              次へ: 7. 採点
            </Button>
          </div>
        </PageHeader>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <StudentAnswersTabsNavigation
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as StudentAnswerTab)}
          >
            <StudentAnswersTabContent
              activeTab={activeTab}
              projectId={projectId}
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
            />
          </StudentAnswersTabsNavigation>
        </div>
      </div>
    </ProtectedRoute>
  )
}
