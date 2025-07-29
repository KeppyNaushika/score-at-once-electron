/**
 * Components for 06-answer-sheets page - quick inline version
 */

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import PageHeader from "@/components/layout/PageHeader"
import { AnswerSheetUpload } from "@/components/projects/06-answer-sheets/answer-sheet-management"
import { ConfirmChangesModal } from "@/components/projects/06-answer-sheets/answer-sheet-table/components/confirm-changes-modal"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  PendingChange,
  ScoringDataOption,
} from "@/types/answer-sheet.types"
import type { AnswerSheetWithDetails } from "@/types/electron"
import { Eye, FileEdit, Grid3X3 } from "lucide-react"
import { useRouter } from "next/navigation"

// Types
export type AnswerSheetTab = "new-grid" | "current"

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

interface AnswerSheetsPageHeaderProps {
  projectId: string
  pendingChangesCount: number
  helpButton: React.ReactNode
  onPendingChangesClick: () => void
}

export function AnswerSheetsPageHeader({
  projectId,
  pendingChangesCount,
  helpButton,
  onPendingChangesClick,
}: AnswerSheetsPageHeaderProps) {
  const router = useRouter()

  return (
    <PageHeader
      title="答案アップロード"
      description="生徒の答案画像をアップロードし、生徒と関連付けます"
      helpButton={helpButton}
    >
      <div className="flex gap-2">
        {pendingChangesCount > 0 && (
          <Button
            variant="default"
            onClick={onPendingChangesClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <FileEdit className="h-4 w-4" />
            {pendingChangesCount}件の変更を反映
          </Button>
        )}
        <Button
          onClick={() => router.push(`/projects/${projectId}/07-score-at-once`)}
        >
          次へ: 採点開始
        </Button>
      </div>
    </PageHeader>
  )
}

interface AnswerSheetsTabsNavigationProps {
  activeTab: AnswerSheetTab
  onTabChange: (tab: string) => void
  children: React.ReactNode
}

export function AnswerSheetsTabsNavigation({
  activeTab,
  onTabChange,
  children,
}: AnswerSheetsTabsNavigationProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
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
      {children}
    </Tabs>
  )
}

interface AnswerSheetsTabContentProps {
  activeTab: AnswerSheetTab
  projectId: string
  students: StudentData[]
  masterImageCount: number
  answerSheets: AnswerSheetWithDetails[]
  pendingChanges: PendingChange[]
  affectedCells: Set<string>
  onUploadComplete: () => void
  onAnswerSheetUpdate: () => void
  onUpdatePendingChanges: (
    changedFiles: Array<{ fileId: string; fromState: any; toState: any }>,
  ) => void
  isConfirmModalOpen: boolean
  onCloseConfirmModal: () => void
  onApplyChanges: (option: ScoringDataOption) => Promise<void>
  onResetChanges: () => Promise<void>
}

export function AnswerSheetsTabContent({
  activeTab: _activeTab,
  projectId,
  students,
  masterImageCount,
  answerSheets,
  pendingChanges,
  affectedCells,
  onUploadComplete,
  onAnswerSheetUpdate,
  onUpdatePendingChanges,
  isConfirmModalOpen,
  onCloseConfirmModal,
  onApplyChanges,
  onResetChanges,
}: AnswerSheetsTabContentProps) {
  // resetFnは不要！リセットも反映もDB再読み込みで解決
  return (
    <>
      <TabsContent value="new-grid" className="mt-3 min-h-0 flex-1 p-3">
        <AnswerSheetUpload
          projectId={projectId}
          students={students}
          masterImageCount={masterImageCount}
          onUploadComplete={onUploadComplete}
          mode="upload"
          existingAnswerSheets={answerSheets}
        />
      </TabsContent>

      <TabsContent value="current" className="mt-3 min-h-0 flex-1 p-3">
        <AnswerSheetUpload
          projectId={projectId}
          students={students}
          masterImageCount={masterImageCount}
          onUploadComplete={onAnswerSheetUpdate}
          existingAnswerSheets={answerSheets}
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
