"use client"

import ClassModal from "@/components/class/ClassModal"
import ClassStudentImportModal from "@/components/class/ClassStudentImportModal"
import MembershipTable from "@/components/class/MembershipTable"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useClassManagement, type Membership } from "@/hooks/useClassManagement"
import {
  ArrowLeft,
  Edit,
  Info,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
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
    membershipToEdit: _membershipToEdit,
    setMembershipToEdit,
    handleSaveClass,
    handleStudentImportSuccess,
    handleSaveMembership,
    handleDeleteMembership,
    handleBulkDeleteMemberships,
    handleDeleteClass,
  } = useClassManagement(classId)

  const handleEditMembership = (membership: Membership) => {
    // 生徒の個人ページへ遷移
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

  // 現在所属中かどうかを判定するヘルパー関数
  const isCurrentMembership = (m: { endDate?: Date | null }) => {
    if (!m.endDate) return true
    return new Date(m.endDate) >= new Date()
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px]" align="start" side="bottom">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-base font-semibold">
                        学級詳細ページ
                      </h3>
                    </div>
                    <p className="text-muted-foreground pl-7 text-sm">
                      このページでは、学級の情報と所属生徒を管理できます。
                    </p>
                  </div>

                  <div className="space-y-3 pl-7">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">主な操作：</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                            1
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">生徒を追加</p>
                            <p className="text-muted-foreground text-xs">
                              個別または一括で追加
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                            2
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">出席番号設定</p>
                            <p className="text-muted-foreground text-xs">
                              学級内の番号
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
                            3
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">所属期間管理</p>
                            <p className="text-muted-foreground text-xs">
                              開始日・終了日
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                            4
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">学級情報編集</p>
                            <p className="text-muted-foreground text-xs">
                              名称・コードなど
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                      <strong>一括インポート機能:</strong>
                      <br />
                      Excelファイルから生徒を一括で追加できます。
                      学籍番号、出席番号、所属期間をまとめて設定可能です。
                    </div>

                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                      <strong>注意:</strong>{" "}
                      学級を削除すると、所属情報も削除されます。
                      削除前に必ず確認してください。
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
              {
                classData.memberships.filter((m) => isCurrentMembership(m))
                  .length
              }
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
              {
                classData.memberships.filter((m) => !isCurrentMembership(m))
                  .length
              }
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
