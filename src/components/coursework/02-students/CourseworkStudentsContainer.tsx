"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { queryKeys } from "@/lib/queryKeys"

interface CourseworkStudentsContainerProps {
  courseworkId: string
}

/**
 * 試験外成績資料（Coursework）の生徒管理コンテナ
 *
 * 学級の追加/削除と、共通 roster-table による対象生徒一覧の並び替え・削除を提供する。
 */
export function CourseworkStudentsContainer({
  courseworkId,
}: CourseworkStudentsContainerProps) {
  const queryClient = useQueryClient()
  const { data: classrooms = [] } = useQuery({
    queryKey: queryKeys.coursework.classrooms(courseworkId),
    queryFn: () => window.electronAPI.coursework.getClassrooms(courseworkId),
  })
  const [studentCount, setStudentCount] = useState(0)
  const [rosterHandle, setRosterHandle] = useState<RosterTableHandle | null>(
    null
  )

  // 名簿テーブルのアダプター（資料）
  const rosterAdapter = useMemo<RosterTableAdapter>(
    () => ({
      fetchRows: async () => {
        const [courseworkClassrooms, courseworkStudents] = await Promise.all([
          window.electronAPI.coursework.getClassrooms(courseworkId),
          window.electronAPI.coursework.getStudents(courseworkId),
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
        const courseworkClassrooms =
          await window.electronAPI.coursework.getClassrooms(courseworkId)
        return courseworkClassrooms.map(
          (courseworkClassroom): RosterClassroomOption => ({
            id: courseworkClassroom.classroomId,
            name: courseworkClassroom.className,
          })
        )
      },
      updateRowOrder: async (rowOrders) => {
        await window.electronAPI.coursework.updateStudentOrders(
          courseworkId,
          rowOrders
        )
      },
      removeRows: async (studentIds) => {
        await window.electronAPI.coursework.removeStudents(
          courseworkId,
          studentIds
        )
      },
    }),
    [courseworkId]
  )

  // 生徒追加パネルのアダプター（資料）
  const addPanelAdapter = useMemo<StudentAddPanelAdapter>(
    () => ({
      fetchAvailableClassrooms: async (activeOnly) => {
        const classrooms =
          await window.electronAPI.coursework.getAvailableClassrooms(
            courseworkId,
            activeOnly
          )
        return classrooms.map((classroom): AddPanelClassroomItem => ({
          id: classroom.id,
          name: classroom.name,
          studentCount: classroom.studentCount,
          studentNames: [],
        }))
      },
      fetchAvailableStudents: async (activeOnly) => {
        const students =
          await window.electronAPI.coursework.getAvailableStudents(
            courseworkId,
            activeOnly
          )
        // 学級名は所属（memberships）から取る。以前は存在しない `className` 列を
        // 読んでいて、常に空の所属が渡っていた
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
          await window.electronAPI.coursework.addStudentsFromClassroom(
            courseworkId,
            classroomId,
            activeOnly
          )
        }
      },
      addStudents: async (studentIds) => {
        await window.electronAPI.coursework.addStudents(
          courseworkId,
          studentIds
        )
      },
    }),
    [courseworkId]
  )

  const reloadAll = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.coursework.classrooms(courseworkId),
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
              await window.electronAPI.coursework.setClassroomOrders(
                courseworkId,
                orderedClassroomIds
              )
            }}
            fetchRemovalPreview={async (entry) => {
              const result =
                await window.electronAPI.coursework.classroomRemovalPreview(
                  courseworkId,
                  entry.classroomId
                )
              return { exclusiveCount: result.exclusiveCount }
            }}
            // 失敗は例外で伝わり、ダイアログが成功扱いで閉じない
            onRemove={async (entry, deleteStudents) => {
              await window.electronAPI.coursework.removeClassroom(
                courseworkId,
                entry.classroomId,
                deleteStudents
              )
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
