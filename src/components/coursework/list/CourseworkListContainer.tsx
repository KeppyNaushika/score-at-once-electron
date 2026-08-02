"use client"

import {
  ClipboardEdit,
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { BulkTagAssignButton } from "@/components/common/BulkTagAssignButton"
import { ListFilterBar } from "@/components/common/ListFilterBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { collectClassroomOptions } from "@/lib/filterOptions"
import type { CourseworkSummary } from "@/types/coursework.types"
import type {
  CourseworkArchiveImportPreview,
  CourseworkImportDecision,
} from "@/types/courseworkArchive.types"

import { CourseworkCreateDialog } from "./CourseworkCreateDialog"
import { CourseworkImportDialog } from "./CourseworkImportDialog"

/** 試験外成績資料一覧のフィルタ対象値（名前・説明・タグ名・学級名／タグ／学級／実施日） */
const COURSEWORK_FILTER_ACCESSORS: ListFilterAccessors<CourseworkSummary> = {
  searchTexts: (coursework) => [
    coursework.name,
    coursework.description,
    ...coursework.tags.map((courseworkTag) => courseworkTag.tag.name),
    ...coursework.classrooms.map(
      (courseworkClassroom) => courseworkClassroom.classroom.name
    ),
  ],
  tagIds: (coursework) =>
    coursework.tags.map((courseworkTag) => courseworkTag.tag.id),
  classroomIds: (coursework) =>
    coursework.classrooms.map(
      (courseworkClassroom) => courseworkClassroom.classroomId
    ),
  date: (coursework) => coursework.date,
}

/**
 * 試験外成績資料（Coursework）の一覧コンテナ
 *
 * テーブル形式で資料一覧を表示し、各資料への遷移・新規作成・削除を提供する。
 * 成績算出から参照中の資料は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkListContainer() {
  const router = useRouter()
  const [courseworks, setCourseworks] = useState<CourseworkSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // インポート確認ウィザードの状態
  const [importPreview, setImportPreview] =
    useState<CourseworkArchiveImportPreview | null>(null)
  const [importArchivePath, setImportArchivePath] = useState<string | null>(
    null
  )
  const [importing, setImporting] = useState(false)
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])

  const loadCourseworks = useCallback(async () => {
    try {
      const result = await window.electronAPI.coursework.getAll()
      if (result.success && result.courseworks) {
        setCourseworks(result.courseworks)
      }
    } catch (error) {
      console.error("Error loading courseworks:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCourseworks()
  }, [loadCourseworks])

  useEffect(() => {
    const loadTags = async () => {
      try {
        setAllTags(await window.electronAPI.tagGetAll())
      } catch (error) {
        console.error("Error loading tags:", error)
      }
    }
    void loadTags()
  }, [])

  const handleCreated = (id: string) => {
    setShowCreateDialog(false)
    // 作成直後は基本設定を促すため編集モーダルを開いた状態で開く
    router.push(`/coursework/${id}?setup=1`)
  }

  const handleDelete = async (coursework: CourseworkSummary) => {
    try {
      const result = await window.electronAPI.coursework.delete(coursework.id)
      if (result.success) {
        setCourseworks((prev) =>
          prev.filter(
            (existingCoursework) => existingCoursework.id !== coursework.id
          )
        )
        toast.success("資料を削除しました", { description: coursework.name })
      } else if (result.usedBy && result.usedBy.length > 0) {
        toast.error("削除できません", {
          description: `次の成績算出で参照されています: ${result.usedBy.join("、")}`,
        })
      } else {
        toast.error("削除に失敗しました", { description: result.error })
      }
    } catch (error) {
      console.error("Error deleting coursework:", error)
      toast.error("削除に失敗しました")
    }
  }

  const handleExport = async (coursework: CourseworkSummary) => {
    try {
      const result = await window.electronAPI.coursework.exportArchive(
        coursework.id
      )
      if (result.success && !result.canceled) {
        toast.success("資料をエクスポートしました", {
          description: coursework.name,
        })
      } else if (!result.success) {
        toast.error("エクスポートに失敗しました", {
          description: result.error,
        })
      }
    } catch (error) {
      console.error("Error exporting coursework:", error)
      toast.error("エクスポートに失敗しました")
    }
  }

  const handleImport = async () => {
    const selected = await window.electronAPI.coursework.selectImportFile()
    if (!selected.success || selected.canceled || !selected.filePath) return
    const analyzed = await window.electronAPI.coursework.analyzeArchive({
      archivePath: selected.filePath,
    })
    if (!analyzed.success || !analyzed.preview) {
      toast.error("アーカイブの解析に失敗しました", {
        description: analyzed.error,
      })
      return
    }
    setImportArchivePath(selected.filePath)
    setImportPreview(analyzed.preview)
  }

  const handleImportConfirm = async (
    decisions: Record<string, CourseworkImportDecision>
  ) => {
    if (!importArchivePath) return
    setImporting(true)
    try {
      const result = await window.electronAPI.coursework.importArchive({
        archivePath: importArchivePath,
        courseworkDecisions: decisions,
      })
      if (result.success) {
        if (result.warnings && result.warnings.length > 0) {
          toast.warning(
            `インポートは完了しましたが ${result.warnings.length} 件の警告があります`,
            {
              description: result.warnings.join("\n"),
              duration: Infinity,
              closeButton: true,
            }
          )
        } else {
          toast.success("資料をインポートしました")
        }
        await loadCourseworks()
      } else {
        toast.error("インポートに失敗しました", { description: result.error })
      }
    } finally {
      setImporting(false)
      setImportPreview(null)
      setImportArchivePath(null)
    }
  }

  const handleImportCancel = () => {
    setImportPreview(null)
    setImportArchivePath(null)
  }

  // 選択中の各資料へ、既存タグを保持したままタグを追加する
  const handleBulkAddTag = async (tagName: string) => {
    try {
      const tag = await window.electronAPI.tagFindOrCreate(tagName)
      const targetCourseworks = courseworks.filter((coursework) =>
        selectedIds.has(coursework.id)
      )
      for (const coursework of targetCourseworks) {
        // 既存タグを保持したまま1件追加（全置換 setTags による stale 消失を回避）
        const result = await window.electronAPI.coursework.addTag(
          coursework.id,
          tag.id
        )
        if (!result.success) {
          throw new Error(result.error ?? "タグの追加に失敗しました")
        }
      }
      toast.success("タグを追加しました", {
        description: `${targetCourseworks.length}件の資料に「${tagName}」を追加`,
      })
      clearSelection()
      setAllTags(await window.electronAPI.tagGetAll())
      await loadCourseworks()
    } catch (error) {
      console.error("Error bulk adding tag:", error)
      toast.error("タグの追加に失敗しました")
    }
  }

  const classroomOptions = useMemo(
    () =>
      collectClassroomOptions(courseworks, (coursework) =>
        coursework.classrooms.map(
          (courseworkClassroom) => courseworkClassroom.classroom
        )
      ),
    [courseworks]
  )

  const {
    filteredItems: filteredCourseworks,
    searchTerm,
    setSearchTerm,
    filterTagIds,
    toggleTagId,
    clearTagIds,
    filterClassroomIds,
    toggleClassroomId,
    clearClassroomIds,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
  } = useListFilter(courseworks, COURSEWORK_FILTER_ACCESSORS)

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(filteredCourseworks)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            className="rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
          <Button
            onClick={handleImport}
            variant="outline"
            className="rounded-lg"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .coursework 読み込み
          </Button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size}件選択中
              </span>
              <BulkTagAssignButton
                selectedCount={selectedIds.size}
                allTags={allTags}
                onAssign={handleBulkAddTag}
              />
            </>
          )}
        </div>
        {courseworks.length > 0 && (
          <ListFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="資料名・タグ・学級で検索"
            totalCount={courseworks.length}
            filteredCount={filteredCourseworks.length}
            tagFilter={{
              options: allTags,
              selectedIds: filterTagIds,
              onToggle: toggleTagId,
              onClear: clearTagIds,
            }}
            classroomFilter={{
              options: classroomOptions,
              selectedIds: filterClassroomIds,
              onToggle: toggleClassroomId,
              onClear: clearClassroomIds,
            }}
            dateRangeFilter={{
              label: "実施日",
              from: dateFrom,
              to: dateTo,
              onFromChange: setDateFrom,
              onToChange: setDateTo,
            }}
          />
        )}
      </div>

      <div className="min-h-0 flex-1 p-4">
        {courseworks.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="mb-2 text-muted-foreground">
              試験外成績資料がありません
            </p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              最初の資料を作成
            </Button>
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAll(checked === true)
                      }
                      aria-label="全選択"
                    />
                  </TableHead>
                  <TableHead>資料名</TableHead>
                  <TableHead className="w-40 text-center">実施日</TableHead>
                  <TableHead className="w-40 text-center">編集</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourseworks.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      条件に一致する資料がありません
                    </TableCell>
                  </TableRow>
                )}
                {filteredCourseworks.map((coursework) => (
                  <TableRow key={coursework.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(coursework.id)}
                        onCheckedChange={(checked) =>
                          toggleSelect(coursework.id, checked === true)
                        }
                        aria-label={`${coursework.name} を選択`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{coursework.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {coursework.description || "説明なし"}
                          {" / "}
                          生徒: {coursework.students.length}名 / 評価項目:{" "}
                          {coursework.items.length}
                        </div>
                        {coursework.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {coursework.tags.map((courseworkTag) => (
                              <Badge
                                key={courseworkTag.tag.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                {courseworkTag.tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-center text-sm text-muted-foreground">
                      {coursework.date
                        ? new Date(coursework.date).toLocaleDateString("ja-JP")
                        : "-"}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(`/coursework/${coursework.id}`)
                        }
                        className="rounded-lg"
                      >
                        <ClipboardEdit className="mr-1 h-4 w-4" />
                        詳細
                      </Button>
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleExport(coursework)}
                          >
                            <FolderOutput className="mr-2 h-4 w-4" />
                            .coursework 書き出し
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(coursework)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CourseworkCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />

      <CourseworkImportDialog
        open={importPreview !== null}
        preview={importPreview}
        importing={importing}
        onCancel={handleImportCancel}
        onConfirm={handleImportConfirm}
      />
    </div>
  )
}
