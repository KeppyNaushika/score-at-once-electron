"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Settings, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

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
import {
  createGradeItemMutation,
  type GradeClassroomRow,
  gradeClassroomsQuery,
  gradeDetailQuery,
  gradeSourceFitsQuery,
  gradeStudentsQuery,
  reorderDataSourcesMutation,
  reorderGradeItemsMutation,
  updateDataSourceEstimationMutation,
} from "@/queries/grade"
import type {
  AbsentMethod,
  EstimationMode,
  GradeDataSourceWithRelations,
  GradeItemWithDataSources,
} from "@/types/grade.types"

import { AddDataSourceInline } from "./AddDataSourceInline"
import { DataSourceRow } from "./DataSourceRow"
import { GradeItemSection } from "./GradeItemSection"
import { StudentExclusionModal } from "./StudentExclusionModal"

/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_SOURCE_FITS: Record<
  string,
  { correlation: number; sampleSize: number } | null
> = {}
const EMPTY_CLASSROOMS: GradeClassroomRow[] = []

interface DataSourcesContainerProps {
  gradeId: string
}

export function DataSourcesContainer({ gradeId }: DataSourcesContainerProps) {
  const { data: exam = null, isPending: loading } = useQuery(
    gradeDetailQuery(gradeId)
  )
  const { data: sourceFits = EMPTY_SOURCE_FITS } = useQuery(
    gradeSourceFitsQuery(gradeId)
  )
  const createGradeItem = useMutation(createGradeItemMutation(gradeId))
  const reorderGradeItems = useMutation(reorderGradeItemsMutation(gradeId))
  const reorderDataSources = useMutation(reorderDataSourcesMutation(gradeId))
  const updateEstimation = useMutation(
    updateDataSourceEstimationMutation(gradeId)
  )

  const [newItemName, setNewItemName] = useState("")

  // 対象生徒モーダル。開いたときだけ取る
  const [exclusionModalOpen, setExclusionModalOpen] = useState(false)
  const { data: students } = useQuery({
    ...gradeStudentsQuery(gradeId),
    enabled: exclusionModalOpen,
  })
  const { data: gradeClassrooms = EMPTY_CLASSROOMS } = useQuery({
    ...gradeClassroomsQuery(gradeId),
    enabled: exclusionModalOpen,
  })
  const classroomIds = useMemo(
    () => gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroomId),
    [gradeClassrooms]
  )

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
      reorderDataSources.mutate(
        reordered.map((dataSource, index) => ({
          id: dataSource.id,
          order: index,
        }))
      )
    },
    [reorderDataSources]
  )

  const handleGradeItemDragEnd = useCallback(
    (gradeItems: GradeItemWithDataSources[]) => (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = gradeItems.findIndex(
        (gradeItem) => gradeItem.id === active.id
      )
      const newIndex = gradeItems.findIndex(
        (gradeItem) => gradeItem.id === over.id
      )
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(gradeItems, oldIndex, newIndex)
      reorderGradeItems.mutate(
        reordered.map((gradeItem, index) => ({
          id: gradeItem.id,
          order: index,
        }))
      )
    },
    [reorderGradeItems]
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
    await createGradeItem.mutateAsync(newItemName.trim())
    setNewItemName("")
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
    try {
      // 一括専用の口は持たない。**同じ操作をターゲット分だけ繰り返す**だけなので、
      // 個別更新をそのまま回す。知らせが N 枚出ることは無い — MutationCache が
      // 「同じ行き先へ書いているものが他に走っている間は後始末を出さない」ので、
      // 最後の1つだけが取り直しと通知を出す。
      await Promise.all(
        [...selectedDataSourceIds].map((targetId) =>
          updateEstimation.mutateAsync({
            id: targetId,
            absentMethod: batchMethod,
            absentRatio: Number(batchRatio),
            absentOffset: Number(batchOffset),
            ...(usesEstimationSources && {
              estimationMode: batchEstimationMode,
              estimationSourceIds: batchEstimationSourceIds.filter(
                (sourceId) => sourceId !== targetId
              ),
            }),
          })
        )
      )
    } catch {
      // 一部だけ適用済みの可能性がある。失敗の知らせは中央のトーストが出すので、
      // ここではパネルと選択を保持して再適用できるようにするだけ。
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
        <p className="mt-1 text-sm text-muted-foreground">
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
              onClick={() => setExclusionModalOpen(true)}
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
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  value={batchRatio}
                  onChange={(e) => setBatchRatio(e.target.value)}
                  className="h-8 w-20 text-xs"
                  type="text"
                />
                <span className="text-xs text-muted-foreground">+</span>
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
      <SortableTableProvider
        items={exam.gradeItems.map((gradeItem) => gradeItem.id)}
        onDragEnd={handleGradeItemDragEnd(exam.gradeItems)}
      >
        {exam.gradeItems.map((gradeItem) => (
          <GradeItemSection
            key={gradeItem.id}
            gradeId={gradeId}
            gradeItem={gradeItem}
          >
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
                      gradeId={gradeId}
                      dataSource={dataSource}
                      allDataSources={allDataSources}
                      sourceFit={sourceFits[dataSource.id]}
                      batchMode={batchMode}
                      selected={selectedDataSourceIds.has(dataSource.id)}
                      onToggleSelect={toggleDsSelection}
                    />
                  ))}
                </div>
              </SortableTableProvider>
            )}

            {/* インラインデータソース追加 */}
            <AddDataSourceInline gradeId={gradeId} gradeItemId={gradeItem.id} />
          </GradeItemSection>
        ))}
      </SortableTableProvider>

      {exam.gradeItems.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
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
