"use client"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useEffect, useMemo, useState } from "react"

import type { RosterRow } from "@/components/common/roster-table/types"

/** customOrder 優先・なければ classroomOrder→attendanceNumber でソート */
function compareByCustomOrder(rowA: RosterRow, rowB: RosterRow): number {
  const rowAHasCustom =
    rowA.customOrder !== null && rowA.customOrder !== undefined
  const rowBHasCustom =
    rowB.customOrder !== null && rowB.customOrder !== undefined

  if (rowAHasCustom && rowBHasCustom) {
    return rowA.customOrder! - rowB.customOrder!
  }
  if (rowAHasCustom) return -1
  if (rowBHasCustom) return 1

  return compareByDefault(rowA, rowB)
}

/** 学級順→出席番号順（デフォルト順）。同順位はふりがな→生徒番号で決定的に順序付ける */
function compareByDefault(rowA: RosterRow, rowB: RosterRow): number {
  const rowAClassroomOrder = rowA.classroomInfo.classroomOrder ?? 99999
  const rowBClassroomOrder = rowB.classroomInfo.classroomOrder ?? 99999
  if (rowAClassroomOrder !== rowBClassroomOrder) {
    return rowAClassroomOrder - rowBClassroomOrder
  }
  const rowAAttendance = rowA.classroomInfo.attendanceNumber ?? 99999
  const rowBAttendance = rowB.classroomInfo.attendanceNumber ?? 99999
  if (rowAAttendance !== rowBAttendance) {
    return rowAAttendance - rowBAttendance
  }
  const kanaComparison = rowA.kana.localeCompare(rowB.kana, "ja")
  if (kanaComparison !== 0) return kanaComparison
  return rowA.studentNumber.localeCompare(rowB.studentNumber, "ja")
}

interface UseRosterTableParams {
  /** 全対象の行（フィルタ未適用。順序リセットはこちらを対象にする） */
  allRows: RosterRow[]
  /** 表示対象（フィルタ適用済み）の行 */
  filteredRows: RosterRow[]
  /** 選択中の studentId 集合（制御） */
  selectedIds: Set<string>
  /** 選択変更（制御） */
  onSelectionChange: (studentId: string, isSelected: boolean) => void
  /** 全選択トグル（制御） */
  onSelectAll: (isSelected: boolean) => void
  /** 並び順更新の永続化（待ちたい呼び出し元のために Promise も許す） */
  onOrderUpdate: (
    rowOrders: { studentId: string; customOrder: number }[]
  ) => void | Promise<void>
}

/**
 * 名簿テーブルのドラッグ並び替え・Shift範囲選択・順序リセットを管理するフック
 *
 * 試験名簿の挙動（複数選択ドラッグ・Shift範囲選択・学級順リセット）を踏襲する。
 */
export function useRosterTable({
  allRows,
  filteredRows,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onOrderUpdate,
}: UseRosterTableParams) {
  const [sortedRows, setSortedRows] = useState<RosterRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  )

  // 並び順を初期化・更新
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const sorted = filteredRows.slice().sort(compareByCustomOrder)
      setSortedRows(sorted)
    })
    return () => cancelAnimationFrame(frame)
  }, [filteredRows])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = sortedRows.findIndex((row) => row.id === active.id)
      const newIndex = sortedRows.findIndex((row) => row.id === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      const selectedRowsList = sortedRows.filter((row) =>
        selectedIds.has(row.id)
      )

      // ドラッグ対象が選択済みかつ複数選択中なら、選択分をまとめて移動
      if (selectedIds.has(active.id as string) && selectedRowsList.length > 1) {
        const newSortedRows = [...sortedRows]

        const selectedRowsData = selectedRowsList
          .map((row) => {
            const index = newSortedRows.findIndex(
              (sortedRow) => sortedRow.id === row.id
            )
            return newSortedRows.splice(index, 1)[0]
          })
          .filter(Boolean)

        const targetIndex =
          newIndex <= oldIndex
            ? newIndex
            : newIndex - selectedRowsList.length + 1
        newSortedRows.splice(targetIndex, 0, ...selectedRowsData)

        setSortedRows(newSortedRows)

        const rowOrders = newSortedRows.map((row, index) => ({
          studentId: row.id,
          customOrder: index,
        }))
        await onOrderUpdate(rowOrders)
      } else {
        const newSortedRows = arrayMove(sortedRows, oldIndex, newIndex)
        setSortedRows(newSortedRows)

        const rowOrders = newSortedRows.map((row, index) => ({
          studentId: row.id,
          customOrder: index,
        }))
        await onOrderUpdate(rowOrders)
      }
    },
    [sortedRows, selectedIds, onOrderUpdate]
  )

  // チェックボックスのトグル（Shiftキー対応）
  const handleToggleSelection = useCallback(
    (studentId: string, event?: React.MouseEvent) => {
      const currentIndex = sortedRows.findIndex((row) => row.id === studentId)

      if (
        event?.shiftKey &&
        lastSelectedIndex !== null &&
        currentIndex !== -1
      ) {
        const start = Math.min(lastSelectedIndex, currentIndex)
        const end = Math.max(lastSelectedIndex, currentIndex)
        const isCurrentSelected = selectedIds.has(studentId)

        for (let i = start; i <= end; i++) {
          const row = sortedRows[i]
          if (row) {
            onSelectionChange(row.id, !isCurrentSelected)
          }
        }
      } else {
        const isSelected = selectedIds.has(studentId)
        onSelectionChange(studentId, !isSelected)
        setLastSelectedIndex(currentIndex)
      }
    },
    [sortedRows, selectedIds, onSelectionChange, lastSelectedIndex]
  )

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      onSelectAll(checked)
      setLastSelectedIndex(null)
    },
    [onSelectAll]
  )

  // リセット（学級順→出席番号順で customOrder を振り直す。
  // 表示中の行だけでなく全対象を振り直さないと、フィルタ適用中のリセットで
  // 非表示行の旧 customOrder と衝突して並びが壊れる）
  const handleResetOrder = useCallback(async () => {
    const defaultSorted = [...allRows].sort(compareByDefault)
    const newOrders = defaultSorted.map((row, index) => ({
      studentId: row.id,
      customOrder: index,
    }))
    await onOrderUpdate(newOrders)
  }, [allRows, onOrderUpdate])

  const activeRow = useMemo(
    () =>
      activeId ? (sortedRows.find((row) => row.id === activeId) ?? null) : null,
    [activeId, sortedRows]
  )

  return {
    sortedRows,
    activeRow,
    handleDragStart,
    handleDragEnd,
    handleToggleSelection,
    handleSelectAll,
    handleResetOrder,
  }
}
