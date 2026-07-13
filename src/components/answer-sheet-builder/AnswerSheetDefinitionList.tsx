"use client"

import {
  Copy,
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { BulkTagAssignButton } from "@/components/common/BulkTagAssignButton"
import { ListFilterBar } from "@/components/common/ListFilterBar"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useAuth } from "@/contexts/AuthContext"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

import { useAnswerSheetDefinitions } from "./hooks/useAnswerSheetDefinitions"

type SortKey = "name" | "updatedAt" | "questionCount" | "totalPoints"
type SortDir = "asc" | "desc"

/** 解答用紙一覧のフィルタ対象値（名前・タグ名／タグ／更新日） */
const ASB_FILTER_ACCESSORS: ListFilterAccessors<ASBDefinitionListItem> = {
  searchTexts: (definition) => [
    definition.name,
    ...(definition.tags ?? []).map((tag) => tag.name),
  ],
  tagIds: (definition) => (definition.tags ?? []).map((tag) => tag.id),
  date: (definition) => definition.updatedAt ?? null,
}

/**
 * 解答用紙定義の一覧表示・作成・複製・削除を行うコンポーネント。
 */
export function AnswerSheetDefinitionList() {
  const { user } = useAuth()
  const router = useRouter()
  const {
    definitions,
    isLoading,
    loadDefinitions,
    deleteDefinition,
    duplicateDefinition,
  } = useAnswerSheetDefinitions(user?.id)

  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)

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

  const {
    filteredItems: filteredDefinitions,
    searchTerm,
    setSearchTerm,
    filterTagIds,
    toggleTagId,
    clearTagIds,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
  } = useListFilter(definitions, ASB_FILTER_ACCESSORS)

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((prevSortDir) => (prevSortDir === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDir(key === "name" ? "asc" : "desc")
      }
    },
    [sortKey]
  )

  const sorted = [...filteredDefinitions].sort((definitionA, definitionB) => {
    const direction = sortDir === "asc" ? 1 : -1
    switch (sortKey) {
      case "name":
        return direction * definitionA.name.localeCompare(definitionB.name)
      case "updatedAt":
        return (
          direction *
          (definitionA.updatedAt ?? "").localeCompare(
            definitionB.updatedAt ?? ""
          )
        )
      case "questionCount":
        return (
          direction *
          ((definitionA.questionCount ?? 0) - (definitionB.questionCount ?? 0))
        )
      case "totalPoints":
        return (
          direction *
          ((definitionA.totalPoints ?? 0) - (definitionB.totalPoints ?? 0))
        )
      default:
        return 0
    }
  })

  const toggleSelect = useCallback((definitionId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(definitionId)
      } else {
        next.delete(definitionId)
      }
      return next
    })
  }, [])

  const allSelected =
    sorted.length > 0 &&
    sorted.every((definition) => selectedIds.has(definition.id))

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const definition of sorted) {
          if (checked) {
            next.add(definition.id)
          } else {
            next.delete(definition.id)
          }
        }
        return next
      })
    },
    [sorted]
  )

  const handleBulkAddTag = async (tagName: string) => {
    try {
      const tag = await window.electronAPI.tagFindOrCreate(tagName)
      for (const definitionId of selectedIds) {
        try {
          await window.electronAPI.asbDefinitionTagCreate({
            asbDefinitionId: definitionId,
            tagId: tag.id,
          })
        } catch {
          // 既に紐づいている場合は unique 制約で失敗するが無視
        }
      }
      toast.success("タグを追加しました", {
        description: `${selectedIds.size}件の解答用紙に「${tagName}」を追加`,
      })
      setSelectedIds(new Set())
      setAllTags(await window.electronAPI.tagGetAll())
      await loadDefinitions()
    } catch (error) {
      console.error("Error bulk adding tag:", error)
      toast.error("タグの追加に失敗しました")
    }
  }

  const handleCreate = useCallback(async () => {
    if (!user?.id) return
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) return

    const newId = crypto.randomUUID()
    const { createDefaultDefinition } = await import("./constants")
    const definition = createDefaultDefinition()
    definition.id = newId

    const result = await api.saveDefinition(definition, user.id)
    if (result.success) {
      router.push(`/answer-sheet-builder/${newId}`)
    }
  }, [user?.id, router])

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/answer-sheet-builder/${id}`)
    },
    [router]
  )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteDefinition(deleteTarget.id)
    // 削除した定義の id を選択から除く（stale id への一括タグ付与を防ぐ）
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(deleteTarget.id)
      return next
    })
    setDeleteTarget(null)
  }

  const handleExport = useCallback(async (definitionId: string) => {
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) return

    const result = await api.exportDefinition(definitionId)
    if (result.success) {
      toast.success("定義を書き出しました")
    } else if (result.error !== "キャンセルされました") {
      toast.error(result.error ?? "書き出しに失敗しました")
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!user?.id) return
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) return

    // 1. ファイル選択
    const fileResult = await api.selectImportFile()
    if (!fileResult.success || !fileResult.filePath) return

    // 2. インポート実行
    const importResult = await api.importDefinition(
      fileResult.filePath,
      user.id
    )
    if (importResult.success) {
      toast.success("定義を読み込みました")
      if (importResult.warnings?.length) {
        for (const warning of importResult.warnings) {
          toast.warning(warning)
        }
      }
      await loadDefinitions()
    } else {
      toast.error(importResult.error ?? "読み込みに失敗しました")
    }
  }, [user?.id, loadDefinitions])

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const formatDate = (iso?: string) => {
    if (!iso) return "-"
    const date = new Date(iso)
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleCreate}
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
            .asb 読み込み
          </Button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-muted-foreground text-sm">
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
        {definitions.length > 0 && (
          <ListFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="名前・タグで検索"
            totalCount={definitions.length}
            filteredCount={filteredDefinitions.length}
            tagFilter={{
              options: allTags,
              selectedIds: filterTagIds,
              onToggle: toggleTagId,
              onClear: clearTagIds,
            }}
            dateRangeFilter={{
              label: "更新日",
              from: dateFrom,
              to: dateTo,
              onFromChange: setDateFrom,
              onToChange: setDateTo,
            }}
          />
        )}
      </div>

      <div className="min-h-0 flex-1 p-4">
        {definitions.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-muted-foreground mb-2">
              解答用紙定義がありません
            </p>
            <Button variant="outline" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              最初の定義を作成
            </Button>
          </div>
        ) : (
          <div className="border-border/50 h-full overflow-hidden rounded-xl border shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="bg-card sticky top-0 z-10">
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
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("name")}
                  >
                    名前{sortIndicator("name")}
                  </TableHead>
                  <TableHead className="w-24">用紙</TableHead>
                  <TableHead
                    className="w-20 cursor-pointer text-right select-none"
                    onClick={() => toggleSort("questionCount")}
                  >
                    設問数{sortIndicator("questionCount")}
                  </TableHead>
                  <TableHead
                    className="w-24 cursor-pointer text-right select-none"
                    onClick={() => toggleSort("totalPoints")}
                  >
                    合計配点{sortIndicator("totalPoints")}
                  </TableHead>
                  <TableHead
                    className="w-40 cursor-pointer select-none"
                    onClick={() => toggleSort("updatedAt")}
                  >
                    更新日時{sortIndicator("updatedAt")}
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-8 text-center"
                    >
                      条件に一致する解答用紙がありません
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((definition) => (
                  <TableRow
                    key={definition.id}
                    className="group cursor-pointer"
                    onClick={() => handleEdit(definition.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(definition.id)}
                        onCheckedChange={(checked) =>
                          toggleSelect(definition.id, checked === true)
                        }
                        aria-label={`${definition.name} を選択`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {definition.name}
                      {definition.tags && definition.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {definition.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {definition.paperSize ?? "-"}{" "}
                      {definition.orientation === "landscape" ? "横" : "縦"}
                    </TableCell>
                    <TableCell className="text-right">
                      {definition.questionCount ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {definition.totalPoints != null
                        ? `${definition.totalPoints}点`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(definition.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onClick={() => handleEdit(definition.id)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => duplicateDefinition(definition.id)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            複製
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExport(definition.id)}
                          >
                            <FolderOutput className="mr-2 h-4 w-4" />
                            .asb 書き出し
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                id: definition.id,
                                name: definition.name,
                              })
                            }
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解答用紙を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
