"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types"
import {
  addCourseworkStudentsFromClassroomMutation,
  addCourseworkStudentsMutation,
  courseworkAvailableClassroomsQuery,
  courseworkAvailableStudentsQuery,
  type CourseworkClassroomRow,
  courseworkClassroomsQuery,
  courseworkStudentsQuery,
  previewCourseworkClassroomRemovalMutation,
  removeCourseworkClassroomMutation,
  removeCourseworkStudentsMutation,
  setCourseworkClassroomOrdersMutation,
  updateCourseworkStudentOrdersMutation,
} from "@/queries/coursework"

interface CourseworkStudentsContainerProps {
  courseworkId: string
}

/**
 * 試験外成績資料（Coursework）の生徒管理コンテナ
 *
 * 学級の追加/削除と、共通 roster-table による対象生徒一覧の並び替え・削除を提供する。
 */
/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: CourseworkClassroomRow[] = []

export function CourseworkStudentsContainer({
  courseworkId,
}: CourseworkStudentsContainerProps) {
  const queryClient = useQueryClient()
  const { data: classrooms = EMPTY_CLASSROOMS } = useQuery(
    courseworkClassroomsQuery(courseworkId)
  )
  // 名簿の一般UI は「何の名簿か」を知らない。書き込みの定義はこのコンテナが持つ
  const updateStudentOrders = useMutation(
    updateCourseworkStudentOrdersMutation(courseworkId)
  )
  const removeStudents = useMutation(
    removeCourseworkStudentsMutation(courseworkId)
  )
  const addStudentsFromClassroom = useMutation(
    addCourseworkStudentsFromClassroomMutation(courseworkId)
  )
  const addStudents = useMutation(addCourseworkStudentsMutation(courseworkId))
  const setClassroomOrders = useMutation(
    setCourseworkClassroomOrdersMutation(courseworkId)
  )
  const removeClassroom = useMutation(
    removeCourseworkClassroomMutation(courseworkId)
  )
  const previewRemoval = useMutation(
    previewCourseworkClassroomRemovalMutation(courseworkId)
  )
  const [studentCount, setStudentCount] = useState(0)
  const [rosterHandle, setRosterHandle] = useState<RosterTableHandle | null>(
    null
  )

  // 名簿テーブルのアダプター（資料）
  const rosterAdapter = useMemo<RosterTableAdapter>(
    () => ({
      scopeId: courseworkId,
      fetchRows: async () => {
        const [courseworkClassrooms, courseworkStudents] = await Promise.all([
          queryClient.fetchQuery(courseworkClassroomsQuery(courseworkId)),
          queryClient.fetchQuery(courseworkStudentsQuery(courseworkId)),
        ])
        const classroomOrderMap = new Map(
          courseworkClassrooms.map((courseworkClassroom) => [
            courseworkClassroom.classroomId,
            courseworkClassroom.order,
          ])
        )
        const registeredClassroomIds = new Set(classroomOrderMap.keys())
        return courseworkStudents.map((courseworkStudent): RosterRow => {
          const membership = courseworkStudent.student.memberships.find(
            (membership) => registeredClassroomIds.has(membership.classroomId)
          )
          return {
            id: courseworkStudent.studentId,
            studentNumber: courseworkStudent.student.studentNumber,
            lastName: courseworkStudent.student.lastName,
            firstName: courseworkStudent.student.firstName,
            kana: `${courseworkStudent.student.lastNameKana} ${courseworkStudent.student.firstNameKana}`,
            classroomInfo: {
              className: membership?.classroom.name ?? null,
              attendanceNumber: membership?.attendanceNumber ?? null,
              classroomOrder: membership
                ? (classroomOrderMap.get(membership.classroomId) ?? null)
                : null,
            },
            customOrder: courseworkStudent.customOrder,
          }
        })
      },
      fetchClassrooms: async () => {
        const courseworkClassrooms = await queryClient.fetchQuery(
          courseworkClassroomsQuery(courseworkId)
        )
        return courseworkClassrooms.map(
          (courseworkClassroom): RosterClassroomOption => ({
            id: courseworkClassroom.classroomId,
            name: courseworkClassroom.className,
          })
        )
      },
      updateRowOrder: async (rowOrders) => {
        await updateStudentOrders.mutateAsync(rowOrders)
      },
      removeRows: async (studentIds) => {
        await removeStudents.mutateAsync(studentIds)
      },
    }),
    [courseworkId, queryClient, updateStudentOrders, removeStudents]
  )

  // 生徒追加パネルのアダプター（資料）
  const addPanelAdapter = useMemo<StudentAddPanelAdapter>(
    () => ({
      scopeId: courseworkId,
      fetchAvailableClassrooms: async (activeOnly) => {
        const classrooms = await queryClient.fetchQuery(
          courseworkAvailableClassroomsQuery(courseworkId, activeOnly)
        )
        return classrooms.map((classroom): AddPanelClassroomItem => ({
          id: classroom.id,
          name: classroom.name,
          studentCount: classroom.studentCount,
          studentNames: [],
        }))
      },
      fetchAvailableStudents: async (activeOnly) =>
        // 候補は境界が返す行（Student＋所属＋学級）をそのまま渡す
        queryClient.fetchQuery(
          courseworkAvailableStudentsQuery(courseworkId, activeOnly)
        ),
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
    [courseworkId, queryClient, addStudents, addStudentsFromClassroom]
  )

  const reloadAll = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: courseworkClassroomsQuery(courseworkId).queryKey,
    })
    await rosterHandle?.refresh()
  }, [queryClient, courseworkId, rosterHandle])

  const classroomEntries = useMemo<ClassroomRosterEntry[]>(
    () =>
      classrooms.map((courseworkClassroom) => ({
        id: courseworkClassroom.classroomId,
        classroomId: courseworkClassroom.classroomId,
        name: courseworkClassroom.className,
        studentCount: courseworkClassroom.studentCount,
        order: courseworkClassroom.order,
      })),
    [classrooms]
  )

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">生徒管理</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        評価対象の生徒を学級単位で追加してください。ドラッグで並び替えできます。
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
            scopeId={courseworkId}
            entries={classroomEntries}
            removalMode="can-delete-students"
            description="ドラッグで並び替えできます。学級を外すときは、専属生徒を残すか削除するか選べます。"
            deletionLosses={[
              "この資料の全評価項目に入力された点数・評価記号",
              "加減点とその理由",
              "成績通知書に載せるコメント",
            ]}
            // 失敗は例外で伝わり、ClassroomRosterManager の楽観更新がロールバックする
            onReorder={async (orderedClassroomIds) => {
              await setClassroomOrders.mutateAsync(orderedClassroomIds)
            }}
            fetchRemovalPreview={(entry) =>
              previewRemoval.mutateAsync(entry.classroomId)
            }
            // 失敗は例外で伝わり、ダイアログが成功扱いで閉じない
            onRemove={async (entry, deleteStudents, confirmedCounts) => {
              await removeClassroom.mutateAsync({
                classroomId: entry.classroomId,
                deleteStudents,
                confirmedCounts,
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
        enableRemove
        slots={{
          removalLosses: [
            "この資料の全評価項目に入力された点数・評価記号",
            "加減点とその理由",
            "成績通知書に載せるコメント",
          ],
        }}
        registerHandle={setRosterHandle}
        onRowsChange={(rows) => setStudentCount(rows.length)}
      />
    </div>
  )
}
