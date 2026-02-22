"use client"

import { useState } from "react"

import { SortableTableProvider } from "@/components/common/sortable-table"
import { DragOverlayContent } from "@/components/projects/05-students/components/sortable-student-table/components/DragOverlayContent"
import { SortableTableRow } from "@/components/projects/05-students/components/sortable-student-table/components/SortableTableRow"
import { TableFilters } from "@/components/projects/05-students/components/sortable-student-table/components/TableFilters"
import { TableHeaderRow } from "@/components/projects/05-students/components/sortable-student-table/components/TableHeaderRow"
import { useSortableStudentTable } from "@/components/projects/05-students/components/sortable-student-table/hooks/useSortableStudentTable"
import type { SortableStudentTableProps } from "@/components/projects/05-students/components/sortable-student-table/types/studentTableTypes"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody } from "@/components/ui/table"

/**
 * 生徒テーブルコンテナ
 *
 * フィルタ・ドラッグ並び替え・選択・並び順リセットを統合した受験生徒管理テーブル。
 */
export function SortableStudentTableContainer(
  props: SortableStudentTableProps
) {
  const {
    classes,
    selectedStudents,
    searchTerm,
    onSearchChange,
    selectedClassId,
    onClassChange,
    statusFilter,
    onStatusChange,
  } = props

  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const {
    sortedStudents,
    activeStudent,
    handleDragStart,
    handleDragEnd,
    handleStudentToggle,
    handleSelectAll,
    handleResetOrder,
    onStudentStatusUpdate,
  } = useSortableStudentTable(props)

  const handleConfirmReset = async () => {
    setIsResetting(true)
    try {
      await handleResetOrder()
    } finally {
      setIsResetting(false)
      setShowResetDialog(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* フィルター行 */}
      <div className="flex items-center gap-3">
        <TableFilters
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          selectedClassId={selectedClassId}
          onClassChange={onClassChange}
          statusFilter={statusFilter}
          onStatusChange={onStatusChange}
          classes={classes}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetDialog(true)}
        >
          並び順をリセット
        </Button>
      </div>

      {/* テーブル */}
      <div className="min-h-96 rounded-md border">
        <SortableTableProvider
          items={sortedStudents.map((student) => student.id)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          dragOverlay={
            <DragOverlayContent
              activeStudent={activeStudent}
              selectedStudents={selectedStudents}
            />
          }
        >
          <Table>
            <TableHeaderRow
              sortedStudents={sortedStudents}
              selectedStudents={selectedStudents}
              onSelectAll={handleSelectAll}
            />
            <TableBody>
              {sortedStudents.map((student) => (
                <SortableTableRow
                  key={student.id}
                  student={student}
                  isSelected={selectedStudents.has(student.id)}
                  onToggleSelection={(studentId) =>
                    handleStudentToggle(studentId)
                  }
                  onStatusUpdate={onStudentStatusUpdate}
                />
              ))}
            </TableBody>
          </Table>
        </SortableTableProvider>
      </div>

      {/* 並び順リセット確認ダイアログ */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>並び順をリセットしますか？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                手動で設定した並び順を、学級の関連付け設定に基づいて再設定します。
              </span>
              <span className="block font-medium">リセット後の並び順：</span>
              <span className="text-muted-foreground block pl-4">
                1. 学級の関連付け順（上から順）
                <br />
                2. 学級内の出席番号順
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={isResetting}
            >
              {isResetting ? "リセット中..." : "リセット"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
