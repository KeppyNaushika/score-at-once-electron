"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import { ConfirmChangesModal } from "@/components/projects/06-answer-sheets/answer-sheet-table/components/confirm-changes-modal"
import { useParams } from "next/navigation"
import {
  LoadingSpinner,
  AnswerSheetsPageHeader,
  AnswerSheetsTabsNavigation,
  AnswerSheetsTabContent,
} from "./components"
import { useAnswerSheetsData, usePendingChanges } from "./hooks"
import type { AnswerSheetTab } from "./types"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

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
  const {
    project,
    students,
    answerSheets,
    masterImageCount,
    isLoading,
    loadData,
  } = useAnswerSheetsData(projectId)

  // Pending changes management hook
  const {
    pendingChanges,
    affectedCells,
    isConfirmModalOpen,
    handleAddPendingChange,
    handleApplyChanges,
    openConfirmModal,
    closeConfirmModal,
  } = usePendingChanges(loadData)

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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground mt-4">読み込み中...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col overflow-y-auto">
        <PageHeader
          title="答案アップロード"
          description="生徒の答案画像をアップロードし、生徒と関連付けます"
          helpButton={helpButton}
        >
          <div className="flex gap-2">
            {pendingChanges.length > 0 && (
              <Button
                variant="default"
                onClick={() => setIsConfirmModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <FileEdit className="h-4 w-4" />
                {pendingChanges.length}件の変更を反映
              </Button>
            )}
            <Button
              onClick={() =>
                router.push(`/projects/${projectId}/07-score-at-once`)
              }
            >
              次へ: 採点開始
            </Button>
          </div>
        </PageHeader>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new-grid" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                新規追加
              </TabsTrigger>
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                配置済み答案の確認
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new-grid" className="mt-3 min-h-0 flex-1 p-3">
              <AnswerSheetUpload
                projectId={projectId}
                students={students}
                masterImageCount={masterImageCount}
                onUploadComplete={handleUploadComplete}
              />
            </TabsContent>

            <TabsContent value="current" className="mt-3 min-h-0 flex-1 p-3">
              <AnswerSheetUpload
                projectId={projectId}
                students={students}
                masterImageCount={masterImageCount}
                onUploadComplete={handleAnswerSheetUpdate}
                existingAnswerSheets={answerSheets}
                mode="view"
                pendingChanges={pendingChanges}
                affectedCells={affectedCells}
                onAddPendingChange={handleAddPendingChange}
              />
            </TabsContent>
          </Tabs>

          {/* 変更確認モーダル */}
          <ConfirmChangesModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            pendingChanges={pendingChanges}
            onConfirm={handleApplyChanges}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}
