"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import ProjectStudentAddModal from "@/components/projects/05-students/components/ProjectStudentAddModal"
import SortableStudentTable from "@/components/projects/05-students/components/SortableStudentTable"
import StudentRemovalConfirmModal from "@/components/projects/05-students/components/StudentRemovalConfirmModal"
import { StudentStatisticsCards } from "@/components/projects/05-students/components/project-students-page/components/StudentStatisticsCards"
import { useProjectStudentsData } from "@/components/projects/05-students/components/project-students-page/hooks/useProjectStudentsData"
import { Button } from "@/components/ui/button"
import { Plus, Users } from "lucide-react"
import { useParams, useRouter } from "next/navigation"

export default function StudentsPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const {
    loading,
    students,
    classes,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedClassId,
    setSelectedClassId,
    showAddDialog,
    setShowAddDialog,
    showRemovalConfirm,
    setShowRemovalConfirm,
    studentsToRemove,
    setStudentsToRemove,
    selectedStudentsForRemoval,
    gradingDataInfo,
    refreshStudentData,
    updateStudentStatus,
    updateStudentOrders,
    handleStudentSelectionChange,
    handleSelectAll,
    initiateStudentRemoval,
    confirmStudentRemoval,
    filteredStudents,
    studentsForRemovalData,
  } = useProjectStudentsData({ projectId })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="受験生徒の管理" helpButton={helpButton}>
        <Button
          onClick={() =>
            router.push(`/projects/${projectId}/06-student-answers`)
          }
        >
          次へ: 生徒答案の追加と関連付け
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        {/* アクションボタンと統計カード */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            {selectedStudentsForRemoval.size > 0 && (
              <Button variant="destructive" onClick={initiateStudentRemoval}>
                <Users className="mr-2 h-4 w-4" />
                選択した生徒を削除 ({selectedStudentsForRemoval.size})
              </Button>
            )}
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              生徒を追加
            </Button>
          </div>
          <StudentStatisticsCards students={students} />
        </div>

        {/* 生徒一覧テーブル */}
        <div className="mb-6">
          <SortableStudentTable
            classes={classes}
            onStudentStatusUpdate={updateStudentStatus}
            onStudentOrderUpdate={updateStudentOrders}
            selectedStudents={selectedStudentsForRemoval}
            onStudentSelectionChange={handleStudentSelectionChange}
            onSelectAll={handleSelectAll}
            filteredStudents={filteredStudents}
            projectId={projectId}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedClassId={selectedClassId}
            onClassChange={setSelectedClassId}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
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
          onClose={() => {
            setShowRemovalConfirm(false)
            setStudentsToRemove([])
          }}
          onConfirm={confirmStudentRemoval}
          studentsToRemove={studentsForRemovalData}
          hasGradingData={gradingDataInfo.hasData}
          gradingDataCount={gradingDataInfo.totalItems}
        />
      </div>
    </div>
  )
}
