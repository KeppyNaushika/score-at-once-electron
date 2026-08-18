"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Copy,
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRoundCog,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import {
  createAnswerSheetDefinitionMutation,
  exportAnswerSheetDefinitionMutation,
  importAnswerSheetDefinitionMutation,
  selectAnswerSheetImportFileMutation,
  transferAnswerSheetDefinitionOwnerMutation,
} from "@/queries/answerSheetBuilder"
import {
  addTagToAnswerSheetDefinitionsMutation,
  findOrCreateTagMutation,
  tagListQuery,
} from "@/queries/tag"
import type { PublicUser } from "@/queries/user"
import { userListQuery } from "@/queries/user"
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

/** ログイン中の利用者を取得する。欠けていればトーストで通知して null を返す */
function requireUserId(userId: string | undefined) {
  if (!userId) {
    toast.error("ログイン情報を取得できませんでした", {
      description: "一度ログアウトして再ログインしてください",
    })
    return null
  }
  return userId
}

/**
 * 解答用紙の一覧表示・作成・複製・削除を行うコンポーネント。
 */
/**
 * 担当を別の利用者へ渡すダイアログ。
 *
 * 編集できるのは担当者ひとりだけなので、他の人が直したいときはここで渡す。
 * 渡せるのは今の担当者だけ（横から取り上げられない）。
 */
function TransferOwnerDialog({
  definition,
  currentUserId,
  onClose,
  onTransfer,
}: {
  definition: ASBDefinitionListItem | null
  currentUserId: string | undefined
  onClose: () => void
  onTransfer: (nextUserId: string) => Promise<void>
}) {
  const { data: users = EMPTY_USERS } = useQuery(userListQuery())
  const candidates = users.filter((candidate) => candidate.id !== currentUserId)

  return (
    <Dialog
      open={definition !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>担当を渡す</DialogTitle>
          <DialogDescription>
            「{definition?.name}
            」を編集できる人を切り替えます。渡した後は自分では
            編集できなくなります（閲覧と書き出しはできます）。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border/50">
          {candidates.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              他に利用者がいません。
            </p>
          ) : (
            candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                onClick={async () => {
                  if (!definition) return
                  await onTransfer(candidate.id)
                  onClose()
                }}
              >
                {candidate.name}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: PublicUser[] = []

export function AnswerSheetDefinitionList() {
  const { user } = useAuth()
  const router = useRouter()
  const { definitions, isLoading, deleteDefinition, duplicateDefinition } =
    useAnswerSheetDefinitions(user?.id)

  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [transferTarget, setTransferTarget] =
    useState<ASBDefinitionListItem | null>(null)
  // 担当を渡す相手は選んだ1件ぶん。取り直す先もその1件のまとまりになるので、
  // 書き込みの宣言は「今どれを選んでいるか」から組む
  const { mutateAsync: transferOwnerOf } = useMutation(
    transferAnswerSheetDefinitionOwnerMutation(transferTarget?.id ?? "")
  )
  const { mutateAsync: createDefinition } = useMutation(
    createAnswerSheetDefinitionMutation()
  )
  const { mutateAsync: exportDefinition } = useMutation(
    exportAnswerSheetDefinitionMutation()
  )
  const { mutateAsync: selectImportFile } = useMutation(
    selectAnswerSheetImportFileMutation()
  )
  const { mutateAsync: importDefinition } = useMutation(
    importAnswerSheetDefinitionMutation()
  )
  const { mutateAsync: findOrCreateTag } = useMutation(
    findOrCreateTagMutation()
  )
  const { mutateAsync: addTagToDefinitions } = useMutation(
    addTagToAnswerSheetDefinitionsMutation()
  )
  /** 一覧には全員の解答用紙が載る。既定は自分が担当のものだけを出す */
  const [showAllOwners, setShowAllOwners] = useState(false)

  const visibleDefinitions = useMemo(
    () =>
      showAllOwners
        ? definitions
        : definitions.filter((definition) => definition.ownerId === user?.id),
    [definitions, showAllOwners, user?.id]
  )

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
  } = useListFilter(visibleDefinitions, ASB_FILTER_ACCESSORS)

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

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(sorted)

  const handleBulkAddTag = async (tagName: string) => {
    try {
      const tag = await findOrCreateTag(tagName)
      await addTagToDefinitions({
        definitionIds: [...selectedIds],
        tagId: tag.id,
      })
      toast.success("タグを追加しました", {
        description: `${selectedIds.size}件の解答用紙に「${tagName}」を追加`,
      })
      clearSelection()
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }

  const handleCreate = useCallback(async () => {
    const userId = requireUserId(user?.id)
    if (!userId) return

    try {
      const newId = crypto.randomUUID()
      const { createDefaultDefinition } = await import("./constants")
      const definition = createDefaultDefinition()
      definition.id = newId

      await createDefinition({ definition, userId })
      // 作成直後は編集したいので作成ページへ直行
      router.push(`/answer-sheet-builder/${newId}/01-edit`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [user?.id, router, createDefinition])

  // 行クリック: 概要（detail）へ
  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/answer-sheet-builder/${id}`)
    },
    [router]
  )

  // ドロップダウン「編集」: 作成ページ（エディタ）へ直行
  const handleOpenEditor = useCallback(
    (id: string) => {
      router.push(`/answer-sheet-builder/${id}/01-edit`)
    },
    [router]
  )

  const handleTransferOwner = useCallback(
    async (nextUserId: string) => {
      const userId = requireUserId(user?.id)
      if (!userId) return
      try {
        await transferOwnerOf({ currentUserId: userId, nextUserId })
        toast.success("担当を渡しました")
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [user?.id, transferOwnerOf]
  )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteDefinition(deleteTarget.id)
    // 削除した定義の id を選択から除く（stale id への一括タグ付与を防ぐ）
    toggleSelect(deleteTarget.id, false)
    setDeleteTarget(null)
  }

  const handleExport = useCallback(
    async (definitionId: string) => {
      try {
        const result = await exportDefinition(definitionId)
        if (!result.canceled) {
          toast.success("解答用紙を書き出しました")
        }
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [exportDefinition]
  )

  const handleImport = useCallback(async () => {
    const userId = requireUserId(user?.id)
    if (!userId) return

    try {
      // 1. ファイル選択
      const fileResult = await selectImportFile()
      if (fileResult.canceled) return

      // 2. インポート実行
      const { warnings } = await importDefinition({
        filePath: fileResult.filePath,
        userId,
      })
      toast.success("解答用紙を読み込みました")
      for (const warning of warnings) {
        toast.warning(warning)
      }
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [user?.id, selectImportFile, importDefinition])

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
        <p className="text-sm text-muted-foreground">読み込み中...</p>
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={showAllOwners}
              onCheckedChange={(checked) => setShowAllOwners(checked === true)}
            />
            全員の解答用紙を表示
          </label>
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
        {visibleDefinitions.length > 0 && (
          <ListFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="名前・タグで検索"
            totalCount={visibleDefinitions.length}
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
        {visibleDefinitions.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="mb-2 text-muted-foreground">
              {showAllOwners
                ? "解答用紙がありません"
                : "担当している解答用紙がありません"}
            </p>
            <Button variant="outline" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              最初の解答用紙を作成
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
                  <TableHead className="w-28">担当</TableHead>
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
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
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
                    <TableCell className="text-sm text-muted-foreground">
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
                    <TableCell className="text-sm text-muted-foreground">
                      {definition.ownerId === user?.id
                        ? "自分"
                        : definition.ownerName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
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
                          {definition.ownerId === user?.id && (
                            <DropdownMenuItem
                              onClick={() => handleOpenEditor(definition.id)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              編集
                            </DropdownMenuItem>
                          )}
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
                          {definition.ownerId === user?.id && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setTransferTarget(definition)}
                              >
                                <UserRoundCog className="mr-2 h-4 w-4" />
                                担当を渡す
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
                            </>
                          )}
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

      <TransferOwnerDialog
        definition={transferTarget}
        currentUserId={user?.id}
        onClose={() => setTransferTarget(null)}
        onTransfer={handleTransferOwner}
      />

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
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
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
