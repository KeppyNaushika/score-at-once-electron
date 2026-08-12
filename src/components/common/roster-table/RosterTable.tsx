"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"

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
/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ROWS: RosterRow[] = []
const EMPTY_CLASSROOMS: RosterClassroomOption[] = []

export function RosterTable({
  adapter,
  slots,
  enableRemove = false,
  onLoadingChange,
  registerHandle,
  onRowsChange,
}: RosterTableProps) {
  const queryClient = useQueryClient()
  /** この表1つ分のクエリキー。同じ画面に2つ並んでも混ざらない */
  const instanceId = useId()
  const queryKey = useMemo(() => ["rosterTable", instanceId], [instanceId])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClassroomId, setSelectedClassroomId] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  /** 削除確認の対象。null なら確認ダイアログを出していない */
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[] | null>(
    null
  )
  const [isRemoving, setIsRemoving] = useState(false)
  const [removalError, setRemovalError] = useState<string | null>(null)

  const additionalColumns = useMemo(
    () => slots?.additionalColumns ?? [],
    [slots?.additionalColumns]
  )
  const additionalFilters = useMemo(
    () => slots?.additionalFilters ?? [],
    [slots?.additionalFilters]
  )

  // 行と学級の選択肢は必ず対で使う（学級で絞るので）ので1つの取得にまとめる
  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const [rows, classrooms] = await Promise.all([
        adapter.fetchRows(),
        adapter.fetchClassrooms(),
      ])
      return { rows, classrooms }
    },
  })
  const rows = data?.rows ?? EMPTY_ROWS
  const classrooms = data?.classrooms ?? EMPTY_CLASSROOMS

  const loadData = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  /** 並べ替えの楽観更新。キャッシュを直に差し替える */
  const patchRows = useCallback(
    (update: (rows: RosterRow[]) => RosterRow[]) => {
      queryClient.setQueryData<{
        rows: RosterRow[]
        classrooms: RosterClassroomOption[]
      }>(queryKey, (previous) =>
        previous ? { ...previous, rows: update(previous.rows) } : previous
      )
    },
    [queryClient, queryKey]
  )

  // 取得の状態・行の件数・再取得の口は親へ押し出す（外部システムへの同期）
  useEffect(() => {
    onLoadingChange?.(isFetching)
  }, [isFetching, onLoadingChange])

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

      const matchesClassroom =
        selectedClassroomId === "all" ||
        row.classroomInfo.className ===
          classrooms.find((classroom) => classroom.id === selectedClassroomId)
            ?.name

      const matchesAdditional = additionalFilters.every((filter) =>
        filter.predicate(row)
      )

      return matchesSearch && matchesClassroom && matchesAdditional
    })
  }, [rows, searchTerm, selectedClassroomId, classrooms, additionalFilters])

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
      patchRows((prev) =>
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
    [adapter, loadData, patchRows]
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
    allRows: rows,
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

  const handleConfirmRemove = async () => {
    if (!pendingRemovalIds) return
    setIsRemoving(true)
    setRemovalError(null)
    try {
      await adapter.removeRows(pendingRemovalIds)
      setSelectedIds(new Set())
      await loadData()
      setPendingRemovalIds(null)
    } catch (error) {
      // 失敗はダイアログを開いたまま伝える。閉じてしまうと console 以外に痕跡が残らず、
      // 消えていないのに消えたように見える
      console.error("Failed to remove rows:", error)
      setRemovalError(
        error instanceof Error ? error.message : "削除に失敗しました"
      )
    } finally {
      setIsRemoving(false)
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
          onClassroomChange={setSelectedClassroomId}
          classrooms={classrooms}
          additionalFilters={additionalFilters}
        />
        {enableRemove && selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPendingRemovalIds(Array.from(selectedIds))}
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
                手動で設定した並び順を、学級の関連付け設定に基づいて再設定します（検索・フィルタ中でも全生徒が対象になります）。
              </span>
              <span className="block font-medium">リセット後の並び順：</span>
              <span className="block pl-4 text-muted-foreground">
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

      {/* 生徒削除の確認ダイアログ。名簿から外すと子データも cascade で消えるため、
          何が失われるかを事前に明示する（試験05の削除確認と同じ扱い） */}
      <AlertDialog
        open={pendingRemovalIds !== null}
        onOpenChange={(open) => {
          if (!open && !isRemoving) {
            setPendingRemovalIds(null)
            setRemovalError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              選択した生徒{pendingRemovalIds?.length ?? 0}名を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                生徒を削除すると、以下のデータも連動して削除されます：
              </span>
              <span className="block pl-4 text-muted-foreground">
                {(slots?.removalLosses ?? ["この名簿に入力された値"]).map(
                  (loss) => (
                    <span key={loss} className="block">
                      ・{loss}
                    </span>
                  )
                )}
              </span>
              <span className="block font-medium">
                この操作は取り消すことができません。
              </span>
              {removalError && (
                <span className="block font-medium text-destructive">
                  {removalError}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              // 既定の「クリックで閉じる」を止め、削除が終わるまでダイアログを残す。
              // 閉じてしまうと進行表示も失敗通知も出せない。
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmRemove()
              }}
              disabled={isRemoving}
            >
              {isRemoving ? "削除中..." : "削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
