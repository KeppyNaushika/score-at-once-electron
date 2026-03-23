"use client"

import { ArrowLeft, Edit, Plus, Trash2, Upload } from "lucide-react"
import { useParams, useRouter } from "next/navigation"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ClassModal from "@/components/class/ClassModal"
import ClassStudentImportModal from "@/components/class/ClassStudentImportModal"
import MembershipTable from "@/components/class/MembershipTable"
import PageHeader from "@/components/layout/PageHeader"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    setMembershipToEdit,
    handleSaveClass,
    handleStudentImportSuccess,
    handleSaveMembership,
    handleDeleteMembership,
    handleBulkDeleteMemberships,
    handleDeleteClass,
  } = useClassManagement(classId)

  const handleEditMembership = (membership: Membership) => {
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

  const isCurrentMembership = (m: { endDate?: Date | null }) => {
    if (!m.endDate) return true
    return new Date(m.endDate) >= new Date()
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
        <PageHeader title={classData.name}>
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

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto max-w-6xl px-6 py-6">
            {/* 学級情報 */}
            <Card className="border-border/50 mb-8 shadow-sm">
              <CardHeader>
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    {classData.name}
                  </CardTitle>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {classData.classCode && (
                      <Badge
                        variant="outline"
                        className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                      >
                        {classData.classCode}
                      </Badge>
                    )}
                    {classData.grade && (
                      <span className="bg-muted/50 rounded-lg px-2.5 py-1 text-sm">
                        {classData.grade}年
                      </span>
                    )}
                  </div>
                  {classData.description && (
                    <p className="text-muted-foreground mt-3">
                      {classData.description}
                    </p>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* 統計カード */}
            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    総生徒数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tabular-nums">
                    {classData.memberships.length}
                    <span className="text-muted-foreground ml-1 text-lg font-normal">
                      名
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    現在の所属
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 tabular-nums">
                    {
                      classData.memberships.filter((m) =>
                        isCurrentMembership(m)
                      ).length
                    }
                    <span className="ml-1 text-lg font-normal text-green-600/70">
                      名
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    終了した所属
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-500 tabular-nums">
                    {
                      classData.memberships.filter(
                        (m) => !isCurrentMembership(m)
                      ).length
                    }
                    <span className="ml-1 text-lg font-normal text-gray-400">
                      名
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 所属一覧 */}
            <MembershipTable
              memberships={classData.memberships}
              onEdit={handleEditMembership}
              onDelete={handleDeleteMembership}
              onBulkDelete={handleBulkDeleteMemberships}
            />
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
          classId={classId}
          className={classData?.name || ""}
        />

        <StudentClassMembershipModal
          isOpen={isMembershipModalOpen}
          onClose={() => setIsMembershipModalOpen(false)}
          onSave={handleSaveMembership}
          classId={classId}
          availableStudents={students}
          availableClasses={[]}
        />
      </div>
    </ProtectedRoute>
  )
}
