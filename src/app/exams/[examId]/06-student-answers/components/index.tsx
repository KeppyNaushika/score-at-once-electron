/**
 * Components for 06-student-answers page - quick inline version
 */

import { Eye, Grid3X3 } from "lucide-react"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { StudentAnswerUpload } from "@/components/exams/06-student-answers/student-answer-management/components/StudentAnswerUpload"
import type { ProcessedStudentAnswer } from "@/components/exams/06-student-answers/student-answer-management/types"
import { ConfirmChangesModal } from "@/components/exams/06-student-answers/student-answer-table/components/ConfirmChangesModal"
import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  PendingChange,
  ScoringDataOption,
} from "@/components/exams/06-student-answers/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ExamStudentWithDetails } from "@/types/prismaExtensions"

// Types
export type StudentAnswerTab = "new-grid" | "current"

// Components
export function LoadingSpinner() {
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

interface StudentAnswersTabsNavigationProps {
  activeTab: StudentAnswerTab
  onTabChange: (tab: string) => void
  children: React.ReactNode
}

export function StudentAnswersTabsNavigation({
  activeTab,
  onTabChange,
  children,
}: StudentAnswersTabsNavigationProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="flex flex-col"
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
      {children}
    </Tabs>
  )
}

interface StudentAnswersTabContentProps {
  examId: string
  students: ExamStudentWithDetails[]
  modelAnswerCount: number
  studentAnswers: ProcessedStudentAnswer[]
  pendingChanges: PendingChange[]
  affectedCells: Set<string>
  onUploadComplete: () => void
  onStudentAnswerUpdate: () => void
  onUpdatePendingChanges: (
    changedFiles: Array<{
      fileId: string
      fromState: FileState
      toState: FileState
    }>
  ) => void
  isConfirmModalOpen: boolean
  onCloseConfirmModal: () => void
  onApplyChanges: (option: ScoringDataOption) => Promise<void>
  onResetChanges: () => Promise<void>
  onUploadFileCountChange?: (count: number) => void
  correctionStatusMap?: Map<string, "corrected" | "skipped">
  onCorrectionStatusUpdate?: (map: Map<string, "corrected" | "skipped">) => void
}

export function StudentAnswersTabContent({
  examId,
  students,
  modelAnswerCount,
  studentAnswers,
  pendingChanges,
  affectedCells,
  onUploadComplete,
  onStudentAnswerUpdate,
  onUpdatePendingChanges,
  isConfirmModalOpen,
  onCloseConfirmModal,
  onApplyChanges,
  onResetChanges,
  onUploadFileCountChange,
  correctionStatusMap,
  onCorrectionStatusUpdate,
}: StudentAnswersTabContentProps) {
  return (
    <>
      <TabsContent value="new-grid" className="mt-3 p-3">
        <StudentAnswerUpload
          examId={examId}
          students={students}
          modelAnswerCount={modelAnswerCount}
          onUploadComplete={onUploadComplete}
          mode="upload"
          existingStudentAnswers={studentAnswers}
          onUploadFileCountChange={onUploadFileCountChange}
          onCorrectionStatusUpdate={onCorrectionStatusUpdate}
        />
      </TabsContent>

      <TabsContent value="current" className="mt-3 p-3">
        <StudentAnswerUpload
          examId={examId}
          students={students}
          modelAnswerCount={modelAnswerCount}
          onUploadComplete={onStudentAnswerUpdate}
          existingStudentAnswers={studentAnswers}
          mode="view"
          pendingChanges={pendingChanges}
          affectedCells={affectedCells}
          onUpdatePendingChanges={onUpdatePendingChanges}
          correctionStatusMap={correctionStatusMap}
        />
      </TabsContent>

      {/* Confirm Changes Modal - only for current tab */}
      <ConfirmChangesModal
        isOpen={isConfirmModalOpen}
        onClose={onCloseConfirmModal}
        pendingChanges={pendingChanges}
        onConfirm={onApplyChanges}
        onReset={onResetChanges}
      />
    </>
  )
}
