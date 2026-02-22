"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Plus, RotateCcw, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface GradeProjectClass {
  id: string
  classId: string
  className: string
  order: number
  studentCount: number
}

interface AvailableClass {
  id: string
  name: string
  studentCount: number
}

interface ProjectStudent {
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
  gradeProjectId: string
}

function SortableRow({
  projectStudent,
  classIdMap,
}: {
  projectStudent: ProjectStudent
  classIdMap: Map<string, string>
}) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(
    projectStudent.studentId
  )

  const membership = projectStudent.student.memberships.find((m) =>
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
        {projectStudent.student.lastName} {projectStudent.student.firstName}
      </td>
      <td className="text-muted-foreground px-3 py-1.5">
        {projectStudent.student.studentNumber}
      </td>
    </tr>
  )
}

/**
 * 成績算出プロジェクトの生徒管理コンテナ
 *
 * 学級の追加/削除と、対象生徒一覧のドラッグ&ドロップ並び替えを提供する。
 */
export function StudentsContainer({ gradeProjectId }: StudentsContainerProps) {
  const [classes, setClasses] = useState<GradeProjectClass[]>([])
  const [students, setStudents] = useState<ProjectStudent[]>([])
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [classResult, studentResult, availableResult] = await Promise.all([
        window.electronAPI.gradeProject.getClasses(gradeProjectId),
        window.electronAPI.gradeProject.getStudents(gradeProjectId),
        window.electronAPI.gradeProject.getAvailableClasses(gradeProjectId),
      ])
      if (classResult.success && classResult.classes) {
        setClasses(classResult.classes)
      }
      if (studentResult.success && studentResult.students) {
        setStudents(studentResult.students)
      }
      if (availableResult.success && availableResult.classes) {
        setAvailableClasses(availableResult.classes)
      }
    } catch (error) {
      console.error("Error loading students data:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeProjectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddClass = async () => {
    if (!selectedClassId) return
    setAdding(true)
    try {
      const result = await window.electronAPI.gradeProject.addStudentsFromClass(
        gradeProjectId,
        selectedClassId
      )
      if (result.success) {
        setSelectedClassId("")
        await loadData()
      }
    } catch (error) {
      console.error("Error adding class:", error)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveClass = async (classId: string) => {
    try {
      const result = await window.electronAPI.gradeProject.removeClass(
        gradeProjectId,
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
    async (reordered: ProjectStudent[]) => {
      const studentOrders = reordered.map((projectStudent, index) => ({
        studentId: projectStudent.studentId,
        customOrder: index,
      }))
      await window.electronAPI.gradeProject.updateStudentOrders(
        gradeProjectId,
        studentOrders
      )
    },
    [gradeProjectId]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = students.findIndex(
      (projectStudent) => projectStudent.studentId === active.id
    )
    const newIndex = students.findIndex(
      (projectStudent) => projectStudent.studentId === over.id
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
    ? students.find((projectStudent) => projectStudent.studentId === activeId)
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

      {/* 学級追加 */}
      <div className="mb-6 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">学級を追加</h3>
        <div className="flex items-center gap-3">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="学級を選択" />
            </SelectTrigger>
            <SelectContent>
              {availableClasses.map((availableClass) => (
                <SelectItem key={availableClass.id} value={availableClass.id}>
                  {availableClass.name}（{availableClass.studentCount}名）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddClass}
            disabled={!selectedClassId || adding}
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            {adding ? "追加中..." : "追加"}
          </Button>
        </div>
        {availableClasses.length === 0 && classes.length > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            全ての学級が登録済みです
          </p>
        )}
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
              items={students.map((projectStudent) => projectStudent.studentId)}
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
                  {students.map((projectStudent) => (
                    <SortableRow
                      key={projectStudent.studentId}
                      projectStudent={projectStudent}
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
          <Link href={`/grade-projects/${gradeProjectId}/03-data-sources`}>
            次へ: データソース
          </Link>
        </Button>
      </div>
    </div>
  )
}
