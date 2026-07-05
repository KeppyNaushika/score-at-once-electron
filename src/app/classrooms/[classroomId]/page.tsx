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

import { ClassroomScoreTrendChart } from "@/app/classrooms/[classroomId]/components/ClassroomScoreTrendChart"
import { ClassroomSummaryCards } from "@/app/classrooms/[classroomId]/components/ClassroomSummaryCards"
import { StudentInsightsCard } from "@/app/classrooms/[classroomId]/components/StudentInsightsCard"
import { useClassroomExamResults } from "@/app/classrooms/[classroomId]/hooks/useClassroomExamResults"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ClassroomModal from "@/components/classroom/ClassroomModal"
import ClassroomStudentImportModal from "@/components/classroom/ClassroomStudentImportModal"
import MembershipTable from "@/components/classroom/MembershipTable"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import StudentClassroomMembershipModal from "@/components/student/StudentClassroomMembershipModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type Membership,
  useClassroomManagement,
} from "@/hooks/useClassroomManagement"

export default function ClassroomDetailPage() {
  const params = useParams()
  const router = useRouter()
  const classroomId =
    typeof params.classroomId === "string" ? params.classroomId : ""

  const {
    loading,
    classroomData,
    students,
    isClassroomModalOpen,
    setIsClassroomModalOpen,
    isStudentImportModalOpen,
    setIsStudentImportModalOpen,
    isMembershipModalOpen,
    setIsMembershipModalOpen,
    membershipToEdit,
    setMembershipToEdit,
    handleSaveClassroom,
    handleStudentImportSuccess,
    handleSaveMembership,
    handleDeleteMembership,
    handleBulkDeleteMemberships,
    handleDeleteClassroom,
  } = useClassroomManagement(classroomId)

  const { studentResults, loading: analyticsLoading } =
    useClassroomExamResults(classroomId)

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
    await handleDeleteClassroom()
    router.push("/classrooms")
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

  if (!classroomData) {
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
            onClick={() => router.push("/classrooms")}
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
          title={classroomData.name}
          subtitle={
            <>
              {classroomData.classroomCode && (
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0.5 text-xs font-normal"
                >
                  {classroomData.classroomCode}
                </Badge>
              )}
              {classroomData.grade && (
                <span className="bg-muted/50 rounded px-2 py-0.5 text-xs">
                  {classroomData.grade}年
                </span>
              )}
              {classroomData.description && (
                <span>{classroomData.description}</span>
              )}
            </>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => router.push("/classrooms")}
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
            onClick={() => setIsClassroomModalOpen(true)}
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
                    <ClassroomSummaryCards studentResults={studentResults} />
                    <ClassroomScoreTrendChart studentResults={studentResults} />
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
                  memberships={classroomData.memberships}
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
        <ClassroomModal
          isOpen={isClassroomModalOpen}
          onClose={() => setIsClassroomModalOpen(false)}
          onSave={handleSaveClassroom}
          classroomToEdit={classroomData}
        />

        <ClassroomStudentImportModal
          isOpen={isStudentImportModalOpen}
          onClose={() => setIsStudentImportModalOpen(false)}
          onImportSuccess={handleStudentImportSuccess}
          classroomId={classroomId}
          className={classroomData?.name || ""}
        />

        <StudentClassroomMembershipModal
          isOpen={isMembershipModalOpen}
          onClose={() => setIsMembershipModalOpen(false)}
          onSave={handleSaveMembership}
          studentId={membershipToEdit?.studentId}
          classroomId={classroomId}
          availableStudents={students}
          availableClassrooms={[]}
          membershipToEdit={membershipToEdit}
        />
      </div>
    </ProtectedRoute>
  )
}
