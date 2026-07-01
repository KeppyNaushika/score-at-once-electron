"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  type ClassRosterEntry,
  ClassRosterManager,
} from "@/components/common/class-roster"
import {
  type RosterClassOption,
  type RosterRow,
  RosterTable,
  type RosterTableAdapter,
  type RosterTableHandle,
} from "@/components/common/roster-table"
import { StudentAddPanel } from "@/components/common/student-add-panel/components/StudentAddPanel"
import type {
  AddPanelClassItem,
  AddPanelStudentItem,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types/studentAddPanelTypes"

interface CourseworkClass {
  id: string
  classId: string
  className: string
  order: number
  studentCount: number
}

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
  const [classes, setClasses] = useState<CourseworkClass[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [rosterHandle, setRosterHandle] = useState<RosterTableHandle | null>(
    null
  )

  const loadClasses = useCallback(async () => {
    try {
      const result =
        await window.electronAPI.coursework.getClasses(courseworkId)
      if (result.success && result.classes) {
        setClasses(result.classes)
      }
    } catch (error) {
      console.error("Error loading coursework classes:", error)
    }
  }, [courseworkId])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  // 名簿テーブルのアダプター（資料）
  const rosterAdapter = useMemo<RosterTableAdapter>(
    () => ({
      fetchRows: async () => {
        const [classResult, studentResult] = await Promise.all([
          window.electronAPI.coursework.getClasses(courseworkId),
          window.electronAPI.coursework.getStudents(courseworkId),
        ])
        const classOrderMap = new Map(
          (classResult.success && classResult.classes
            ? classResult.classes
            : []
          ).map((c) => [c.classId, c.order])
        )
        const registeredClassIds = new Set(classOrderMap.keys())
        const students =
          studentResult.success && studentResult.students
            ? studentResult.students
            : []
        return students.map((courseworkStudent): RosterRow => {
          const membership = courseworkStudent.student.memberships.find((m) =>
            registeredClassIds.has(m.classId)
          )
          return {
            id: courseworkStudent.studentId,
            studentNumber: courseworkStudent.student.studentNumber,
            lastName: courseworkStudent.student.lastName,
            firstName: courseworkStudent.student.firstName,
            kana: `${courseworkStudent.student.lastNameKana} ${courseworkStudent.student.firstNameKana}`,
            classInfo: {
              className: membership?.class.name ?? null,
              attendanceNumber: membership?.attendanceNumber ?? null,
              classOrder: membership
                ? (classOrderMap.get(membership.classId) ?? null)
                : null,
            },
            customOrder: courseworkStudent.customOrder,
          }
        })
      },
      fetchClasses: async () => {
        const result =
          await window.electronAPI.coursework.getClasses(courseworkId)
        if (!result.success || !result.classes) return []
        return result.classes.map((c): RosterClassOption => ({
          id: c.classId,
          name: c.className,
        }))
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
      fetchAvailableClasses: async (activeOnly) => {
        const result = await window.electronAPI.coursework.getAvailableClasses(
          courseworkId,
          activeOnly
        )
        if (!result.success || !result.classes) return []
        return result.classes.map((c): AddPanelClassItem => ({
          id: c.id,
          name: c.name,
          studentCount: c.studentCount,
          studentNames: [],
        }))
      },
      fetchAvailableStudents: async (activeOnly) => {
        const result = await window.electronAPI.coursework.getAvailableStudents(
          courseworkId,
          activeOnly
        )
        if (!result.success || !result.students) return []
        return result.students.map((s): AddPanelStudentItem => ({
          id: s.id,
          studentNumber: s.studentNumber,
          lastName: s.lastName,
          firstName: s.firstName,
          lastNameKana: "",
          firstNameKana: "",
          memberships: s.className
            ? [
                {
                  attendanceNumber: null,
                  class: { id: s.className, name: s.className },
                },
              ]
            : [],
        }))
      },
      addClasses: async (orderedClassIds, activeOnly) => {
        for (const classId of orderedClassIds) {
          const result =
            await window.electronAPI.coursework.addStudentsFromClass(
              courseworkId,
              classId,
              activeOnly
            )
          if (!result.success) {
            throw new Error(
              result.error || `学級 ${classId} の追加に失敗しました`
            )
          }
        }
      },
      addStudents: async (studentIds) => {
        const result = await window.electronAPI.coursework.addStudents(
          courseworkId,
          studentIds
        )
        if (!result.success) {
          throw new Error(result.error || "生徒の追加に失敗しました")
        }
      },
    }),
    [courseworkId]
  )

  const reloadAll = useCallback(async () => {
    await loadClasses()
    await rosterHandle?.refresh()
  }, [loadClasses, rosterHandle])

  const classEntries = useMemo<ClassRosterEntry[]>(
    () =>
      classes.map((c) => ({
        id: c.classId,
        classId: c.classId,
        name: c.className,
        studentCount: c.studentCount,
        order: c.order,
      })),
    [classes]
  )

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">生徒管理</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        評価対象の生徒を学級単位で追加してください。ドラッグで並び替えできます。
      </p>

      {/* 生徒追加（学級まるごと・個別） */}
      <div className="mb-6 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">生徒を追加</h3>
        <StudentAddPanel adapter={addPanelAdapter} onAdded={reloadAll} />
      </div>

      {/* 登録済み学級（並び替え・削除） */}
      {classes.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium">登録済み学級</h3>
          <ClassRosterManager
            entries={classEntries}
            removalMode="can-delete-students"
            description="ドラッグで並び替えできます。学級を外すときは、専属生徒を残すか削除するか選べます。"
            onReorder={async (orderedClassIds) => {
              const result = await window.electronAPI.coursework.setClassOrders(
                courseworkId,
                orderedClassIds
              )
              // 失敗時は throw して ClassRosterManager の楽観更新をロールバックさせる
              if (!result.success) {
                throw new Error(result.error || "学級の並び替えに失敗しました")
              }
            }}
            fetchRemovalPreview={async (entry) => {
              const result =
                await window.electronAPI.coursework.classRemovalPreview(
                  courseworkId,
                  entry.classId
                )
              return { exclusiveCount: result.exclusiveCount ?? 0 }
            }}
            onRemove={async (entry, deleteStudents) => {
              const result = await window.electronAPI.coursework.removeClass(
                courseworkId,
                entry.classId,
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
        enableRemove
        registerHandle={setRosterHandle}
        onRowsChange={(rows) => setStudentCount(rows.length)}
      />
    </div>
  )
}
