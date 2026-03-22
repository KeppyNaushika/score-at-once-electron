"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useEffect, useState } from "react"

import type {
  Student,
  StudentStatus,
} from "@/components/exams/05-students/components/sortable-student-table/types/studentTableTypes"

interface UseSortableStudentTableProps {
  filteredStudents: Student[]
  selectedStudents: Set<string>
  onStudentSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  onStudentOrderUpdate: (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<void>
  onStudentStatusUpdate: (
    studentId: string,
    status: StudentStatus
  ) => Promise<void>
  examId: string
}

export function useSortableStudentTable({
  filteredStudents,
  selectedStudents,
  onStudentSelectionChange,
  onSelectAll,
  onStudentOrderUpdate,
  onStudentStatusUpdate,
  examId,
}: UseSortableStudentTableProps) {
  const [sortedStudents, setSortedStudents] = useState<Student[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  )

  // 生徒の並び順を初期化・更新
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // 単一パスでソート（customOrder優先、なければデフォルト順）
      const sorted = filteredStudents.slice().sort((a, b) => {
        const aHasCustomOrder =
          a.customOrder !== null && a.customOrder !== undefined
        const bHasCustomOrder =
          b.customOrder !== null && b.customOrder !== undefined

        // 両方customOrderがある場合
        if (aHasCustomOrder && bHasCustomOrder) {
          return a.customOrder! - b.customOrder!
        }

        // 片方だけcustomOrderがある場合、customOrderがある方を前に
        if (aHasCustomOrder) return -1
        if (bHasCustomOrder) return 1

        // 両方customOrderがない場合はデフォルトソート
        // ExamClass順（order）→学級内出席番号順
        const aClassOrder = a.examClassInfo?.classOrder ?? 99999
        const bClassOrder = b.examClassInfo?.classOrder ?? 99999

        if (aClassOrder !== bClassOrder) {
          return aClassOrder - bClassOrder
        }

        const aAttendance = a.examClassInfo?.attendanceNumber ?? 99999
        const bAttendance = b.examClassInfo?.attendanceNumber ?? 99999
        return aAttendance - bAttendance
      })

      setSortedStudents(sorted)
    })

    return () => cancelAnimationFrame(frame)
  }, [filteredStudents])

  // ドラッグ開始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // ドラッグ終了
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = sortedStudents.findIndex(
        (student) => student.id === active.id
      )
      const newIndex = sortedStudents.findIndex(
        (student) => student.id === over.id
      )

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      // 選択されている生徒を取得
      const selectedStudentsList = sortedStudents.filter((student) =>
        selectedStudents.has(student.id)
      )

      // ドラッグされた生徒が選択されている場合は、選択されたすべての生徒を一緒に移動
      if (
        selectedStudents.has(active.id as string) &&
        selectedStudentsList.length > 1
      ) {
        // 複数選択の場合の処理
        const newSortedStudents = [...sortedStudents]

        // 選択されている生徒を元の位置から削除
        const selectedStudentsData = selectedStudentsList
          .map((student) => {
            const index = newSortedStudents.findIndex(
              (s) => s.id === student.id
            )
            return newSortedStudents.splice(index, 1)[0]
          })
          .filter(Boolean)

        // 新しい位置に挿入
        const targetIndex =
          newIndex <= oldIndex
            ? newIndex
            : newIndex - selectedStudentsList.length + 1
        newSortedStudents.splice(targetIndex, 0, ...selectedStudentsData)

        setSortedStudents(newSortedStudents)

        // カスタムオーダーを更新
        const studentOrders = newSortedStudents.map((student, index) => ({
          studentId: student.id,
          customOrder: index,
        }))

        await onStudentOrderUpdate(examId, studentOrders)
      } else {
        // 単一選択の場合の処理
        const newSortedStudents = arrayMove(sortedStudents, oldIndex, newIndex)
        setSortedStudents(newSortedStudents)

        // カスタムオーダーを更新
        const studentOrders = newSortedStudents.map((student, index) => ({
          studentId: student.id,
          customOrder: index,
        }))

        await onStudentOrderUpdate(examId, studentOrders)
      }
    },
    [sortedStudents, selectedStudents, onStudentOrderUpdate, examId]
  )

  // チェックボックスのトグル（Shiftキー対応）
  const handleStudentToggle = useCallback(
    (studentId: string, event?: React.MouseEvent) => {
      const currentIndex = sortedStudents.findIndex((s) => s.id === studentId)

      if (
        event?.shiftKey &&
        lastSelectedIndex !== null &&
        currentIndex !== -1
      ) {
        // Shift+クリックの場合は範囲選択
        const start = Math.min(lastSelectedIndex, currentIndex)
        const end = Math.max(lastSelectedIndex, currentIndex)

        const isCurrentSelected = selectedStudents.has(studentId)

        for (let i = start; i <= end; i++) {
          const student = sortedStudents[i]
          if (student) {
            onStudentSelectionChange(student.id, !isCurrentSelected)
          }
        }
      } else {
        // 通常のクリック
        const isSelected = selectedStudents.has(studentId)
        onStudentSelectionChange(studentId, !isSelected)
        setLastSelectedIndex(currentIndex)
      }
    },
    [
      sortedStudents,
      selectedStudents,
      onStudentSelectionChange,
      lastSelectedIndex,
    ]
  )

  // 全選択のトグル
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      onSelectAll(checked)
      setLastSelectedIndex(null)
    },
    [onSelectAll]
  )

  // リセット実行（学級順→出席番号順でcustomOrderを振り直す）
  const handleResetOrder = useCallback(async () => {
    // デフォルト順（学級順→出席番号順）でソート
    const defaultSorted = [...sortedStudents].sort((a, b) => {
      const aClassOrder = a.examClassInfo?.classOrder ?? 99999
      const bClassOrder = b.examClassInfo?.classOrder ?? 99999

      if (aClassOrder !== bClassOrder) {
        return aClassOrder - bClassOrder
      }

      const aAttendance = a.examClassInfo?.attendanceNumber ?? 99999
      const bAttendance = b.examClassInfo?.attendanceNumber ?? 99999
      return aAttendance - bAttendance
    })

    // customOrderを0からの連番で再割り当て
    const newOrders = defaultSorted.map((student, index) => ({
      studentId: student.id,
      customOrder: index,
    }))

    await onStudentOrderUpdate(examId, newOrders)
  }, [sortedStudents, onStudentOrderUpdate, examId])

  const activeStudent = activeId
    ? sortedStudents.find((s) => s.id === activeId) || null
    : null

  return {
    sortedStudents,
    activeStudent,
    handleDragStart,
    handleDragEnd,
    handleStudentToggle,
    handleSelectAll,
    handleResetOrder,
    onStudentStatusUpdate,
  }
}
