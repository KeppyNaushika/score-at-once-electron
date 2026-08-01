"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { Plus, Trash2 } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useState } from "react"

import {
  DragHandle,
  SortableTableProvider,
  useSortableRow,
} from "@/components/common/sortable-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { ClassroomRemovalDialog } from "./ClassroomRemovalDialog"
import type {
  AvailableClassroomOption,
  ClassroomRemovalMode,
  ClassroomRemovalPreview,
  ClassroomRosterEntry,
  ClassroomRosterFlagColumn,
} from "./types"

interface ClassroomRosterManagerProps {
  entries: ClassroomRosterEntry[]
  /** エンティティ固有のフラグ列（試験=再採番1列、成績/資料=なし） */
  flagColumns?: ClassroomRosterFlagColumn[]
  removalMode: ClassroomRemovalMode
  description?: ReactNode
  emptyHint?: ReactNode
  /**
   * 追加候補の学級を取得。省略時は追加ダイアログを出さない
   * （成績/資料は別途 StudentAddPanel が学級追加を担うため省略する）。
   */
  fetchAvailableClassrooms?: () => Promise<AvailableClassroomOption[]>
  /** 学級を追加。{@link fetchAvailableClassrooms} と対で指定する */
  onAddClassrooms?: (classroomIds: string[]) => Promise<void>
  /** order並び替え（D&D）。失敗時は throw すると楽観更新がロールバックされる */
  onReorder: (orderedIds: string[]) => Promise<void>
  /** 削除実行（deleteStudents=trueで専属生徒も削除） */
  onRemove: (
    entry: ClassroomRosterEntry,
    deleteStudents: boolean
  ) => Promise<void>
  /** can-delete-students モードの削除プレビュー */
  fetchRemovalPreview?: (
    entry: ClassroomRosterEntry
  ) => Promise<ClassroomRemovalPreview>
  /** 専属生徒を削除したときに連動して消えるもの（最終確認に列挙する） */
  deletionLosses?: string[]
  /** 変更後に親へ再読込を通知 */
  onChanged?: () => void
  /** 追加ダイアログの外部制御（任意） */
  showAddDialog?: boolean
  onShowAddDialogChange?: (open: boolean) => void
}

interface ClassroomRowProps {
  entry: ClassroomRosterEntry
  flagColumns: ClassroomRosterFlagColumn[]
  onRemove: (entry: ClassroomRosterEntry) => void
}

/** 並び替え以外の共通セル（学級名・学年・生徒数・フラグ・削除） */
function ClassroomRowCells({
  entry,
  flagColumns,
  onRemove,
}: ClassroomRowProps) {
  return (
    <>
      <TableCell className="font-medium">
        {entry.name}
        {entry.classroomCode && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({entry.classroomCode})
          </span>
        )}
      </TableCell>
      <TableCell>{entry.grade ? `${entry.grade}年` : "-"}</TableCell>
      <TableCell className="text-center">{entry.studentCount}名</TableCell>
      {flagColumns.map((flagColumn) => (
        <TableCell key={flagColumn.key} className="text-center">
          <Checkbox
            checked={flagColumn.checked(entry)}
            onCheckedChange={(checked) =>
              flagColumn.onChange(entry, checked === true)
            }
          />
        </TableCell>
      ))}
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => onRemove(entry)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </>
  )
}

/** D&D対応の行（SortableTableProvider の内側でのみ使う） */
function SortableClassroomRow(props: ClassroomRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(props.entry.id)
  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <DragHandle dragHandleProps={dragHandleProps} />
      </TableCell>
      <ClassroomRowCells {...props} />
    </TableRow>
  )
}

/**
 * 学級登録の共通管理コンポーネント（試験・成績・資料で共用）。
 *
 * 登録一覧の表示・order並び替え（任意）・追加ダイアログ・削除（2段階モーダル内包）を提供する。
 * 試験固有の「再採番」フラグ等は {@link ClassroomRosterFlagColumn} で差し込む。
 */
export function ClassroomRosterManager({
  entries,
  flagColumns = [],
  removalMode,
  description,
  emptyHint,
  fetchAvailableClassrooms,
  onAddClassrooms,
  onReorder,
  onRemove,
  fetchRemovalPreview,
  deletionLosses,
  onChanged,
  showAddDialog: externalShowAddDialog,
  onShowAddDialogChange,
}: ClassroomRosterManagerProps) {
  const [internalShowAddDialog, setInternalShowAddDialog] = useState(false)
  // DnD の楽観更新。どの entries に対する並びかを一緒に持ち、
  // 親がデータを読み直したら（entries が差し替わったら）破棄して最新に従う
  const [reorderedEntries, setReorderedEntries] = useState<{
    source: ClassroomRosterEntry[]
    entries: ClassroomRosterEntry[]
  } | null>(null)
  const [availableClassrooms, setAvailableClassrooms] = useState<
    AvailableClassroomOption[]
  >([])
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(
    new Set()
  )
  const [adding, setAdding] = useState(false)
  const [removalTarget, setRemovalTarget] =
    useState<ClassroomRosterEntry | null>(null)

  const addEnabled =
    fetchAvailableClassrooms !== undefined && onAddClassrooms !== undefined
  const showAddDialog = externalShowAddDialog ?? internalShowAddDialog
  const setShowAddDialog = onShowAddDialogChange ?? setInternalShowAddDialog

  const localEntries =
    reorderedEntries?.source === entries ? reorderedEntries.entries : entries

  const loadAvailableClassrooms = useCallback(async () => {
    if (!fetchAvailableClassrooms) return
    try {
      setAvailableClassrooms(await fetchAvailableClassrooms())
    } catch (err) {
      console.error("Failed to fetch available classrooms:", err)
    }
  }, [fetchAvailableClassrooms])

  useEffect(() => {
    if (showAddDialog) {
      loadAvailableClassrooms()
      setSelectedClassroomIds(new Set())
    }
  }, [showAddDialog, loadAvailableClassrooms])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localEntries.findIndex((entry) => entry.id === active.id)
    const newIndex = localEntries.findIndex((entry) => entry.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const newOrder = [...localEntries]
    const [removed] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, removed)
    setReorderedEntries({ source: entries, entries: newOrder })

    try {
      await onReorder(newOrder.map((entry) => entry.id))
      onChanged?.()
    } catch (err) {
      console.error("Failed to reorder classrooms:", err)
      setReorderedEntries(null)
    }
  }

  const handleAddClassrooms = async () => {
    if (selectedClassroomIds.size === 0 || !onAddClassrooms) return
    setAdding(true)
    try {
      await onAddClassrooms([...selectedClassroomIds])
      setShowAddDialog(false)
      onChanged?.()
    } catch (err) {
      console.error("Failed to add classrooms:", err)
    } finally {
      setAdding(false)
    }
  }

  const toggleClassroomSelection = (classroomId: string) => {
    setSelectedClassroomIds((prev) => {
      const next = new Set(prev)
      if (next.has(classroomId)) next.delete(classroomId)
      else next.add(classroomId)
      return next
    })
  }

  const body = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12.5"></TableHead>
          <TableHead>クラス名</TableHead>
          <TableHead>学年</TableHead>
          <TableHead className="text-center">生徒数</TableHead>
          {flagColumns.map((flagColumn) => (
            <TableHead key={flagColumn.key} className="text-center">
              {flagColumn.header}
            </TableHead>
          ))}
          <TableHead className="w-20"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {localEntries.map((entry) => (
          <SortableClassroomRow
            key={entry.id}
            entry={entry}
            flagColumns={flagColumns}
            onRemove={setRemovalTarget}
          />
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {localEntries.length === 0 ? (
        <div className="rounded-md border py-8 text-center text-muted-foreground">
          <p>学級が関連付けられていません</p>
          {emptyHint && <p className="mt-1 text-sm">{emptyHint}</p>}
        </div>
      ) : (
        <div className="rounded-md border">
          <SortableTableProvider
            items={localEntries.map((entry) => entry.id)}
            onDragEnd={handleDragEnd}
          >
            {body}
          </SortableTableProvider>
        </div>
      )}

      {/* 削除確認（2段階モーダルを内包） */}
      <ClassroomRemovalDialog
        entry={removalTarget}
        mode={removalMode}
        fetchRemovalPreview={fetchRemovalPreview}
        deletionLosses={deletionLosses}
        onConfirm={async (entry, deleteStudents) => {
          await onRemove(entry, deleteStudents)
          onChanged?.()
        }}
        onClose={() => setRemovalTarget(null)}
      />

      {/* 学級追加ダイアログ（add無効時は出さない） */}
      <Dialog
        open={addEnabled && showAddDialog}
        onOpenChange={setShowAddDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>学級を追加</DialogTitle>
            <DialogDescription>
              関連付けるクラスを選択してください。
            </DialogDescription>
          </DialogHeader>

          {availableClassrooms.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>追加可能なクラスがありません</p>
              <p className="mt-1 text-sm">
                「クラス管理」から新しいクラスを作成してください
              </p>
            </div>
          ) : (
            <div className="max-h-100 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12.5"></TableHead>
                    <TableHead>クラス名</TableHead>
                    <TableHead>学年</TableHead>
                    <TableHead className="text-center">生徒数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableClassrooms.map((availableClassroom) => (
                    <TableRow
                      key={availableClassroom.id}
                      className={`cursor-pointer ${
                        selectedClassroomIds.has(availableClassroom.id)
                          ? "bg-accent"
                          : ""
                      }`}
                      onClick={() =>
                        toggleClassroomSelection(availableClassroom.id)
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedClassroomIds.has(
                            availableClassroom.id
                          )}
                          onCheckedChange={() =>
                            toggleClassroomSelection(availableClassroom.id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {availableClassroom.name}
                        {availableClassroom.classroomCode && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({availableClassroom.classroomCode})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {availableClassroom.grade
                          ? `${availableClassroom.grade}年`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {availableClassroom.studentCount}名
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddClassrooms}
              disabled={selectedClassroomIds.size === 0 || adding}
            >
              <Plus className="mr-2 h-4 w-4" />
              {adding ? "追加中..." : `${selectedClassroomIds.size}件追加`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
