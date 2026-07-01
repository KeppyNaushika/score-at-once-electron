"use client"

import {
  ArrowLeft,
  BarChart3,
  Edit,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"

import { ClassScoreTrendChart } from "@/app/classes/[classId]/components/ClassScoreTrendChart"
import { ClassSummaryCards } from "@/app/classes/[classId]/components/ClassSummaryCards"
import { StudentInsightsCard } from "@/app/classes/[classId]/components/StudentInsightsCard"
import { useClassExamResults } from "@/app/classes/[classId]/hooks/useClassExamResults"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ClassModal from "@/components/class/ClassModal"
import ClassStudentImportModal from "@/components/class/ClassStudentImportModal"
import MembershipTable from "@/components/class/MembershipTable"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type Membership, useClassManagement } from "@/hooks/useClassManagement"

export default function ClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const classId = typeof params.classId === "string" ? params.classId : ""

  const {
    loading,
    classData,
    students,
    isClassModalOpen,
    setIsClassModalOpen,
    isStudentImportModalOpen,
    setIsStudentImportModalOpen,
    isMembershipModalOpen,
    setIsMembershipModalOpen,
    membershipToEdit,
    setMembershipToEdit,
    handleSaveClass,
    handleStudentImportSuccess,
    handleSaveMembership,
    handleDeleteMembership,
    handleBulkDeleteMemberships,
    handleDeleteClass,
  } = useClassManagement(classId)

  const { studentResults, loading: analyticsLoading } =
    useClassExamResults(classId)

  const handleEditMembership = (membership: Membership) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
  }

  const handleViewStudent = (membership: Membership) => {
    router.push(`/students/${membership.student.id}`)
  }

  const handleAddMembership = () => {
    setMembershipToEdit(null)
    setIsMembershipModalOpen(true)
  }

  const handleDeleteWithNavigation = async () => {
    await handleDeleteClass()
    router.push("/classes")
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-2 text-lg font-medium">学級が見つかりません</p>
          <p className="text-muted-foreground mb-4 text-sm">
            指定された学級が存在しないか、削除されています。
          </p>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => router.push("/classes")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            学級一覧に戻る
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader
          title={classData.name}
          subtitle={
            <>
              {classData.classCode && (
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0.5 text-xs font-normal"
                >
                  {classData.classCode}
                </Badge>
              )}
              {classData.grade && (
                <span className="bg-muted/50 rounded px-2 py-0.5 text-xs">
                  {classData.grade}年
                </span>
              )}
              {classData.description && <span>{classData.description}</span>}
            </>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => router.push("/classes")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Button>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={handleAddMembership}
          >
            <Plus className="mr-2 h-4 w-4" />
            生徒を追加
          </Button>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => setIsStudentImportModalOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Excel 貼付一括追加
          </Button>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => setIsClassModalOpen(true)}
          >
            <Edit className="mr-2 h-4 w-4" />
            編集
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
            onClick={handleDeleteWithNavigation}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            削除
          </Button>
        </PageHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="container mx-auto max-w-6xl px-6 py-6">
            <Tabs defaultValue="analytics">
              <TabsList className="mb-6 w-full">
                <TabsTrigger value="analytics" className="flex-1">
                  <BarChart3 className="mr-1.5 h-4 w-4" />
                  成績分析
                </TabsTrigger>
                <TabsTrigger value="membership" className="flex-1">
                  <Users className="mr-1.5 h-4 w-4" />
                  所属管理
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics">
                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <LoadingSpinner />
                  </div>
                ) : studentResults.length > 0 ? (
                  <>
                    <ClassSummaryCards studentResults={studentResults} />
                    <ClassScoreTrendChart studentResults={studentResults} />
                    <StudentInsightsCard studentResults={studentResults} />
                  </>
                ) : (
                  <div className="text-muted-foreground py-16 text-center text-sm">
                    所属生徒がいないか、採点済みの試験がありません
                  </div>
                )}
              </TabsContent>

              <TabsContent value="membership">
                <MembershipTable
                  memberships={classData.memberships}
                  onEdit={handleEditMembership}
                  onViewStudent={handleViewStudent}
                  onDelete={handleDeleteMembership}
                  onBulkDelete={handleBulkDeleteMemberships}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* モーダル */}
        <ClassModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          onSave={handleSaveClass}
          classToEdit={classData}
        />

        <ClassStudentImportModal
          isOpen={isStudentImportModalOpen}
          onClose={() => setIsStudentImportModalOpen(false)}
          onImportSuccess={handleStudentImportSuccess}
          classroomId={classId}
          className={classData?.name || ""}
        />

        <StudentClassMembershipModal
          isOpen={isMembershipModalOpen}
          onClose={() => setIsMembershipModalOpen(false)}
          onSave={handleSaveMembership}
          studentId={membershipToEdit?.studentId}
          classroomId={classId}
          availableStudents={students}
          availableClasses={[]}
          membershipToEdit={membershipToEdit}
        />
      </div>
    </ProtectedRoute>
  )
}
