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

import { ClassRemovalDialog } from "./ClassRemovalDialog"
import type {
  AvailableClassOption,
  ClassRemovalMode,
  ClassRemovalPreview,
  ClassRosterEntry,
  ClassRosterFlagColumn,
} from "./types"

interface ClassRosterManagerProps {
  entries: ClassRosterEntry[]
  /** エンティティ固有のフラグ列（試験=再採番1列、成績/資料=なし） */
  flagColumns?: ClassRosterFlagColumn[]
  removalMode: ClassRemovalMode
  description?: ReactNode
  emptyHint?: ReactNode
  /**
   * 追加候補の学級を取得。省略時は追加ダイアログを出さない
   * （成績/資料は別途 StudentAddPanel が学級追加を担うため省略する）。
   */
  fetchAvailableClasses?: () => Promise<AvailableClassOption[]>
  /** 学級を追加。{@link fetchAvailableClasses} と対で指定する */
  onAddClasses?: (classIds: string[]) => Promise<void>
  /** order並び替え（D&D）。失敗時は throw すると楽観更新がロールバックされる */
  onReorder: (orderedIds: string[]) => Promise<void>
  /** 削除実行（deleteStudents=trueで専属生徒も削除） */
  onRemove: (entry: ClassRosterEntry, deleteStudents: boolean) => Promise<void>
  /** can-delete-students モードの削除プレビュー */
  fetchRemovalPreview?: (
    entry: ClassRosterEntry
  ) => Promise<ClassRemovalPreview>
  /** 変更後に親へ再読込を通知 */
  onChanged?: () => void
  /** 追加ダイアログの外部制御（任意） */
  showAddDialog?: boolean
  onShowAddDialogChange?: (open: boolean) => void
}

interface ClassRowProps {
  entry: ClassRosterEntry
  flagColumns: ClassRosterFlagColumn[]
  onRemove: (entry: ClassRosterEntry) => void
}

/** 並び替え以外の共通セル（学級名・学年・生徒数・フラグ・削除） */
function ClassRowCells({ entry, flagColumns, onRemove }: ClassRowProps) {
  return (
    <>
      <TableCell className="font-medium">
        {entry.name}
        {entry.classCode && (
          <span className="text-muted-foreground ml-2 text-xs">
            ({entry.classCode})
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
          <Trash2 className="text-destructive h-4 w-4" />
        </Button>
      </TableCell>
    </>
  )
}

/** D&D対応の行（SortableTableProvider の内側でのみ使う） */
function SortableClassRow(props: ClassRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(props.entry.id)
  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <DragHandle dragHandleProps={dragHandleProps} />
      </TableCell>
      <ClassRowCells {...props} />
    </TableRow>
  )
}

/**
 * 学級登録の共通管理コンポーネント（試験・成績・資料で共用）。
 *
 * 登録一覧の表示・order並び替え（任意）・追加ダイアログ・削除（2段階モーダル内包）を提供する。
 * 試験固有の「再採番」フラグ等は {@link ClassRosterFlagColumn} で差し込む。
 */
export function ClassRosterManager({
  entries,
  flagColumns = [],
  removalMode,
  description,
  emptyHint,
  fetchAvailableClasses,
  onAddClasses,
  onReorder,
  onRemove,
  fetchRemovalPreview,
  onChanged,
  showAddDialog: externalShowAddDialog,
  onShowAddDialogChange,
}: ClassRosterManagerProps) {
  const [internalShowAddDialog, setInternalShowAddDialog] = useState(false)
  const [localEntries, setLocalEntries] = useState(entries)
  const [availableClasses, setAvailableClasses] = useState<
    AvailableClassOption[]
  >([])
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    new Set()
  )
  const [adding, setAdding] = useState(false)
  const [removalTarget, setRemovalTarget] = useState<ClassRosterEntry | null>(
    null
  )

  const addEnabled =
    fetchAvailableClasses !== undefined && onAddClasses !== undefined
  const showAddDialog = externalShowAddDialog ?? internalShowAddDialog
  const setShowAddDialog = onShowAddDialogChange ?? setInternalShowAddDialog

  useEffect(() => {
    setLocalEntries(entries)
  }, [entries])

  const loadAvailableClasses = useCallback(async () => {
    if (!fetchAvailableClasses) return
    try {
      setAvailableClasses(await fetchAvailableClasses())
    } catch (err) {
      console.error("Failed to fetch available classes:", err)
    }
  }, [fetchAvailableClasses])

  useEffect(() => {
    if (showAddDialog) {
      loadAvailableClasses()
      setSelectedClassIds(new Set())
    }
  }, [showAddDialog, loadAvailableClasses])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localEntries.findIndex((entry) => entry.id === active.id)
    const newIndex = localEntries.findIndex((entry) => entry.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const newOrder = [...localEntries]
    const [removed] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, removed)
    setLocalEntries(newOrder)

    try {
      await onReorder(newOrder.map((entry) => entry.id))
      onChanged?.()
    } catch (err) {
      console.error("Failed to reorder classes:", err)
      setLocalEntries(entries)
    }
  }

  const handleAddClasses = async () => {
    if (selectedClassIds.size === 0 || !onAddClasses) return
    setAdding(true)
    try {
      await onAddClasses([...selectedClassIds])
      setShowAddDialog(false)
      onChanged?.()
    } catch (err) {
      console.error("Failed to add classes:", err)
    } finally {
      setAdding(false)
    }
  }

  const toggleClassSelection = (classroomId: string) => {
    setSelectedClassIds((prev) => {
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
          <SortableClassRow
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
        <p className="text-muted-foreground text-sm">{description}</p>
      )}

      {localEntries.length === 0 ? (
        <div className="text-muted-foreground rounded-md border py-8 text-center">
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
      <ClassRemovalDialog
        entry={removalTarget}
        mode={removalMode}
        fetchRemovalPreview={fetchRemovalPreview}
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

          {availableClasses.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
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
                  {availableClasses.map((availableClass) => (
                    <TableRow
                      key={availableClass.id}
                      className={`cursor-pointer ${
                        selectedClassIds.has(availableClass.id)
                          ? "bg-accent"
                          : ""
                      }`}
                      onClick={() => toggleClassSelection(availableClass.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedClassIds.has(availableClass.id)}
                          onCheckedChange={() =>
                            toggleClassSelection(availableClass.id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {availableClass.name}
                        {availableClass.classCode && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({availableClass.classCode})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {availableClass.grade
                          ? `${availableClass.grade}年`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {availableClass.studentCount}名
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
              onClick={handleAddClasses}
              disabled={selectedClassIds.size === 0 || adding}
            >
              <Plus className="mr-2 h-4 w-4" />
              {adding ? "追加中..." : `${selectedClassIds.size}件追加`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
