"use client"

import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { RosterDragOverlay } from "@/components/common/roster-table/RosterDragOverlay"
import { RosterTableFilters } from "@/components/common/roster-table/RosterTableFilters"
import { RosterTableHeader } from "@/components/common/roster-table/RosterTableHeader"
import { RosterTableRow } from "@/components/common/roster-table/RosterTableRow"
import type {
  RosterClassroomOption,
  RosterRow,
  RosterTableAdapter,
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

export interface RosterTableHandle {
  /** 外部から名簿を再読み込みする */
  refresh: () => Promise<void>
}

interface RosterTableProps {
  /** データ取得・更新・削除のアダプター */
  adapter: RosterTableAdapter
  /** スロット（未指定時は素の名簿として動作） */
  slots?: RosterTableSlots
  /** 選択中の生徒に対する削除アクションを表示するか（既定 false） */
  enableRemove?: boolean
  /** データ読み込み完了時に呼ばれる（読み込み中表示の制御等に使う） */
  onLoadingChange?: (loading: boolean) => void
  /** refresh を外部公開するためのコールバック ref */
  registerHandle?: (handle: RosterTableHandle) => void
  /** 行数を外部へ通知する */
  onRowsChange?: (rows: RosterRow[]) => void
}

/**
 * 名簿テーブル共通部品（自己完結・アダプター方式）
 *
 * コア列・検索/学級フィルタ・ドラッグ並び替え・複数選択・順序リセットを内蔵し、
 * 追加列/追加フィルタ/行アクション/削除ガードをスロットで差し込む。
 * 成績・試験外成績資料の素の名簿に使用する。
 */
export function RosterTable({
  adapter,
  slots,
  enableRemove = false,
  onLoadingChange,
  registerHandle,
  onRowsChange,
}: RosterTableProps) {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [classes, setClasses] = useState<RosterClassroomOption[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClassroomId, setSelectedClassroomId] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const additionalColumns = useMemo(
    () => slots?.additionalColumns ?? [],
    [slots?.additionalColumns]
  )
  const additionalFilters = useMemo(
    () => slots?.additionalFilters ?? [],
    [slots?.additionalFilters]
  )

  const loadData = useCallback(async () => {
    onLoadingChange?.(true)
    try {
      const [fetchedRows, fetchedClasses] = await Promise.all([
        adapter.fetchRows(),
        adapter.fetchClasses(),
      ])
      setRows(fetchedRows)
      setClasses(fetchedClasses)
    } catch (error) {
      console.error("Failed to load roster data:", error)
    } finally {
      onLoadingChange?.(false)
    }
  }, [adapter, onLoadingChange])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    registerHandle?.({ refresh: loadData })
  }, [registerHandle, loadData])

  useEffect(() => {
    onRowsChange?.(rows)
  }, [rows, onRowsChange])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const fullName = `${row.lastName} ${row.firstName}`.toLowerCase()
      const fullKana = row.kana.toLowerCase()
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        fullName.includes(term) ||
        fullKana.includes(term) ||
        row.studentNumber.toLowerCase().includes(term)

      const matchesClass =
        selectedClassroomId === "all" ||
        row.classInfo.className ===
          classes.find((classroom) => classroom.id === selectedClassroomId)
            ?.name

      const matchesAdditional = additionalFilters.every((filter) =>
        filter.predicate(row)
      )

      return matchesSearch && matchesClass && matchesAdditional
    })
  }, [rows, searchTerm, selectedClassroomId, classes, additionalFilters])

  const handleSelectionChange = useCallback(
    (studentId: string, isSelected: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (isSelected) {
          next.add(studentId)
        } else {
          next.delete(studentId)
        }
        return next
      })
    },
    []
  )

  const handleSelectAllRows = useCallback(
    (isSelected: boolean) => {
      if (isSelected) {
        setSelectedIds(new Set(filteredRows.map((row) => row.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [filteredRows]
  )

  const handleOrderUpdate = useCallback(
    async (rowOrders: { studentId: string; customOrder: number }[]) => {
      // 楽観的に customOrder を反映
      const orderMap = new Map(
        rowOrders.map((rowOrder) => [rowOrder.studentId, rowOrder.customOrder])
      )
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          customOrder: orderMap.get(row.id) ?? row.customOrder,
        }))
      )
      try {
        await adapter.updateRowOrder(rowOrders)
      } catch (error) {
        console.error("Failed to update row order:", error)
        await loadData()
      }
    },
    [adapter, loadData]
  )

  const {
    sortedRows,
    activeRow,
    handleDragStart,
    handleDragEnd,
    handleToggleSelection,
    handleSelectAll,
    handleResetOrder,
  } = useRosterTable({
    filteredRows,
    selectedIds,
    onSelectionChange: handleSelectionChange,
    onSelectAll: handleSelectAllRows,
    onOrderUpdate: handleOrderUpdate,
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

  const handleRemoveSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    if (slots?.onBeforeRemove) {
      const proceed = await slots.onBeforeRemove(ids)
      if (!proceed) return
    }

    try {
      await adapter.removeRows(ids)
      setSelectedIds(new Set())
      await loadData()
    } catch (error) {
      console.error("Failed to remove rows:", error)
    }
  }

  return (
    <div className="space-y-4">
      {/* フィルター行 */}
      <div className="flex items-center gap-3">
        <RosterTableFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedClassroomId={selectedClassroomId}
          onClassChange={setSelectedClassroomId}
          classes={classes}
          additionalFilters={additionalFilters}
        />
        {enableRemove && selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemoveSelected}
          >
            選択した生徒を削除 ({selectedIds.size})
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetDialog(true)}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
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
              rowActionButtons={slots?.rowActionButtons}
            />
            <TableBody>
              {sortedRows.map((row) => (
                <RosterTableRow
                  key={row.id}
                  row={row}
                  isSelected={selectedIds.has(row.id)}
                  onToggleSelection={(studentId) =>
                    handleToggleSelection(studentId)
                  }
                  additionalColumns={additionalColumns}
                  rowActionButtons={slots?.rowActionButtons}
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
