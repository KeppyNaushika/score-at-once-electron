"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Pencil, Plus, Settings, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { SortableTableProvider } from "@/components/common/sortable-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDataSources } from "@/hooks/grades/useDataSources"
import type {
  AbsentMethod,
  EstimationMode,
  GradeDataSourceWithRelations,
  GradeItemWithDataSources,
} from "@/types/grade.types"

import { AddDataSourceInline } from "./AddDataSourceInline"
import { DataSourceRow } from "./DataSourceRow"
import { StudentExclusionModal } from "./StudentExclusionModal"

interface DataSourcesContainerProps {
  gradeId: string
}

export function DataSourcesContainer({ gradeId }: DataSourcesContainerProps) {
  const {
    exam,
    loading,
    sourceFits,
    createGradeItem,
    updateGradeItem,
    deleteGradeItem,
    createDataSource,
    updateDataSource,
    batchUpdateDataSources,
    deleteDataSource,
    reorderDataSources,
    reload,
  } = useDataSources(gradeId)

  const [newItemName, setNewItemName] = useState("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemName, setEditingItemName] = useState("")

  // 対象生徒モーダル
  const [exclusionModalOpen, setExclusionModalOpen] = useState(false)
  const [students, setStudents] =
    useState<
      Awaited<
        ReturnType<typeof window.electronAPI.grade.getStudents>
      >["students"]
    >()
  const [classroomIds, setClassroomIds] = useState<string[]>([])

  const loadStudentsAndClassrooms = useCallback(async () => {
    const [studentsResult, classroomsResult] = await Promise.all([
      window.electronAPI.grade.getStudents(gradeId),
      window.electronAPI.grade.getClassrooms(gradeId),
    ])
    if (studentsResult.success) {
      setStudents(studentsResult.students)
    }
    if (classroomsResult.success && classroomsResult.classrooms) {
      setClassroomIds(
        classroomsResult.classrooms.map((classroom) => classroom.classroomId)
      )
    }
  }, [gradeId])

  const handleOpenExclusionModal = useCallback(async () => {
    await loadStudentsAndClassrooms()
    setExclusionModalOpen(true)
  }, [loadStudentsAndClassrooms])

  const handleDataSourceDragEnd = useCallback(
    (dataSources: GradeDataSourceWithRelations[]) => (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = dataSources.findIndex(
        (dataSource) => dataSource.id === active.id
      )
      const newIndex = dataSources.findIndex(
        (dataSource) => dataSource.id === over.id
      )
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(dataSources, oldIndex, newIndex)
      void reorderDataSources(
        reordered.map((dataSource, index) => ({
          id: dataSource.id,
          order: index,
        }))
      )
    },
    [reorderDataSources]
  )

  // 一括欠測設定
  const [batchMode, setBatchMode] = useState(false)
  const [selectedDataSourceIds, setSelectedDataSourceIds] = useState<
    Set<string>
  >(new Set())
  const [batchMethod, setBatchMethod] = useState<AbsentMethod>("zero")
  const [batchRatio, setBatchRatio] = useState("1")
  const [batchOffset, setBatchOffset] = useState("0")
  const [batchEstimationMode, setBatchEstimationMode] =
    useState<EstimationMode>("all")
  const [batchEstimationSourceIds, setBatchEstimationSourceIds] = useState<
    string[]
  >([])

  if (loading || !exam) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const handleAddItem = async () => {
    if (!newItemName.trim()) return
    await createGradeItem(newItemName.trim())
    setNewItemName("")
  }

  const handleStartEditItem = (item: GradeItemWithDataSources) => {
    setEditingItemId(item.id)
    setEditingItemName(item.name)
  }

  const handleSaveEditItem = async () => {
    if (!editingItemId || !editingItemName.trim()) return
    await updateGradeItem(editingItemId, editingItemName.trim())
    setEditingItemId(null)
    setEditingItemName("")
  }

  const toggleDsSelection = (dataSourceId: string) => {
    setSelectedDataSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(dataSourceId)) next.delete(dataSourceId)
      else next.add(dataSourceId)
      return next
    })
  }

  const usesEstimationSources =
    batchMethod === "average" ||
    batchMethod === "regression" ||
    batchMethod === "equipercentile" ||
    batchMethod === "zscore"

  const toggleBatchEstimationSourceId = (id: string) => {
    setBatchEstimationSourceIds((prev) =>
      prev.includes(id)
        ? prev.filter((sourceId) => sourceId !== id)
        : [...prev, id]
    )
  }

  const handleBatchApply = async () => {
    if (selectedDataSourceIds.size === 0) return
    // 推定に使うソースは平均比率法・重回帰法のときのみ適用。ソースは自由に
    // 選べるが、各ターゲットは自分自身を推定ソースにできない（個別行popoverの
    // 自ソース除外と同じ規則）。そこでターゲットごとに自idだけを除いた列を
    // 組み立て、普遍的な個別更新をターゲット分だけ回す。
    const updates = [...selectedDataSourceIds].map((targetId) => ({
      id: targetId,
      data: {
        absentMethod: batchMethod,
        absentRatio: Number(batchRatio),
        absentOffset: Number(batchOffset),
        ...(usesEstimationSources && {
          estimationMode: batchEstimationMode,
          estimationSourceIds: batchEstimationSourceIds.filter(
            (sourceId) => sourceId !== targetId
          ),
        }),
      },
    }))
    const result = await batchUpdateDataSources(updates)
    if (!result.success) {
      // 一部だけ適用済みの可能性がある。パネルと選択は保持し再適用できるようにする。
      toast.error("一部のデータソースに一括設定を適用できませんでした")
      return
    }
    setBatchMode(false)
    setSelectedDataSourceIds(new Set())
  }

  const allDataSources = exam.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">データソース</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          評価項目を作成し、各項目にデータソースを追加してください。
        </p>
      </div>

      {/* 評価項目追加 + 一括設定ボタン */}
      <div className="mb-6 flex items-center gap-2">
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="評価項目名（例: 知識・技能）"
          className="max-w-xs"
          onKeyDown={(e) =>
            e.key === "Enter" && !e.nativeEvent.isComposing && handleAddItem()
          }
        />
        <Button
          variant="outline"
          onClick={handleAddItem}
          disabled={!newItemName.trim()}
        >
          <Plus className="mr-2 h-4 w-4" />
          評価項目追加
        </Button>
        {allDataSources.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenExclusionModal}
            >
              <Users className="mr-1 h-3.5 w-3.5" />
              対象生徒
            </Button>
            <Button
              variant={batchMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setBatchMode(!batchMode)
                setSelectedDataSourceIds(new Set())
              }}
            >
              <Settings className="mr-1 h-3.5 w-3.5" />
              欠測一括設定
            </Button>
          </>
        )}
      </div>

      {/* 一括設定パネル */}
      {batchMode && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-medium">
            欠測時推定の一括設定
            <Badge variant="outline" className="ml-2">
              {selectedDataSourceIds.size}件選択中
            </Badge>
          </p>
          <div className="flex items-center gap-3">
            <Select
              value={batchMethod}
              onValueChange={(value) => setBatchMethod(value as AbsentMethod)}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">なし</SelectItem>
                <SelectItem value="zero">0点</SelectItem>
                <SelectItem value="average">平均比率法</SelectItem>
                <SelectItem value="regression">重回帰法</SelectItem>
                <SelectItem value="equipercentile">順位法</SelectItem>
                <SelectItem value="zscore">標準偏差法</SelectItem>
              </SelectContent>
            </Select>
            {batchMethod !== "null" && batchMethod !== "zero" && (
              <>
                <span className="text-muted-foreground text-xs">×</span>
                <Input
                  value={batchRatio}
                  onChange={(e) => setBatchRatio(e.target.value)}
                  className="h-8 w-20 text-xs"
                  type="text"
                />
                <span className="text-muted-foreground text-xs">+</span>
                <Input
                  value={batchOffset}
                  onChange={(e) => setBatchOffset(e.target.value)}
                  className="h-8 w-20 text-xs"
                  type="text"
                />
              </>
            )}
            <Button
              size="sm"
              onClick={handleBatchApply}
              disabled={selectedDataSourceIds.size === 0}
            >
              適用
            </Button>
          </div>

          {/* 推定に使用するソース（平均比率法・重回帰法のみ） */}
          {usesEstimationSources && (
            <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
              <Label className="text-xs">推定に使用するソース</Label>
              <RadioGroup
                value={batchEstimationMode}
                onValueChange={(value) =>
                  setBatchEstimationMode(value as EstimationMode)
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="batch-mode-all" />
                  <Label
                    htmlFor="batch-mode-all"
                    className="text-xs font-normal"
                  >
                    自ソース以外の全て
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="selected" id="batch-mode-selected" />
                  <Label
                    htmlFor="batch-mode-selected"
                    className="text-xs font-normal"
                  >
                    選択
                  </Label>
                </div>
              </RadioGroup>

              {batchEstimationMode === "selected" && (
                <div className="max-h-36 space-y-1 overflow-y-auto rounded border bg-white p-2">
                  {/* ソースは自由に選択可。各ターゲットの自ソース除外は適用時に行う */}
                  {allDataSources.map((candidateSource) => (
                    <div
                      key={candidateSource.id}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        checked={batchEstimationSourceIds.includes(
                          candidateSource.id
                        )}
                        onCheckedChange={() =>
                          toggleBatchEstimationSourceId(candidateSource.id)
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span className="truncate text-xs">
                        {candidateSource.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* GradeItem ごとのセクション */}
      {exam.gradeItems.map((gradeItem) => (
        <div key={gradeItem.id} className="mb-8 rounded-lg border p-4">
          {/* GradeItem ヘッダー */}
          <div className="mb-3 flex items-center justify-between">
            {editingItemId === gradeItem.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editingItemName}
                  onChange={(e) => setEditingItemName(e.target.value)}
                  className="h-8 w-48"
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    handleSaveEditItem()
                  }
                  autoFocus
                />
                <Button variant="ghost" size="sm" onClick={handleSaveEditItem}>
                  保存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingItemId(null)}
                >
                  取消
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-blue-600">
                  {gradeItem.name}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleStartEditItem(gradeItem)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive h-7 w-7"
              onClick={async () => {
                const result = await deleteGradeItem(gradeItem.id)
                // 制約ルールの集計対象が変わると判定の意味が変わるため無効化される。
                // 黙って着色が消えるのを避け、その場で知らせる。
                if (result.disabledConstraintNames?.length) {
                  toast.warning(
                    `制約ルール「${result.disabledConstraintNames.join("」「")}」を無効化しました（集計対象が変わったため再設定してください）`
                  )
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* DataSource リスト */}
          {gradeItem.dataSources.length > 0 && (
            <SortableTableProvider
              items={gradeItem.dataSources.map((dataSource) => dataSource.id)}
              onDragEnd={handleDataSourceDragEnd(gradeItem.dataSources)}
            >
              <div className="mb-3 space-y-2">
                {gradeItem.dataSources.map((dataSource) => (
                  <DataSourceRow
                    key={dataSource.id}
                    dataSource={dataSource}
                    allDataSources={allDataSources}
                    sourceFit={sourceFits[dataSource.id]}
                    batchMode={batchMode}
                    selected={selectedDataSourceIds.has(dataSource.id)}
                    onToggleSelect={toggleDsSelection}
                    onUpdate={updateDataSource}
                    onDelete={deleteDataSource}
                  />
                ))}
              </div>
            </SortableTableProvider>
          )}

          {/* インラインデータソース追加 */}
          <AddDataSourceInline
            gradeItemId={gradeItem.id}
            onCreate={createDataSource}
            onCreated={reload}
          />
        </div>
      ))}

      {exam.gradeItems.length === 0 && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          評価項目がありません。上のフォームから追加してください。
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link href={`/grades/${gradeId}/04-manual-scores`}>
            次へ: 外部成績入力
          </Link>
        </Button>
      </div>

      {/* 対象生徒除外モーダル */}
      {students && (
        <StudentExclusionModal
          open={exclusionModalOpen}
          onOpenChange={setExclusionModalOpen}
          gradeId={gradeId}
          gradeItems={exam.gradeItems}
          students={students}
          classroomIds={classroomIds}
        />
      )}
    </div>
  )
}
