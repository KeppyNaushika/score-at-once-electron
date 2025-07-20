"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import { useParams } from "next/navigation"
import { useState } from "react"

// 新しく分割されたコンポーネントとフック
import ProjectStudentsPageHeader from "./components/ProjectStudentsPageHeader"
import StudentActionButtons from "./components/StudentActionButtons"
import StudentStats from "./components/StudentStats"
import SortableStudentTable from "./SortableStudentTable"
import ProjectStudentAddModal from "./ProjectStudentAddModal"
import StudentRemovalConfirmModal from "./StudentRemovalConfirmModal"
import { useStudentManagement } from "./hooks/useStudentManagement"
import { useStudentRemoval } from "./hooks/useStudentRemoval"
import { useStudentFilters } from "./hooks/useStudentFilters"

/**
 * ProjectStudentsPage - 受験生徒管理ページのメインコンポーネント
 * 
 * 機能:
 * - 受験生徒の一覧表示・管理
 * - 生徒の追加・削除・状態変更
 * - ドラッグ&ドロップによる並び替え
 * - フィルタリング・検索機能
 * - 統計情報の表示
 * 
 * @returns JSXコンポーネント
 */
export default function ProjectStudentsPage() {
  const params = useParams()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  // 生徒追加モーダルの表示状態
  const [showAddDialog, setShowAddDialog] = useState(false)

  // カスタムフックによる状態管理
  const {
    loading,
    students,
    setStudents,
    classes,
    refreshStudentData,
    updateStudentStatus,
    updateStudentOrders,
    getStatistics,
  } = useStudentManagement(projectId)

  const {
    showRemovalConfirm,
    selectedStudentsForRemoval,
    gradingDataInfo,
    handleStudentSelectionChange,
    handleSelectAll,
    initiateStudentRemoval,
    confirmStudentRemoval,
    closeRemovalConfirm,
    getStudentsToRemoveDetails,
  } = useStudentRemoval(projectId, students, refreshStudentData)

  const {
    searchTerm,
    statusFilter,
    selectedClassId,
    getFilteredStudents,
    updateSearchTerm,
    updateStatusFilter,
    updateClassFilter,
  } = useStudentFilters()

  // 統計情報の取得
  const statistics = getStatistics()

  // フィルタリングされた生徒リスト
  const filteredStudents = getFilteredStudents(students)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ProjectStudentsPageHeader
        projectId={projectId}
        helpButton={helpButton}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        {/* アクションボタン */}
        <StudentActionButtons
          selectedStudentsCount={selectedStudentsForRemoval.size}
          onRemoveStudents={initiateStudentRemoval}
          onAddStudents={() => setShowAddDialog(true)}
        />

        {/* 統計カード */}
        <StudentStats statistics={statistics} />

        {/* 生徒一覧テーブル */}
        <div className="flex min-h-0 flex-1 flex-col">
          <SortableStudentTable
            classes={classes}
            onStudentStatusUpdate={updateStudentStatus}
            onStudentOrderUpdate={updateStudentOrders}
            selectedStudents={selectedStudentsForRemoval}
            onStudentSelectionChange={handleStudentSelectionChange}
            onSelectAll={(isSelected) => handleSelectAll(isSelected, filteredStudents)}
            filteredStudents={filteredStudents}
            projectId={projectId}
            searchTerm={searchTerm}
            onSearchChange={updateSearchTerm}
            selectedClassId={selectedClassId}
            onClassChange={updateClassFilter}
            statusFilter={statusFilter}
            onStatusChange={updateStatusFilter}
          />
        </div>

        {/* 追加モーダル */}
        <ProjectStudentAddModal
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          projectId={projectId}
          onStudentsAdded={refreshStudentData}
        />

        {/* 削除確認モーダル */}
        <StudentRemovalConfirmModal
          isOpen={showRemovalConfirm}
          onClose={closeRemovalConfirm}
          onConfirm={confirmStudentRemoval}
          studentsToRemove={getStudentsToRemoveDetails()}
          hasGradingData={gradingDataInfo.hasData}
          gradingDataCount={gradingDataInfo.totalItems}
        />
      </div>
    </div>
  )
}
EOF < /dev/null