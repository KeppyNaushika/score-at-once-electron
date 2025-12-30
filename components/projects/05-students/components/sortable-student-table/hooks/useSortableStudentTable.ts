"use client"

import type {
  ClassGroup,
  Student,
  StudentStatus,
} from "@/components/projects/05-students/components/sortable-student-table/types/studentTableTypes"
import {
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useEffect, useState } from "react"

interface UseSortableStudentTableProps {
  classes: ClassGroup[]
  filteredStudents: Student[]
  selectedStudents: Set<string>
  onStudentSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  onStudentOrderUpdate: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<void>
  onStudentStatusUpdate: (
    studentId: string,
    status: StudentStatus
  ) => Promise<void>
  projectId: string
}

export function useSortableStudentTable({
  classes,
  filteredStudents,
  selectedStudents,
  onStudentSelectionChange,
  onSelectAll,
  onStudentOrderUpdate,
  onStudentStatusUpdate,
  projectId,
}: UseSortableStudentTableProps) {
  const [sortedStudents, setSortedStudents] = useState<Student[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  )

  // センサーの設定（マウスとキーボード対応）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動したらドラッグ開始
      },
    }),
    useSensor(KeyboardSensor)
  )

  // 生徒の並び順を初期化・更新
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // まず学級順→出席番号順でソート
      const classMap = new Map<string, ClassGroup>()
      classes.forEach((cls) => classMap.set(cls.id, cls))

      const defaultSorted = filteredStudents.slice().sort((a, b) => {
        const aClass = a.memberships[0]?.class.name || ""
        const bClass = b.memberships[0]?.class.name || ""
        const aAttendance = a.memberships[0]?.attendanceNumber || 99999
        const bAttendance = b.memberships[0]?.attendanceNumber || 99999

        // 学級名でソート
        if (aClass !== bClass) {
          return aClass.localeCompare(bClass)
        }

        // 同じ学級内では出席番号でソート
        return aAttendance - bAttendance
      })

      // カスタムオーダーがある場合はそれを優先
      const withCustomOrder = defaultSorted.slice().sort((a, b) => {
        // カスタムオーダーが両方ある場合
        if (
          a.customOrder !== null &&
          a.customOrder !== undefined &&
          b.customOrder !== null &&
          b.customOrder !== undefined
        ) {
          return a.customOrder - b.customOrder
        }

        // aにのみカスタムオーダーがある場合
        if (a.customOrder !== null && a.customOrder !== undefined) {
          return -1
        }

        // bにのみカスタムオーダーがある場合
        if (b.customOrder !== null && b.customOrder !== undefined) {
          return 1
        }

        // 両方カスタムオーダーがない場合はデフォルトの順序を維持
        return 0
      })

      setSortedStudents(withCustomOrder)
    })

    return () => cancelAnimationFrame(frame)
  }, [filteredStudents, classes])

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

        await onStudentOrderUpdate(projectId, studentOrders)
      } else {
        // 単一選択の場合の処理
        const newSortedStudents = arrayMove(sortedStudents, oldIndex, newIndex)
        setSortedStudents(newSortedStudents)

        // カスタムオーダーを更新
        const studentOrders = newSortedStudents.map((student, index) => ({
          studentId: student.id,
          customOrder: index,
        }))

        await onStudentOrderUpdate(projectId, studentOrders)
      }
    },
    [sortedStudents, selectedStudents, onStudentOrderUpdate, projectId]
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

  // リセットボタン（デフォルトの並び順に戻す）
  const handleResetOrder = useCallback(async () => {
    // customOrderをすべてnullにリセット
    const studentOrders = sortedStudents.map((student) => ({
      studentId: student.id,
      customOrder: 0, // 一時的に0を設定
    }))

    // データベースを更新してからリロード
    await onStudentOrderUpdate(projectId, studentOrders)

    // その後、customOrderをnullにするため、負の値で再更新
    const resetOrders = sortedStudents.map((student) => ({
      studentId: student.id,
      customOrder: -1, // 負の値でリセットの合図
    }))

    await onStudentOrderUpdate(projectId, resetOrders)
  }, [sortedStudents, onStudentOrderUpdate, projectId])

  const activeStudent = activeId
    ? sortedStudents.find((s) => s.id === activeId) || null
    : null

  return {
    sortedStudents,
    activeStudent,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleStudentToggle,
    handleSelectAll,
    handleResetOrder,
    onStudentStatusUpdate,
  }
}
