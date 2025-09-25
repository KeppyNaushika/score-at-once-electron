"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import ProjectStudentAddModal from "@/components/projects/05-students/components/ProjectStudentAddModal"
import SortableStudentTable from "@/components/projects/05-students/components/SortableStudentTable"
import StudentRemovalConfirmModal from "@/components/projects/05-students/components/StudentRemovalConfirmModal"
import { StudentManagementHelp } from "@/components/projects/05-students/components/project-students-page/components/StudentManagementHelp"
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
      <PageHeader
        title="受験生徒の管理"
        helpButton={helpButton}
      >
        <div className="flex items-center gap-2">
          <StudentManagementHelp />
          <Button
            onClick={() =>
              router.push(`/projects/${projectId}/06-student-answers`)
            }
          >
            次へ: 6. 生徒解答
          </Button>
        </div>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        {/* アクションボタンと統計カード */}
        <div className="mb-6 flex flex-shrink-0 items-center justify-between">
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
        <div className="flex min-h-0 flex-1 flex-col">
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
