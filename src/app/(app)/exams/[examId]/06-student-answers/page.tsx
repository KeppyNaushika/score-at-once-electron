"use client"

import { FileEdit } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

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
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [activeTab, setActiveTab] = useState<StudentAnswerTab>("new-grid")
  const [uploadFileCount, setUploadFileCount] = useState(0)
  const [correctionStatusMap, setCorrectionStatusMap] = useState<
    Map<string, "corrected" | "skipped">
  >(new Map())

  // Data loading hook
  const { students, examPages, isLoading, loadData } =
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
    return <LoadingSpinner />
  }

  return (
    <div className="flex h-full flex-col">
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
