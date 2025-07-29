"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AnswerSheetsPageHeader,
  AnswerSheetsTabContent,
  AnswerSheetsTabsNavigation,
  LoadingSpinner,
  type AnswerSheetTab,
} from "./components"
import { useAnswerSheetsData, usePendingChanges } from "./hooks"

/**
 * AnswerSheetsPage - Main page component for answer sheet management
 *
 * Features:
 * - Upload and manage answer sheets
 * - Associate answer sheets with students
 * - Optimistic updates for answer sheet placement changes
 * - Tabbed interface for new uploads and existing sheets
 *
 * @returns JSX component for answer sheets page
 */

export default function AnswerSheetsPage() {
  const params = useParams()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [activeTab, setActiveTab] = useState<AnswerSheetTab>("new-grid")

  // Data loading hook
  const { students, answerSheets, masterImageCount, isLoading, loadData } =
    useAnswerSheetsData(projectId)

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
  } = usePendingChanges(loadData, students, answerSheets)

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
   * Handles answer sheet updates in view mode
   */
  const handleAnswerSheetUpdate = useCallback(() => {
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
        <AnswerSheetsPageHeader
          projectId={projectId}
          pendingChangesCount={pendingChanges.length}
          helpButton={helpButton}
          onPendingChangesClick={openConfirmModal}
        />

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <AnswerSheetsTabsNavigation
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as AnswerSheetTab)}
          >
            <AnswerSheetsTabContent
              activeTab={activeTab}
              projectId={projectId}
              students={students}
              masterImageCount={masterImageCount}
              answerSheets={answerSheets}
              pendingChanges={pendingChanges}
              affectedCells={affectedCells}
              onUploadComplete={handleUploadComplete}
              onAnswerSheetUpdate={handleAnswerSheetUpdate}
              onUpdatePendingChanges={handleUpdatePendingChanges}
              isConfirmModalOpen={isConfirmModalOpen}
              onCloseConfirmModal={closeConfirmModal}
              onApplyChanges={handleApplyChanges}
              onResetChanges={handleResetChanges}
            />
          </AnswerSheetsTabsNavigation>
        </div>
      </div>
    </ProtectedRoute>
  )
}
