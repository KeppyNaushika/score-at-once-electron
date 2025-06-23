"use client"

import MembershipTable from "@/components/class/MembershipTable"
import ClassModal from "@/components/student/ClassModal"
import ClassStudentImportModal from "@/components/student/ClassStudentImportModal"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useClassManagement, type Membership } from "@/hooks/useClassManagement"
import { ArrowLeft, Edit, Plus, Trash2, Upload } from "lucide-react"
import { useParams, useRouter } from "next/navigation"

export default function ClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

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
    handleEndMembership,
    handleDeleteClass,
  } = useClassManagement(classId)

  const handleEditMembership = (membership: Membership) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
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
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">
              学級が見つかりません
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/classes")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              学級一覧に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/classes")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              戻る
            </Button>
            <h1 className="text-3xl font-bold">{classData.name}</h1>
          </div>
          {classData.description && (
            <p className="text-muted-foreground">{classData.description}</p>
          )}
          <div className="mt-2 flex gap-2">
            {classData.classCode && (
              <span className="bg-muted rounded px-2 py-1 text-sm">
                コード: {classData.classCode}
              </span>
            )}
            {classData.grade && (
              <span className="bg-muted rounded px-2 py-1 text-sm">
                学年: {classData.grade}
              </span>
            )}
            {classData.subject && (
              <span className="bg-muted rounded px-2 py-1 text-sm">
                教科: {classData.subject}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsStudentImportModalOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            生徒インポート
          </Button>
          <Button onClick={handleAddMembership}>
            <Plus className="mr-2 h-4 w-4" />
            生徒を追加
          </Button>
          <Button variant="outline" onClick={() => setIsClassModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            編集
          </Button>
          <Button variant="destructive" onClick={handleDeleteWithNavigation}>
            <Trash2 className="mr-2 h-4 w-4" />
            削除
          </Button>
        </div>
      </div>

      {/* 統計カード */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              総生徒数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classData.memberships.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              現在の所属
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {classData.memberships.filter((m) => !m.endDate).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              終了した所属
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {classData.memberships.filter((m) => m.endDate).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 所属一覧 */}
      <MembershipTable
        memberships={classData.memberships}
        onEdit={handleEditMembership}
        onEnd={handleEndMembership}
      />

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
  )
}
