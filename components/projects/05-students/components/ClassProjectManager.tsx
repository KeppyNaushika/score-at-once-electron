"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { BarChart3, Plus, Trash2, UserPlus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

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
import type { AvailableClass, ProjectClassWithClass } from "@/types/electron.d"

interface ClassProjectManagerProps {
  projectId: string
  projectClasses: ProjectClassWithClass[]
  onRemoveClass: (projectClassId: string) => Promise<boolean>
  onUpdateClass: (
    projectClassId: string,
    options: { administered?: boolean; statistics?: boolean }
  ) => Promise<unknown>
  onClassesChanged?: () => void
  showAddDialog?: boolean
  onShowAddDialogChange?: (open: boolean) => void
}

interface SortableClassRowProps {
  projectClass: ProjectClassWithClass
  onAdministeredChange: (id: string, checked: boolean) => void
  onStatisticsChange: (id: string, checked: boolean) => void
  onRemove: (id: string) => void
}

function SortableClassRow({
  projectClass,
  onAdministeredChange,
  onStatisticsChange,
  onRemove,
}: SortableClassRowProps) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(projectClass.id)

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <DragHandle dragHandleProps={dragHandleProps} />
      </TableCell>
      <TableCell className="font-medium">
        {projectClass.class.name}
        {projectClass.class.classCode && (
          <span className="text-muted-foreground ml-2 text-xs">
            ({projectClass.class.classCode})
          </span>
        )}
      </TableCell>
      <TableCell>
        {projectClass.class.grade ? `${projectClass.class.grade}年` : "-"}
      </TableCell>
      <TableCell className="text-center">
        {projectClass.class.memberships.length}名
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={projectClass.administered}
          onCheckedChange={(checked) =>
            onAdministeredChange(projectClass.id, checked === true)
          }
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={projectClass.statistics}
          onCheckedChange={(checked) =>
            onStatisticsChange(projectClass.id, checked === true)
          }
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(projectClass.id)}
        >
          <Trash2 className="text-destructive h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

/**
 * プロジェクト-クラス関連の管理コンポーネント
 *
 * 統計学級の追加・administered/statistics設定・削除・並び替えを行う
 * ※生徒の追加は「生徒を追加」モーダルで行う
 */
export function ClassProjectManager({
  projectId,
  projectClasses,
  onRemoveClass,
  onUpdateClass,
  onClassesChanged,
  showAddDialog: externalShowAddDialog,
  onShowAddDialogChange,
}: ClassProjectManagerProps) {
  const [internalShowAddDialog, setInternalShowAddDialog] = useState(false)
  const [localClasses, setLocalClasses] = useState(projectClasses)

  // 外部から制御される場合は外部の状態を使用、そうでなければ内部状態を使用
  const showAddDialog = externalShowAddDialog ?? internalShowAddDialog
  const setShowAddDialog = onShowAddDialogChange ?? setInternalShowAddDialog
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    new Set()
  )
  const [adding, setAdding] = useState(false)

  // projectClassesが変更されたらlocalClassesを更新
  useEffect(() => {
    setLocalClasses(projectClasses)
  }, [projectClasses])

  // 追加可能なクラス一覧を取得
  const fetchAvailableClasses = useCallback(async () => {
    try {
      const classes =
        await window.electronAPI.projectClass.getAvailable(projectId)
      setAvailableClasses(classes)
    } catch (err) {
      console.error("Failed to fetch available classes:", err)
    }
  }, [projectId])

  useEffect(() => {
    if (showAddDialog) {
      fetchAvailableClasses()
      setSelectedClassIds(new Set())
    }
  }, [showAddDialog, fetchAvailableClasses])

  // ドラッグ終了時の処理
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = localClasses.findIndex(
        (projectClass) => projectClass.id === active.id
      )
      const newIndex = localClasses.findIndex(
        (projectClass) => projectClass.id === over.id
      )

      // 楽観的更新
      const newOrder = [...localClasses]
      const [removed] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, removed)
      setLocalClasses(newOrder)

      // APIで順序を更新
      try {
        await window.electronAPI.projectClass.reorder({
          projectId,
          orderedIds: newOrder.map((projectClass) => projectClass.id),
        })
        onClassesChanged?.()
      } catch (err) {
        console.error("Failed to reorder classes:", err)
        // エラー時は元に戻す
        setLocalClasses(projectClasses)
      }
    }
  }

  // クラスを追加
  const handleAddClasses = async () => {
    if (selectedClassIds.size === 0) return

    setAdding(true)

    try {
      for (const classId of selectedClassIds) {
        await window.electronAPI.projectClass.add({
          projectId,
          classId,
          administered: true,
          statistics: true,
        })
      }

      setShowAddDialog(false)
      onClassesChanged?.()
    } catch (err) {
      console.error("Failed to add classes:", err)
    } finally {
      setAdding(false)
    }
  }

  // クラス選択の切り替え
  const toggleClassSelection = (classId: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev)
      if (next.has(classId)) {
        next.delete(classId)
      } else {
        next.add(classId)
      }
      return next
    })
  }

  // administered切り替え
  const handleAdministeredChange = async (
    projectClassId: string,
    checked: boolean
  ) => {
    await onUpdateClass(projectClassId, { administered: checked })
  }

  // statistics切り替え
  const handleStatisticsChange = async (
    projectClassId: string,
    checked: boolean
  ) => {
    await onUpdateClass(projectClassId, { statistics: checked })
  }

  // クラスを削除
  const handleRemoveClass = async (projectClassId: string) => {
    await onRemoveClass(projectClassId)
    onClassesChanged?.()
  }

  const administeredClassCount = localClasses.filter(
    (projectClass) => projectClass.administered
  ).length

  return (
    <div className="space-y-4">
      {/* ヘッダー行 */}
      <p className="text-muted-foreground text-sm">
        学級表示・統計集計の対象クラスを管理します。生徒の追加は「生徒を追加」から行います。
        {localClasses.length > 0 && (
          <> • 学級表示対象: {administeredClassCount}クラス</>
        )}
      </p>

      {/* テーブル */}
      {localClasses.length === 0 ? (
        <div className="text-muted-foreground rounded-md border py-8 text-center">
          <p>学級が関連付けられていません</p>
          <p className="mt-1 text-sm">
            「学級を追加」ボタンから学級を追加してください
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <SortableTableProvider
            items={localClasses.map((projectClass) => projectClass.id)}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12.5"></TableHead>
                  <TableHead>クラス名</TableHead>
                  <TableHead>学年</TableHead>
                  <TableHead className="text-center">生徒数</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <UserPlus className="h-4 w-4" />
                      <span>学級表示</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      <span>統計集計</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localClasses.map((projectClass) => (
                  <SortableClassRow
                    key={projectClass.id}
                    projectClass={projectClass}
                    onAdministeredChange={handleAdministeredChange}
                    onStatisticsChange={handleStatisticsChange}
                    onRemove={handleRemoveClass}
                  />
                ))}
              </TableBody>
            </Table>
          </SortableTableProvider>
        </div>
      )}

      {/* クラス追加ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
