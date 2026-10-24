"use client"

import type { Classroom } from "@prisma/client"
import { RotateCcw } from "lucide-react"
import { type ReactNode, useState } from "react"

import { RosterDragOverlay } from "@/components/common/roster-table/RosterDragOverlay"
import { RosterTableFilters } from "@/components/common/roster-table/RosterTableFilters"
import { RosterTableHeader } from "@/components/common/roster-table/RosterTableHeader"
import { RosterTableRow } from "@/components/common/roster-table/RosterTableRow"
import type {
  RosterColumn,
  RosterRow,
  RosterTableSlots,
} from "@/components/common/roster-table/types"
import { useRosterTable } from "@/components/common/roster-table/useRosterTable"
import { SortableTableProvider } from "@/components/common/sortable-table"
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

interface RosterTableViewProps {
  /** 全対象の行（フィルタ未適用。順序リセットはこちらを対象にする） */
  allRows: RosterRow[]
  /** 表示対象（フィルタ適用済み）の行 */
  filteredRows: RosterRow[]
  selectedIds: Set<string>
  onSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  /** 並び順を書き、読み直すところまで（`useRosterTable` の同名引数を参照） */
  onOrderUpdate: (
    rowOrders: { studentId: string; customOrder: number }[]
  ) => void | Promise<void>
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassroomId: string
  onClassroomChange: (value: string) => void
  classrooms: Classroom[]
  /**
   * 学級フィルタの後ろに置く追加の絞り込みの UI（表示だけ）。
   * この部品は行を絞らない。`filteredRows` は呼び手が絞り終えたものを渡す
   */
  extraFilterControls?: ReactNode
  additionalColumns: RosterColumn[]
  rowActionButtons?: RosterTableSlots["rowActionButtons"]
  /** フィルタ行の「並び順をリセット」の手前に置く操作（選択した生徒の削除など） */
  toolbarActions?: ReactNode
  /** 「並び順をリセット」のボタンにアイコンを付けるか */
  showResetButtonIcon: boolean
}

/**
 * 名簿テーブルの表示（フィルタ行・ドラッグ並び替えの表・並び順リセットの確認）。
 *
 * 状態は持たない。行・選択・絞り込みの持ち主は呼び手で、成績・試験外成績資料の
 * `RosterTable`（アダプタで自前に取得する）と、試験の受験生徒の表（ページ側の
 * フックが持つ）の2通りがここを通る。行の見た目を変えるときは `RosterTableRow` の
 * 1か所で済む。
 */
export function RosterTableView({
  allRows,
  filteredRows,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onOrderUpdate,
  searchTerm,
  onSearchChange,
  selectedClassroomId,
  onClassroomChange,
  classrooms,
  extraFilterControls,
  additionalColumns,
  rowActionButtons,
  toolbarActions,
  showResetButtonIcon,
}: RosterTableViewProps) {
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const {
    sortedRows,
    activeRow,
    handleDragStart,
    handleDragEnd,
    handleToggleSelection,
    handleSelectAll,
    handleResetOrder,
  } = useRosterTable({
    allRows,
    filteredRows,
    selectedIds,
    onSelectionChange,
    onSelectAll,
    onOrderUpdate,
  })

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
    <>
      {/* フィルター行 */}
      <div className="flex items-center gap-3">
        <RosterTableFilters
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          selectedClassroomId={selectedClassroomId}
          onClassroomChange={onClassroomChange}
          classrooms={classrooms}
          extraFilterControls={extraFilterControls}
        />
        {toolbarActions}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetDialog(true)}
        >
          {showResetButtonIcon && <RotateCcw className="mr-1 h-3 w-3" />}
          並び順をリセット
        </Button>
      </div>

      {/* テーブル */}
      <div className="min-h-96 rounded-md border">
        <SortableTableProvider
          items={sortedRows.map((row) => row.id)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          dragOverlay={
            <RosterDragOverlay
              activeRow={activeRow}
              selectedIds={selectedIds}
            />
          }
        >
          <Table>
            <RosterTableHeader
              sortedRows={sortedRows}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              additionalColumns={additionalColumns}
              rowActionButtons={rowActionButtons}
            />
            <TableBody>
              {sortedRows.map((row) => (
                <RosterTableRow
                  key={row.id}
                  row={row}
                  isSelected={selectedIds.has(row.id)}
                  onToggleSelection={handleToggleSelection}
                  additionalColumns={additionalColumns}
                  rowActionButtons={rowActionButtons}
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
                手動で設定した並び順を、学級の対応付けの設定に基づいて再設定します（検索・フィルタ中でも全生徒が対象になります）。
              </span>
              <span className="block font-medium">リセット後の並び順：</span>
              <span className="block pl-4 text-muted-foreground">
                1. 学級の対応付けの順（上から順）
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
    </>
  )
}
