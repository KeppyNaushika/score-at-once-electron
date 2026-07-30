"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

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

interface GradeClassroom {
  id: string
  classroomId: string
  className: string
  order: number
  studentCount: number
}

interface StudentsContainerProps {
  gradeId: string
}

/**
 * 成績算出試験の生徒管理コンテナ
 *
 * 学級の追加/削除と、共通 roster-table による対象生徒一覧の並び替えを提供する。
 */
export function StudentsContainer({ gradeId }: StudentsContainerProps) {
  const [classrooms, setClassrooms] = useState<GradeClassroom[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rosterHandle, setRosterHandle] = useState<RosterTableHandle | null>(
    null
  )

  const loadClassrooms = useCallback(async () => {
    try {
      const result = await window.electronAPI.grade.getClassrooms(gradeId)
      if (result.success && result.classrooms) {
        setClassrooms(result.classrooms)
      }
    } catch (error) {
      console.error("Error loading grade classrooms:", error)
    }
  }, [gradeId])

  useEffect(() => {
    loadClassrooms()
  }, [loadClassrooms])

  // 名簿テーブルのアダプター（成績）
  const rosterAdapter = useMemo<RosterTableAdapter>(
    () => ({
      fetchRows: async () => {
        const [classroomResult, studentResult] = await Promise.all([
          window.electronAPI.grade.getClassrooms(gradeId),
          window.electronAPI.grade.getStudents(gradeId),
        ])
        const classroomOrderMap = new Map(
          (classroomResult.success && classroomResult.classrooms
            ? classroomResult.classrooms
            : []
          ).map((gradeClassroom) => [
            gradeClassroom.classroomId,
            gradeClassroom.order,
          ])
        )
        const registeredClassroomIds = new Set(classroomOrderMap.keys())
        const students =
          studentResult.success && studentResult.students
            ? studentResult.students
            : []
        return students.map((examStudent): RosterRow => {
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
        const result = await window.electronAPI.grade.getClassrooms(gradeId)
        if (!result.success || !result.classrooms) return []
        return result.classrooms.map(
          (gradeClassroom): RosterClassroomOption => ({
            id: gradeClassroom.classroomId,
            name: gradeClassroom.className,
          })
        )
      },
      updateRowOrder: async (rowOrders) => {
        await window.electronAPI.grade.updateStudentOrders(gradeId, rowOrders)
      },
      removeRows: async () => {
        // 成績画面では生徒個別の削除はサポートしない（学級単位で管理）
      },
    }),
    [gradeId]
  )

  // 生徒追加パネルのアダプター（成績）
  const addPanelAdapter = useMemo<StudentAddPanelAdapter>(
    () => ({
      fetchAvailableClassrooms: async (activeOnly) => {
        const result = await window.electronAPI.grade.getAvailableClassrooms(
          gradeId,
          activeOnly
        )
        if (!result.success || !result.classrooms) return []
        return result.classrooms.map((classroom): AddPanelClassroomItem => ({
          id: classroom.id,
          name: classroom.name,
          studentCount: classroom.studentCount,
          studentNames: classroom.studentNames,
        }))
      },
      fetchAvailableStudents: async (activeOnly) => {
        const result = await window.electronAPI.grade.getAvailableStudents(
          gradeId,
          activeOnly
        )
        if (!result.success || !result.students) return []
        return result.students.map((student): AddPanelStudentItem => ({
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
          const result =
            await window.electronAPI.grade.addStudentsFromClassroom(
              gradeId,
              classroomId,
              activeOnly
            )
          if (!result.success) {
            throw new Error(
              result.error || `学級 ${classroomId} の追加に失敗しました`
            )
          }
        }
      },
      addStudents: async (studentIds) => {
        const result = await window.electronAPI.grade.addStudentsToGrade(
          gradeId,
          studentIds
        )
        if (!result.success) {
          throw new Error(result.error || "生徒の追加に失敗しました")
        }
      },
    }),
    [gradeId]
  )

  const reloadAll = useCallback(async () => {
    await loadClassrooms()
    await rosterHandle?.refresh()
  }, [loadClassrooms, rosterHandle])

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
      <p className="text-muted-foreground mb-6 text-sm">
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
            onReorder={async (orderedClassroomIds) => {
              const result = await window.electronAPI.grade.setClassroomOrders(
                gradeId,
                orderedClassroomIds
              )
              // 失敗時は throw して ClassroomRosterManager の楽観更新をロールバックさせる
              if (!result.success) {
                throw new Error(result.error || "学級の並び替えに失敗しました")
              }
            }}
            fetchRemovalPreview={async (entry) => {
              const result =
                await window.electronAPI.grade.classroomRemovalPreview(
                  gradeId,
                  entry.classroomId
                )
              return { exclusiveCount: result.exclusiveCount ?? 0 }
            }}
            onRemove={async (entry, deleteStudents) => {
              const result = await window.electronAPI.grade.removeClassroom(
                gradeId,
                entry.classroomId,
                deleteStudents
              )
              // 失敗時は throw し、ダイアログを成功扱いで閉じさせない
              if (!result.success) {
                throw new Error(result.error || "学級の削除に失敗しました")
              }
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
