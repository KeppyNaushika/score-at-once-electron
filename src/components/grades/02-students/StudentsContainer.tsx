"use client"

import { Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

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
import { Button } from "@/components/ui/button"

interface GradeClass {
  id: string
  classId: string
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
  const [classes, setClasses] = useState<GradeClass[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rosterHandle, setRosterHandle] = useState<RosterTableHandle | null>(
    null
  )

  const loadClasses = useCallback(async () => {
    try {
      const result = await window.electronAPI.grade.getClasses(gradeId)
      if (result.success && result.classes) {
        setClasses(result.classes)
      }
    } catch (error) {
      console.error("Error loading grade classes:", error)
    }
  }, [gradeId])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  // 名簿テーブルのアダプター（成績）
  const rosterAdapter = useMemo<RosterTableAdapter>(
    () => ({
      fetchRows: async () => {
        const [classResult, studentResult] = await Promise.all([
          window.electronAPI.grade.getClasses(gradeId),
          window.electronAPI.grade.getStudents(gradeId),
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
        return students.map((examStudent): RosterRow => {
          const membership = examStudent.student.memberships.find((m) =>
            registeredClassIds.has(m.classId)
          )
          return {
            id: examStudent.studentId,
            studentNumber: examStudent.student.studentNumber,
            lastName: examStudent.student.lastName,
            firstName: examStudent.student.firstName,
            kana: "",
            classInfo: {
              className: membership?.class.name ?? null,
              attendanceNumber: membership?.attendanceNumber ?? null,
              classOrder: membership
                ? (classOrderMap.get(membership.classId) ?? null)
                : null,
            },
            customOrder: examStudent.customOrder,
          }
        })
      },
      fetchClasses: async () => {
        const result = await window.electronAPI.grade.getClasses(gradeId)
        if (!result.success || !result.classes) return []
        return result.classes.map(
          (c): RosterClassOption => ({ id: c.classId, name: c.className })
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
      fetchAvailableClasses: async (activeOnly) => {
        const result = await window.electronAPI.grade.getAvailableClasses(
          gradeId,
          activeOnly
        )
        if (!result.success || !result.classes) return []
        return result.classes.map(
          (c): AddPanelClassItem => ({
            id: c.id,
            name: c.name,
            studentCount: c.studentCount,
            studentNames: c.studentNames,
          })
        )
      },
      fetchAvailableStudents: async (activeOnly) => {
        const result = await window.electronAPI.grade.getAvailableStudents(
          gradeId,
          activeOnly
        )
        if (!result.success || !result.students) return []
        return result.students.map(
          (s): AddPanelStudentItem => ({
            id: s.id,
            studentNumber: s.studentNumber,
            lastName: s.lastName,
            firstName: s.firstName,
            lastNameKana: s.lastNameKana,
            firstNameKana: s.firstNameKana,
            memberships: s.memberships.map((m) => ({
              attendanceNumber: m.attendanceNumber,
              class: { id: m.class.id, name: m.class.name },
            })),
          })
        )
      },
      addClasses: async (orderedClassIds, activeOnly) => {
        for (const classId of orderedClassIds) {
          const result = await window.electronAPI.grade.addStudentsFromClass(
            gradeId,
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
    await loadClasses()
    await rosterHandle?.refresh()
  }, [loadClasses, rosterHandle])

  const handleRemoveClass = async (classId: string) => {
    try {
      const result = await window.electronAPI.grade.removeClass(
        gradeId,
        classId
      )
      if (result.success) {
        await reloadAll()
      }
    } catch (error) {
      console.error("Error removing class:", error)
    }
  }

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

      {/* 登録済み学級 */}
      {classes.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium">登録済み学級</h3>
          <div className="flex flex-wrap gap-2">
            {classes.map((gradeClass) => (
              <div
                key={gradeClass.id}
                className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <Users className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">
                  {gradeClass.className}（{gradeClass.studentCount}名）
                </span>
                <button
                  onClick={() => handleRemoveClass(gradeClass.classId)}
                  className="text-muted-foreground hover:text-destructive ml-1"
                  title={`${gradeClass.className}を削除`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
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
