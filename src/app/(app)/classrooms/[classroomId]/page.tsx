"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  BarChart3,
  Edit,
  History,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import { ClassroomScoreTrendChart } from "@/app/(app)/classrooms/[classroomId]/components/ClassroomScoreTrendChart"
import { ClassroomSummaryCards } from "@/app/(app)/classrooms/[classroomId]/components/ClassroomSummaryCards"
import { StudentInsightsCard } from "@/app/(app)/classrooms/[classroomId]/components/StudentInsightsCard"
import { useClassroomExamResults } from "@/app/(app)/classrooms/[classroomId]/hooks/useClassroomExamResults"
import ClassroomModal from "@/components/classroom/ClassroomModal"
import ClassroomStudentImportModal from "@/components/classroom/ClassroomStudentImportModal"
import { MembershipStatusToggle } from "@/components/classroom/MembershipStatusToggle"
import MembershipTable from "@/components/classroom/MembershipTable"
import ConfirmationModal from "@/components/common/ConfirmationModal"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import StudentClassroomMembershipModal from "@/components/student/StudentClassroomMembershipModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNavigationGuardContext } from "@/contexts/NavigationGuardContext"
import { auditLogsHrefOfScope } from "@/lib/auditLogFilterQuery"
import type { MembershipStatusFilter } from "@/lib/membership"
import {
  addStudentToClassroomMutation,
  classroomListQuery,
  deleteClassroomMutation,
  deleteStudentMembershipMutation,
  endStudentMembershipMutation,
  studentListQuery,
  updateClassroomMutation,
  updateStudentMembershipMutation,
} from "@/queries/student"
import type {
  ClassroomMembership,
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: ClassroomWithMemberships[] = []
const EMPTY_STUDENTS: StudentWithMemberships[] = []

export default function ClassroomDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { guardedNavigate } = useNavigationGuardContext()
  const classroomId =
    typeof params.classroomId === "string" ? params.classroomId : ""

  const { data: classrooms = EMPTY_CLASSROOMS, isPending: loading } =
    useQuery(classroomListQuery())
  const { data: students = EMPTY_STUDENTS } = useQuery(studentListQuery())
  const classroomData =
    classrooms.find((classroom) => classroom.id === classroomId) ?? null

  const updateClassroom = useMutation(updateClassroomMutation())
  const deleteClassroom = useMutation(deleteClassroomMutation())
  const addStudentToClassroom = useMutation(addStudentToClassroomMutation())
  const updateMembership = useMutation(updateStudentMembershipMutation())
  const deleteMembership = useMutation(deleteStudentMembershipMutation())
  const endMembership = useMutation(endStudentMembershipMutation())

  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false)
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] =
    useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] =
    useState<ClassroomMembership | null>(null)
  const [membershipIdToDelete, setMembershipIdToDelete] = useState<
    string | null
  >(null)
  const [isDeleteClassroomConfirmOpen, setIsDeleteClassroomConfirmOpen] =
    useState(false)

  const handleSaveClassroom = async (
    classroomInfo: Partial<ClassroomWithMemberships>
  ) => {
    await updateClassroom.mutateAsync({
      id: classroomId,
      name: classroomInfo.name,
      classroomCode: classroomInfo.classroomCode,
      grade: classroomInfo.grade,
      description: classroomInfo.description,
      isVisible: classroomInfo.isVisible,
    })
    setIsClassroomModalOpen(false)
  }

  const handleStudentImportSuccess = () => {
    setIsStudentImportModalOpen(false)
  }

  const handleSaveMembership = async (
    membershipData: Partial<ClassroomMembership> & { studentId?: string }
  ) => {
    if (membershipToEdit) {
      // 空欄は null で明示的にクリアする（undefined はPrismaでは「変更しない」）。
      // startDate は必須項目のため、未指定時は既存値を維持する（undefined のまま）。
      await updateMembership.mutateAsync({
        id: membershipToEdit.id,
        membership: {
          attendanceNumber: membershipData.attendanceNumber ?? null,
          notes: membershipData.notes ?? null,
          startDate: membershipData.startDate,
          endDate: membershipData.endDate ?? null,
        },
      })
    } else if (membershipData.studentId) {
      const membership = await addStudentToClassroom.mutateAsync({
        studentId: membershipData.studentId,
        classroomId,
        startDate: membershipData.startDate ?? undefined,
        attendanceNumber: membershipData.attendanceNumber ?? undefined,
        notes: membershipData.notes ?? undefined,
      })
      // 終了日が指定されている場合は所属を終了
      if (membershipData.endDate) {
        await endMembership.mutateAsync({
          membershipId: membership.id,
          endDate: new Date(membershipData.endDate),
        })
      }
    }
    setIsMembershipModalOpen(false)
  }

  const handleDeleteMembership = (membershipId: string) => {
    setMembershipIdToDelete(membershipId)
  }

  const handleConfirmDeleteMembership = () => {
    if (membershipIdToDelete === null) return
    deleteMembership.mutate(membershipIdToDelete)
    setMembershipIdToDelete(null)
  }

  const handleBulkDeleteMemberships = async (membershipIds: string[]) => {
    try {
      for (const membershipId of membershipIds) {
        await deleteMembership.mutateAsync(membershipId)
      }
    } catch {
      // 1件でも失敗したらそこで止める。知らせは中央のトーストが出す。
      // 受け止めないと未処理の rejection になり、**残りの id が黙って飛ばされる**
    }
  }

  /**
   * 学級を消す。**消せたかどうかを返す。**
   *
   * 投げっぱなしにすると、呼ぶ側が `await` しても待ったことにならず、外部キーや
   * 権限で失敗しても一覧へ遷移して「消えていない学級」が並ぶ。
   */
  const handleDeleteClassroom = async (): Promise<boolean> => {
    try {
      await deleteClassroom.mutateAsync(classroomId)
      return true
    } catch {
      // 知らせは中央のトーストが出す。ここでは遷移させないことだけを伝える
      return false
    }
  }

  // 成績分析と所属管理で共通の絞り込み
  const [statusFilter, setStatusFilter] =
    useState<MembershipStatusFilter>("all")
  const { studentResults, loading: analyticsLoading } = useClassroomExamResults(
    classroomId,
    statusFilter
  )

  const handleEditMembership = (membership: ClassroomMembership) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
  }

  const handleViewStudent = (membership: ClassroomMembership) => {
    router.push(`/students/${membership.student.id}`)
  }

  const handleAddMembership = () => {
    setMembershipToEdit(null)
    setIsMembershipModalOpen(true)
  }

  const handleDeleteWithNavigation = async () => {
    if (!(await handleDeleteClassroom())) return
    router.push("/classrooms")
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto size-12 text-primary" />
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!classroomData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-2 text-lg font-medium">学級が見つかりません</p>
          <p className="mb-4 text-sm text-muted-foreground">
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

  const toolbarActions: ToolbarAction[] = [
    toolbarButtonAction({
      id: "add-student",
      priority: 80,
      icon: Plus,
      label: "生徒を追加",
      onClick: handleAddMembership,
    }),
    toolbarButtonAction({
      id: "spreadsheet-import",
      priority: 70,
      icon: Upload,
      label: "Excel 貼付一括追加",
      onClick: () => setIsStudentImportModalOpen(true),
    }),
    toolbarButtonAction({
      id: "edit",
      priority: 60,
      icon: Edit,
      label: "編集",
      onClick: () => setIsClassroomModalOpen(true),
    }),
    toolbarButtonAction({
      id: "audit-log",
      priority: 20,
      icon: History,
      label: "操作履歴",
      onClick: () =>
        guardedNavigate(auditLogsHrefOfScope(classroomId, classroomData.name)),
    }),
    {
      id: "delete",
      priority: 10,
      node: (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setIsDeleteClassroomConfirmOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          削除
        </Button>
      ),
      collapsedNode: (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setIsDeleteClassroomConfirmOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          削除
        </Button>
      ),
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        listHref="/classrooms"
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
              <span className="rounded bg-muted/50 px-2 py-0.5 text-xs">
                {classroomData.grade}年
              </span>
            )}
            {classroomData.description && (
              <span>{classroomData.description}</span>
            )}
          </>
        }
        actions={toolbarActions}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="container mx-auto max-w-6xl px-6 py-6">
          <Tabs defaultValue="analytics">
            <div className="mb-6 flex items-center gap-4">
              <TabsList className="flex-1">
                <TabsTrigger value="analytics" className="flex-1">
                  <BarChart3 className="mr-1.5 h-4 w-4" />
                  成績分析
                </TabsTrigger>
                <TabsTrigger value="membership" className="flex-1">
                  <Users className="mr-1.5 h-4 w-4" />
                  所属管理
                </TabsTrigger>
              </TabsList>
              <MembershipStatusToggle
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>

            <TabsContent value="analytics">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Spinner className="size-6" />
                </div>
              ) : studentResults.length > 0 ? (
                <>
                  <ClassroomSummaryCards studentResults={studentResults} />
                  <ClassroomScoreTrendChart studentResults={studentResults} />
                  <StudentInsightsCard studentResults={studentResults} />
                </>
              ) : (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  所属生徒がいないか、採点済みの試験がありません
                </div>
              )}
            </TabsContent>

            <TabsContent value="membership">
              <MembershipTable
                memberships={classroomData.memberships}
                statusFilter={statusFilter}
                onEdit={handleEditMembership}
                onViewStudent={handleViewStudent}
                onDelete={handleDeleteMembership}
                onBulkDelete={handleBulkDeleteMemberships}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* モーダル（閉じている間はマウントしない。開くたびにフォームを作り直す） */}
      {isClassroomModalOpen && (
        <ClassroomModal
          isOpen={isClassroomModalOpen}
          onClose={() => setIsClassroomModalOpen(false)}
          onSave={handleSaveClassroom}
          classroomToEdit={classroomData}
        />
      )}

      {/* 入力途中の表を開き直しても保つため、閉じてもマウントしたままにする */}
      <ClassroomStudentImportModal
        isOpen={isStudentImportModalOpen}
        onClose={() => setIsStudentImportModalOpen(false)}
        onImportSuccess={handleStudentImportSuccess}
        classroomId={classroomId}
        className={classroomData?.name || ""}
      />

      {isMembershipModalOpen && (
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
      )}

      <ConfirmationModal
        open={membershipIdToDelete !== null}
        onClose={() => setMembershipIdToDelete(null)}
        title="この所属関係を削除しますか？"
        confirmText="削除"
        variant="destructive"
        icon="trash"
        onConfirm={handleConfirmDeleteMembership}
      />

      <ConfirmationModal
        open={isDeleteClassroomConfirmOpen}
        onClose={() => setIsDeleteClassroomConfirmOpen(false)}
        title="この学級を削除しますか？"
        confirmText="削除"
        variant="destructive"
        icon="trash"
        loading={deleteClassroom.isPending}
        onConfirm={handleDeleteWithNavigation}
      />
    </div>
  )
}
