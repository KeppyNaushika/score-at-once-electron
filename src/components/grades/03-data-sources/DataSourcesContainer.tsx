"use client"

import { Pencil, Plus, Settings, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDataSources } from "@/hooks/grades/useDataSources"
import type { AbsentMethod, GradeItemWithDetails } from "@/types/grade.types"

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
    createGradeItem,
    updateGradeItem,
    deleteGradeItem,
    createDataSource,
    updateDataSource,
    batchUpdateAbsentPolicy,
    deleteDataSource,
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
  const [classIds, setClassIds] = useState<string[]>([])

  const loadStudentsAndClasses = useCallback(async () => {
    const [studentsResult, classesResult] = await Promise.all([
      window.electronAPI.grade.getStudents(gradeId),
      window.electronAPI.grade.getClasses(gradeId),
    ])
    if (studentsResult.success) {
      setStudents(studentsResult.students)
    }
    if (classesResult.success && classesResult.classes) {
      setClassIds(
        classesResult.classes.map((classroom) => classroom.classroomId)
      )
    }
  }, [gradeId])

  const handleOpenExclusionModal = useCallback(async () => {
    await loadStudentsAndClasses()
    setExclusionModalOpen(true)
  }, [loadStudentsAndClasses])

  // 一括欠測設定
  const [batchMode, setBatchMode] = useState(false)
  const [selectedDataSourceIds, setSelectedDataSourceIds] = useState<
    Set<string>
  >(new Set())
  const [batchMethod, setBatchMethod] = useState<AbsentMethod>("zero")
  const [batchRatio, setBatchRatio] = useState("1")
  const [batchOffset, setBatchOffset] = useState("0")

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

  const handleStartEditItem = (item: GradeItemWithDetails) => {
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

  const handleBatchApply = async () => {
    if (selectedDataSourceIds.size === 0) return
    await batchUpdateAbsentPolicy([...selectedDataSourceIds], {
      absentMethod: batchMethod,
      absentRatio: Number(batchRatio),
      absentOffset: Number(batchOffset),
    })
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
              onClick={() => deleteGradeItem(gradeItem.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* DataSource リスト */}
          {gradeItem.dataSources.length > 0 && (
            <div className="mb-3 space-y-2">
              {gradeItem.dataSources.map((dataSource) => (
                <div key={dataSource.id} className="flex items-start gap-2">
                  {batchMode && (
                    <Checkbox
                      checked={selectedDataSourceIds.has(dataSource.id)}
                      onCheckedChange={() => toggleDsSelection(dataSource.id)}
                      className="mt-3"
                    />
                  )}
                  <div className="flex-1">
                    <DataSourceRow
                      dataSource={dataSource}
                      allDataSources={allDataSources}
                      onUpdate={updateDataSource}
                      onDelete={deleteDataSource}
                    />
                  </div>
                </div>
              ))}
            </div>
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
          classIds={classIds}
        />
      )}
    </div>
  )
}
