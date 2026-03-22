"use client"

import { Plus, Users } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { ClassExamManager } from "@/components/exams/05-students/components/ClassExamManager"
import { ClassStatisticsCards } from "@/components/exams/05-students/components/exam-students-page/components/ClassStatisticsCards"
import { StudentStatisticsCards } from "@/components/exams/05-students/components/exam-students-page/components/StudentStatisticsCards"
import { useExamStudentsData } from "@/components/exams/05-students/components/exam-students-page/hooks/useExamStudentsData"
import ExamStudentAddModal from "@/components/exams/05-students/components/ExamStudentAddModal"
import SortableStudentTable from "@/components/exams/05-students/components/SortableStudentTable"
import StudentRemovalConfirmModal from "@/components/exams/05-students/components/StudentRemovalConfirmModal"
import { useExamClasses } from "@/components/exams/05-students/hooks/useExamClasses"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function StudentsPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [activeTab, setActiveTab] = useState("students")
  const [showAddClassDialog, setShowAddClassDialog] = useState(false)

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
  } = useExamStudentsData({ examId })

  const {
    examClasses,
    loading: classesLoading,
    refresh: refreshExamClasses,
    removeClass,
    updateClass,
  } = useExamClasses({ examId })

  if (loading || classesLoading) {
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
          onClick={() => router.push(`/exams/${examId}/06-student-answers`)}
        >
          次へ: 生徒答案の追加と関連付け
        </Button>
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col px-6 pt-4"
      >
        {/* タブ・統計・アクションボタン */}
        <div className="mb-4 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="students" className="px-4">
              受験生徒一覧
            </TabsTrigger>
            <TabsTrigger value="classes" className="px-4">
              学級の関連付け
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            {activeTab === "students" ? (
              <>
                <StudentStatisticsCards students={students} />
                <div className="flex gap-2">
                  {selectedStudentsForRemoval.size > 0 && (
                    <Button
                      variant="destructive"
                      onClick={initiateStudentRemoval}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      選択した生徒を削除 ({selectedStudentsForRemoval.size})
                    </Button>
                  )}
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    生徒を追加
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ClassStatisticsCards examClasses={examClasses} />
                <Button onClick={() => setShowAddClassDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  学級を追加
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 受験生徒タブ */}
        <TabsContent value="students" className="flex-1 overflow-auto pb-6">
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
              examId={examId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedClassId={selectedClassId}
              onClassChange={setSelectedClassId}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
            />
          </div>
        </TabsContent>

        {/* 受験学級タブ */}
        <TabsContent value="classes" className="flex-1 overflow-auto pb-6">
          <ClassExamManager
            examId={examId}
            examClasses={examClasses}
            onRemoveClass={removeClass}
            onUpdateClass={updateClass}
            onClassesChanged={() => {
              refreshExamClasses()
              refreshStudentData()
            }}
            showAddDialog={showAddClassDialog}
            onShowAddDialogChange={setShowAddClassDialog}
          />
        </TabsContent>
      </Tabs>

      {/* 追加モーダル */}
      <ExamStudentAddModal
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        examId={examId}
        onStudentsAdded={() => {
          refreshStudentData()
          refreshExamClasses()
        }}
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
  )
}
