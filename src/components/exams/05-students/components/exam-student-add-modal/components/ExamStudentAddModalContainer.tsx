"use client"

import { Plus, UserPlus } from "lucide-react"

import { ClassSelectionTab } from "@/components/exams/05-students/components/exam-student-add-modal/components/ClassSelectionTab"
import { IndividualSelectionTab } from "@/components/exams/05-students/components/exam-student-add-modal/components/IndividualSelectionTab"
import { useExamStudentAddModal } from "@/components/exams/05-students/components/exam-student-add-modal/hooks/useExamStudentAddModal"
import type { ExamStudentAddModalProps } from "@/components/exams/05-students/components/exam-student-add-modal/types/examStudentAddTypes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ExamStudentAddModalContainer({
  isOpen,
  onClose,
  examId,
  onStudentsAdded,
}: ExamStudentAddModalProps) {
  const {
    activeTab,
    setActiveTab,
    availableClasses,
    searchTerm,
    setSearchTerm,
    filterClassId,
    setFilterClassId,
    loading,
    isAdding,
    filteredStudents,
    selectedClassCount,
    selectedStudentCount,
    handleClassSelection,
    handleClassReorder,
    handleStudentSelection,
    handleAddClassStudents,
    handleAddIndividualStudents,
    handleClose,
  } = useExamStudentAddModal({
    isOpen,
    examId,
    onStudentsAdded,
    onClose,
  })

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>受験生徒の追加</DialogTitle>
          <DialogDescription>
            学級単位での一括追加、または個別生徒の選択追加が可能です。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="classes">学級で追加</TabsTrigger>
              <TabsTrigger value="individuals">個別で追加</TabsTrigger>
            </TabsList>

            <ClassSelectionTab
              availableClasses={availableClasses}
              loading={loading}
              onClassSelection={handleClassSelection}
              onClassReorder={handleClassReorder}
            />

            <IndividualSelectionTab
              availableClasses={availableClasses}
              searchTerm={searchTerm}
              filterClassId={filterClassId}
              loading={loading}
              filteredStudents={filteredStudents}
              onSearchChange={setSearchTerm}
              onFilterClassChange={setFilterClassId}
              onStudentSelection={handleStudentSelection}
            />
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            キャンセル
          </Button>
          {activeTab === "classes" ? (
            <Button
              onClick={handleAddClassStudents}
              disabled={selectedClassCount === 0 || isAdding}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isAdding
                ? "追加中..."
                : `選択した学級を追加 (${selectedClassCount}学級)`}
            </Button>
          ) : (
            <Button
              onClick={handleAddIndividualStudents}
              disabled={selectedStudentCount === 0 || isAdding}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {isAdding
                ? "追加中..."
                : `選択した生徒を追加 (${selectedStudentCount}名)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
