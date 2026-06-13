"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { RotateCcw, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
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

interface ExamStudent {
  id: string
  studentId: string
  customOrder: number | null
  student: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    memberships: {
      classId: string
      attendanceNumber: number | null
      class: { id: string; name: string }
    }[]
  }
}

interface StudentsContainerProps {
  gradeId: string
}

function SortableRow({
  examStudent,
  classIdMap,
}: {
  examStudent: ExamStudent
  classIdMap: Map<string, string>
}) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(
    examStudent.studentId
  )

  const membership = examStudent.student.memberships.find((m) =>
    classIdMap.has(m.classId)
  )

  return (
    <tr ref={setNodeRef} style={style} className="border-t">
      <td className="w-8 px-1 py-1.5">
        <DragHandle
          dragHandleProps={dragHandleProps}
          className="flex items-center justify-center"
        />
      </td>
      <td className="px-3 py-1.5">{membership?.class.name ?? "-"}</td>
      <td className="px-3 py-1.5 text-center">
        {membership?.attendanceNumber ?? "-"}
      </td>
      <td className="px-3 py-1.5">
        {examStudent.student.lastName} {examStudent.student.firstName}
      </td>
      <td className="text-muted-foreground px-3 py-1.5">
        {examStudent.student.studentNumber}
      </td>
    </tr>
  )
}

/**
 * 成績算出試験の生徒管理コンテナ
 *
 * 学級の追加/削除と、対象生徒一覧のドラッグ&ドロップ並び替えを提供する。
 */
export function StudentsContainer({ gradeId }: StudentsContainerProps) {
  const [classes, setClasses] = useState<GradeClass[]>([])
  const [students, setStudents] = useState<ExamStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [classResult, studentResult] = await Promise.all([
        window.electronAPI.grade.getClasses(gradeId),
        window.electronAPI.grade.getStudents(gradeId),
      ])
      if (classResult.success && classResult.classes) {
        setClasses(classResult.classes)
      }
      if (studentResult.success && studentResult.students) {
        setStudents(studentResult.students)
      }
    } catch (error) {
      console.error("Error loading students data:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const handleRemoveClass = async (classId: string) => {
    try {
      const result = await window.electronAPI.grade.removeClass(
        gradeId,
        classId
      )
      if (result.success) {
        await loadData()
      }
    } catch (error) {
      console.error("Error removing class:", error)
    }
  }

  const saveOrders = useCallback(
    async (reordered: ExamStudent[]) => {
      const studentOrders = reordered.map((examStudent, index) => ({
        studentId: examStudent.studentId,
        customOrder: index,
      }))
      await window.electronAPI.grade.updateStudentOrders(gradeId, studentOrders)
    },
    [gradeId]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = students.findIndex(
      (examStudent) => examStudent.studentId === active.id
    )
    const newIndex = students.findIndex(
      (examStudent) => examStudent.studentId === over.id
    )
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(students, oldIndex, newIndex)
    setStudents(reordered)
    await saveOrders(reordered)
  }

  const handleResetOrder = async () => {
    const classOrderMap = new Map(
      classes.map((gradeClass) => [gradeClass.classId, gradeClass.order])
    )
    const sorted = [...students].sort((a, b) => {
      const aMembership = a.student.memberships.find((membership) =>
        classOrderMap.has(membership.classId)
      )
      const bMembership = b.student.memberships.find((membership) =>
        classOrderMap.has(membership.classId)
      )
      const aClassOrder = aMembership
        ? (classOrderMap.get(aMembership.classId) ?? 999)
        : 999
      const bClassOrder = bMembership
        ? (classOrderMap.get(bMembership.classId) ?? 999)
        : 999
      if (aClassOrder !== bClassOrder) return aClassOrder - bClassOrder
      const aAttendanceNumber = aMembership?.attendanceNumber ?? 999
      const bAttendanceNumber = bMembership?.attendanceNumber ?? 999
      return aAttendanceNumber - bAttendanceNumber
    })
    setStudents(sorted)
    await saveOrders(sorted)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const classIdMap = new Map(
    classes.map((gradeClass) => [gradeClass.classId, gradeClass.className])
  )
  const activeStudent = activeId
    ? students.find((examStudent) => examStudent.studentId === activeId)
    : null
  const activeMembership = activeStudent?.student.memberships.find(
    (membership) => classIdMap.has(membership.classId)
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
        <StudentAddPanel adapter={addPanelAdapter} onAdded={loadData} />
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
      {students.length > 0 ? (
        <div className="rounded-lg border">
          <div className="bg-muted/50 flex items-center justify-between px-4 py-2">
            <span className="text-sm font-medium">
              対象生徒: {students.length}名
            </span>
            <Button variant="ghost" size="sm" onClick={handleResetOrder}>
              <RotateCcw className="mr-1 h-3 w-3" />
              順序をリセット
            </Button>
          </div>
          <div className="overflow-x-auto">
            <SortableTableProvider
              items={students.map((examStudent) => examStudent.studentId)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              dragOverlay={
                activeStudent && (
                  <div className="bg-background rounded border px-4 py-2 text-sm shadow-lg">
                    {activeMembership?.class.name ?? ""}{" "}
                    {activeStudent.student.lastName}{" "}
                    {activeStudent.student.firstName}
                  </div>
                )
              }
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="w-8 px-1 py-2" />
                    <th className="px-3 py-2 text-left font-medium">学級</th>
                    <th className="px-3 py-2 text-left font-medium">
                      出席番号
                    </th>
                    <th className="px-3 py-2 text-left font-medium">氏名</th>
                    <th className="px-3 py-2 text-left font-medium">
                      学籍番号
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((examStudent) => (
                    <SortableRow
                      key={examStudent.studentId}
                      examStudent={examStudent}
                      classIdMap={classIdMap}
                    />
                  ))}
                </tbody>
              </table>
            </SortableTableProvider>
          </div>
        </div>
      ) : (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground mb-1">生徒が登録されていません</p>
          <p className="text-muted-foreground text-xs">
            上の「学級を追加」から対象学級を選択してください
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button asChild disabled={students.length === 0}>
          <Link href={`/grades/${gradeId}/03-data-sources`}>
            次へ: データソース
          </Link>
        </Button>
      </div>
    </div>
  )
}
