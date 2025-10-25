/**
 * Components for 06-student-answers page - quick inline version
 */

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { StudentAnswerUpload } from "@/components/projects/06-student-answers/student-answer-management/components/StudentAnswerUpload"
import { ConfirmChangesModal } from "@/components/projects/06-student-answers/student-answer-table/components/ConfirmChangesModal"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  PendingChange,
  ScoringDataOption,
} from "@/types/student-answer.types"
import type { ProcessedStudentAnswer } from "@/components/projects/06-student-answers/student-answer-management/types"
import { Eye, FileEdit, Grid3X3 } from "lucide-react"

// Types
export type StudentAnswerTab = "new-grid" | "current"

export interface StudentData {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: "participating" | "expected" | "absent"
  customOrder?: number | null
}

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
  activeTab: StudentAnswerTab
  projectId: string
  students: StudentData[]
  modelAnswerCount: number
  studentAnswers: ProcessedStudentAnswer[]
  pendingChanges: PendingChange[]
  affectedCells: Set<string>
  onUploadComplete: () => void
  onStudentAnswerUpdate: () => void
  onUpdatePendingChanges: (
    changedFiles: Array<{ fileId: string; fromState: any; toState: any }>,
  ) => void
  isConfirmModalOpen: boolean
  onCloseConfirmModal: () => void
  onApplyChanges: (option: ScoringDataOption) => Promise<void>
  onResetChanges: () => Promise<void>
}

export function StudentAnswersTabContent({
  activeTab: _activeTab,
  projectId,
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
}: StudentAnswersTabContentProps) {
  return (
    <>
      <TabsContent value="new-grid" className="mt-3 p-3">
        <StudentAnswerUpload
          projectId={projectId}
          students={students}
          modelAnswerCount={modelAnswerCount}
          onUploadComplete={onUploadComplete}
          mode="upload"
          existingStudentAnswers={studentAnswers}
        />
      </TabsContent>

      <TabsContent value="current" className="mt-3 p-3">
        <StudentAnswerUpload
          projectId={projectId}
          students={students}
          modelAnswerCount={modelAnswerCount}
          onUploadComplete={onStudentAnswerUpdate}
          existingStudentAnswers={studentAnswers}
          mode="view"
          pendingChanges={pendingChanges}
          affectedCells={affectedCells}
          onUpdatePendingChanges={onUpdatePendingChanges}
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
