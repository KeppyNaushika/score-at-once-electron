"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

import {
  type ClassroomRosterEntry,
  ClassroomRosterManager,
} from "@/components/common/classroom-roster"
import {
  type RosterClassroomOption,
  type RosterRow,
  RosterTable,
  type RosterTableAdapter,
  type RosterTableHandle,
} from "@/components/common/roster-table"
import { StudentAddPanel } from "@/components/common/student-add-panel/components/StudentAddPanel"
import type {
  AddPanelClassroomItem,
  AddPanelStudentItem,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types"
import { Button } from "@/components/ui/button"
import {
  addStudentsFromClassroomMutation,
  addStudentsToGradeMutation,
  gradeAvailableClassroomsQuery,
  gradeAvailableStudentsQuery,
  type GradeClassroomRow,
  gradeClassroomsQuery,
  gradeStudentsQuery,
  previewGradeClassroomRemovalMutation,
  removeGradeClassroomMutation,
  setGradeClassroomOrdersMutation,
  updateGradeStudentOrdersMutation,
} from "@/queries/grade"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: GradeClassroomRow[] = []

interface StudentsContainerProps {
  gradeId: string
}

/**
 * 成績算出試験の生徒管理コンテナ
 *
 * 学級の追加/削除と、共通 roster-table による対象生徒一覧の並び替えを提供する。
 */
export function StudentsContainer({ gradeId }: StudentsContainerProps) {
  const queryClient = useQueryClient()
  const { data: classrooms = EMPTY_CLASSROOMS } = useQuery(
    gradeClassroomsQuery(gradeId)
  )
  // 名簿の一般UI（RosterTable / StudentAddPanel / ClassroomRosterManager）は
  // 「何の名簿か」を知らない。書き込みの定義はこのコンテナが持ち、UI へは
  // 呼び出しだけを渡す（UI 側から DB を触らせない）。
  const updateStudentOrders = useMutation(
    updateGradeStudentOrdersMutation(gradeId)
  )
  const addStudentsFromClassroom = useMutation(
    addStudentsFromClassroomMutation(gradeId)
  )
  const addStudents = useMutation(addStudentsToGradeMutation(gradeId))
  const setClassroomOrders = useMutation(
    setGradeClassroomOrdersMutation(gradeId)
  )
  const removeClassroom = useMutation(removeGradeClassroomMutation(gradeId))
  const previewRemoval = useMutation(
    previewGradeClassroomRemovalMutation(gradeId)
  )
  const [studentCount, setStudentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rosterHandle, setRosterHandle] = useState<RosterTableHandle | null>(
    null
  )

  // 名簿テーブルのアダプター（成績）
  const rosterAdapter = useMemo<RosterTableAdapter>(
    () => ({
      fetchRows: async () => {
        const [gradeClassrooms, gradeStudents] = await Promise.all([
          queryClient.fetchQuery(gradeClassroomsQuery(gradeId)),
          queryClient.fetchQuery(gradeStudentsQuery(gradeId)),
        ])
        const classroomOrderMap = new Map(
          gradeClassrooms.map((gradeClassroom) => [
            gradeClassroom.classroomId,
            gradeClassroom.order,
          ])
        )
        const registeredClassroomIds = new Set(classroomOrderMap.keys())
        return gradeStudents.map((examStudent): RosterRow => {
          const membership = examStudent.student.memberships.find(
            (membership) => registeredClassroomIds.has(membership.classroomId)
          )
          return {
            id: examStudent.studentId,
            studentNumber: examStudent.student.studentNumber,
            lastName: examStudent.student.lastName,
            firstName: examStudent.student.firstName,
            kana: "",
            classroomInfo: {
              className: membership?.classroom.name ?? null,
              attendanceNumber: membership?.attendanceNumber ?? null,
              classroomOrder: membership
                ? (classroomOrderMap.get(membership.classroomId) ?? null)
                : null,
            },
            customOrder: examStudent.customOrder,
          }
        })
      },
      fetchClassrooms: async () => {
        const gradeClassrooms = await queryClient.fetchQuery(
          gradeClassroomsQuery(gradeId)
        )
        return gradeClassrooms.map((gradeClassroom): RosterClassroomOption => ({
          id: gradeClassroom.classroomId,
          name: gradeClassroom.className,
        }))
      },
      updateRowOrder: async (rowOrders) => {
        await updateStudentOrders.mutateAsync(rowOrders)
      },
      removeRows: async () => {
        // 成績画面では生徒個別の削除はサポートしない（学級単位で管理）
      },
    }),
    [gradeId, queryClient, updateStudentOrders]
  )

  // 生徒追加パネルのアダプター（成績）
  const addPanelAdapter = useMemo<StudentAddPanelAdapter>(
    () => ({
      fetchAvailableClassrooms: async (activeOnly) => {
        const classrooms = await queryClient.fetchQuery(
          gradeAvailableClassroomsQuery(gradeId, activeOnly)
        )
        return classrooms.map((classroom): AddPanelClassroomItem => ({
          id: classroom.id,
          name: classroom.name,
          studentCount: classroom.studentCount,
          studentNames: classroom.studentNames,
        }))
      },
      fetchAvailableStudents: async (activeOnly) => {
        const students = await queryClient.fetchQuery(
          gradeAvailableStudentsQuery(gradeId, activeOnly)
        )
        return students.map((student): AddPanelStudentItem => ({
          id: student.id,
          studentNumber: student.studentNumber,
          lastName: student.lastName,
          firstName: student.firstName,
          lastNameKana: student.lastNameKana,
          firstNameKana: student.firstNameKana,
          memberships: student.memberships.map((membership) => ({
            attendanceNumber: membership.attendanceNumber,
            classroom: {
              id: membership.classroom.id,
              name: membership.classroom.name,
            },
          })),
        }))
      },
      addClassrooms: async (orderedClassroomIds, activeOnly) => {
        for (const classroomId of orderedClassroomIds) {
          await addStudentsFromClassroom.mutateAsync({
            classroomId,
            activeOnly,
          })
        }
      },
      addStudents: async (studentIds) => {
        await addStudents.mutateAsync(studentIds)
      },
    }),
    [gradeId, queryClient, addStudentsFromClassroom, addStudents]
  )

  const reloadAll = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: gradeClassroomsQuery(gradeId).queryKey,
    })
    await rosterHandle?.refresh()
  }, [queryClient, gradeId, rosterHandle])

  const classroomEntries = useMemo<ClassroomRosterEntry[]>(
    () =>
      classrooms.map((gradeClassroom) => ({
        id: gradeClassroom.classroomId,
        classroomId: gradeClassroom.classroomId,
        name: gradeClassroom.className,
        studentCount: gradeClassroom.studentCount,
        order: gradeClassroom.order,
      })),
    [classrooms]
  )

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">生徒管理</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        成績算出の対象生徒を学級単位で追加してください。ドラッグで並び替えできます。
      </p>

      {/* 生徒追加（学級まるごと・個別） */}
      <div className="mb-6 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">生徒を追加</h3>
        <StudentAddPanel adapter={addPanelAdapter} onAdded={reloadAll} />
      </div>

      {/* 登録済み学級（並び替え・削除） */}
      {classrooms.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium">登録済み学級</h3>
          <ClassroomRosterManager
            entries={classroomEntries}
            removalMode="can-delete-students"
            description="ドラッグで並び替えできます。学級を外すときは、専属生徒を残すか削除するか選べます。"
            deletionLosses={[
              "この成績で確定（凍結）した成績値",
              "手動で上書きした評定",
              "評価項目ごとの除外設定",
            ]}
            // 失敗は例外で伝わり、ClassroomRosterManager の楽観更新がロールバックする
            onReorder={async (orderedClassroomIds) => {
              await setClassroomOrders.mutateAsync(orderedClassroomIds)
            }}
            fetchRemovalPreview={async (entry) => {
              const result = await previewRemoval.mutateAsync(entry.classroomId)
              return { exclusiveCount: result.exclusiveCount }
            }}
            // 失敗は例外で伝わり、ダイアログが成功扱いで閉じない
            onRemove={async (entry, deleteStudents) => {
              await removeClassroom.mutateAsync({
                classroomId: entry.classroomId,
                removeStudents: deleteStudents,
              })
            }}
            onChanged={reloadAll}
          />
        </div>
      )}

      {/* 生徒一覧 */}
      <div className="mb-2">
        <h3 className="text-sm font-medium">対象生徒: {studentCount}名</h3>
      </div>
      <RosterTable
        adapter={rosterAdapter}
        onLoadingChange={setLoading}
        registerHandle={setRosterHandle}
        onRowsChange={(rows) => setStudentCount(rows.length)}
      />

      <div className="mt-6 flex justify-end">
        <Button asChild disabled={loading || studentCount === 0}>
          <Link href={`/grades/${gradeId}/03-data-sources`}>
            次へ: データソース
          </Link>
        </Button>
      </div>
    </div>
  )
}
