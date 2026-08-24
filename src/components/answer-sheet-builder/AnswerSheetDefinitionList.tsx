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

import BaseModal from "@/components/common/BaseModal"
import {
  BulkTagAssignButton,
  BulkTagAssignPanel,
} from "@/components/common/BulkTagAssignButton"
import { EntityListPage } from "@/components/common/EntityListPage"
import {
  type ExportOutcome,
  ExportResultSummary,
} from "@/components/common/ExportResultSummary"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { usePageHelp } from "@/components/help/usePageHelp"
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
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { getAnswerSheetStatus } from "@/lib/answerSheetStatus"
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

/** 解答用紙一覧のフィルタ対象値（名前・説明・タグ名／タグ／使用日） */
const ASB_FILTER_ACCESSORS: ListFilterAccessors<ASBDefinitionListItem> = {
  searchTexts: (definition) => [
    definition.name,
    definition.description,
    ...(definition.tags ?? []).map((tag) => tag.name),
  ],
  tagIds: (definition) => (definition.tags ?? []).map((tag) => tag.id),
  // 日付範囲の絞り込みは列に出している日付＝使用日に合わせる
  // （以前は更新日時で絞っていて、列の「更新日時」と語だけが揃っていなかった）
  date: (definition) => definition.referenceDate ?? null,
  updatedAt: (definition) => definition.updatedAt ?? null,
}

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
  currentUserId: string
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
  const currentUser = useCurrentUser()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const { definitions, isLoading, deleteDefinition, duplicateDefinition } =
    useAnswerSheetDefinitions(currentUser.id)

  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [transferTarget, setTransferTarget] =
    useState<ASBDefinitionListItem | null>(null)
  /** 書き出しの結果。渡している間は結果モーダルを見せる */
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
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
        : definitions.filter(
            (definition) => definition.ownerId === currentUser.id
          ),
    [definitions, showAllOwners, currentUser.id]
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
    updatedFrom,
    setUpdatedFrom,
    updatedTo,
    setUpdatedTo,
  } = useListFilter(visibleDefinitions, ASB_FILTER_ACCESSORS)

  /**
   * 一括操作の対象にできる行＝**自分が担当のものだけ**。
   *
   * タグ付けは他の編集と同じく担当の確認を通るので、他人の解答用紙を選んでも main が
   * 弾く。しかも一括の書き込みは「既に付いている」を飛ばすために失敗を握り潰すので、
   * **弾かれたことが利用者に伝わらない**（docs/branch-review-findings.md #10 の余波）。
   * 押す前に選べなくしておくのが本筋で、それでもすり抜けた分は下で数えて伝える。
   */
  const taggableDefinitions = useMemo(
    () =>
      filteredDefinitions.filter(
        (definition) => definition.ownerId === currentUser.id
      ),
    [filteredDefinitions, currentUser.id]
  )
  const isTaggable = useCallback(
    (definition: ASBDefinitionListItem) =>
      definition.ownerId === currentUser.id,
    [currentUser.id]
  )

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(taggableDefinitions)

  const handleBulkAddTag = useCallback(
    async (tagName: string) => {
      // 選んだ後に担当が変わることもある（同期で他の端末から届く）ので、実行時にも見る
      const targets = filteredDefinitions.filter(
        (definition) => selectedIds.has(definition.id) && isTaggable(definition)
      )
      const skipped = selectedIds.size - targets.length
      if (targets.length === 0) {
        toast.error("タグを追加できませんでした", {
          description: "選んだ解答用紙はどれも担当ではありません。",
        })
        return
      }
      try {
        const tag = await findOrCreateTag(tagName)
        await addTagToDefinitions({
          definitionIds: targets.map((definition) => definition.id),
          tagId: tag.id,
        })
        toast.success("タグを追加しました", {
          description:
            skipped > 0
              ? `${targets.length}件の解答用紙に「${tagName}」を追加（${skipped}件は担当ではないため対象外）`
              : `${targets.length}件の解答用紙に「${tagName}」を追加`,
        })
        clearSelection()
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [
      addTagToDefinitions,
      clearSelection,
      filteredDefinitions,
      findOrCreateTag,
      isTaggable,
      selectedIds,
    ]
  )

  const handleCreate = useCallback(async () => {
    try {
      const newId = crypto.randomUUID()
      const { createDefaultDefinition } = await import("./constants")
      const definition = createDefaultDefinition()
      definition.id = newId

      await createDefinition({ definition, userId: currentUser.id })
      // 作成直後は編集したいので作成ページへ直行
      router.push(`/answer-sheet-builder/${newId}/01-edit`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [currentUser.id, router, createDefinition])

  // ドロップダウン「編集」: 作成ページ（エディタ）へ直行
  const handleOpenEditor = useCallback(
    (id: string) => {
      router.push(`/answer-sheet-builder/${id}/01-edit`)
    },
    [router]
  )

  const handleTransferOwner = useCallback(
    async (nextUserId: string) => {
      try {
        await transferOwnerOf({ currentUserId: currentUser.id, nextUserId })
        toast.success("担当を渡しました")
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [currentUser.id, transferOwnerOf]
  )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteDefinition(deleteTarget.id)
    // 削除した定義の id を選択から除く（stale id への一括タグ付与を防ぐ）
    toggleSelect(deleteTarget.id, false)
    setDeleteTarget(null)
  }

  const handleExport = useCallback(
    async (definition: ASBDefinitionListItem) => {
      try {
        const exportResult = await exportDefinition(definition.id)
        // 保存先を選ばずに閉じたのは失敗ではないので、何も言わない
        if (exportResult.canceled) return
        // 結果はモーダルの中で見せる（欠けた画像はファイル名まで出す）
        setExportOutcome({
          archives: [
            {
              sourceId: definition.id,
              sourceName: definition.name,
              outputPath: exportResult.outputPath,
              missingFiles: exportResult.missingFiles ?? [],
            },
          ],
          failures: [],
        })
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [exportDefinition]
  )

  const handleImport = useCallback(async () => {
    try {
      // 1. ファイル選択
      const fileResult = await selectImportFile()
      if (fileResult.canceled) return

      // 2. インポート実行
      const { warnings } = await importDefinition({
        filePath: fileResult.filePath,
        userId: currentUser.id,
      })
      toast.success("解答用紙を読み込みました")
      for (const warning of warnings) {
        toast.warning(warning)
      }
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [currentUser.id, selectImportFile, importDefinition])

  const tagFilterConfig = useMemo(
    () => ({
      options: allTags,
      selectedIds: filterTagIds,
      onToggle: toggleTagId,
      onClear: clearTagIds,
    }),
    [allTags, filterTagIds, toggleTagId, clearTagIds]
  )

  const actions = useMemo<ToolbarAction[]>(() => {
    // 並びに出す姿と「…」の中の姿が同じもの。作るのは1回にして、幅を測る控えの
    // 並びと本物で同じ要素が使われるようにする
    const ownerScopeToggle = (
      <label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
        <Checkbox
          checked={showAllOwners}
          onCheckedChange={(checked) => setShowAllOwners(checked === true)}
        />
        全員の解答用紙を表示
      </label>
    )

    const toolbarActions: ToolbarAction[] = [
      {
        id: "create",
        priority: 80,
        node: (
          <Button
            onClick={handleCreate}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        ),
        collapsedNode: (
          <Button
            onClick={handleCreate}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        ),
      },
      {
        id: "import",
        priority: 70,
        node: (
          <Button
            onClick={handleImport}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .asb 読み込み
          </Button>
        ),
        collapsedNode: (
          <Button
            onClick={handleImport}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .asb 読み込み
          </Button>
        ),
      },
      {
        // 「誰の解答用紙を見るか」は絞り込みの一種なので、他の絞り込みと同じ側に置く
        id: "owner-scope",
        priority: 65,
        node: ownerScopeToggle,
        collapsedNode: ownerScopeToggle,
      },
    ]

    if (selectedIds.size > 0) {
      toolbarActions.push({
        id: "bulk-tag",
        priority: 60,
        node: (
          <BulkTagAssignButton
            selectedCount={selectedIds.size}
            allTags={allTags}
            onAssign={handleBulkAddTag}
          />
        ),
        collapsedNode: (
          <BulkTagAssignPanel
            selectedCount={selectedIds.size}
            allTags={allTags}
            onAssign={handleBulkAddTag}
          />
        ),
      })
    }

    return toolbarActions
  }, [
    allTags,
    handleBulkAddTag,
    handleCreate,
    handleImport,
    showAllOwners,
    selectedIds,
  ])

  return (
    <>
      <EntityListPage<ASBDefinitionListItem>
        title="解答用紙作成"
        helpButton={helpButton}
        rows={filteredDefinitions}
        totalCount={visibleDefinitions.length}
        isLoading={isLoading}
        name={(definition) => definition.name}
        summary={(definition) => (
          <span className="flex flex-wrap items-center gap-1">
            {(definition.tags ?? []).map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-xs font-normal"
                style={
                  tag.color
                    ? { borderColor: tag.color, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </Badge>
            ))}
            <span>
              {definition.paperSize ?? "-"}{" "}
              {definition.orientation === "landscape" ? "横" : "縦"}
              {" / 設問数: "}
              {definition.questionCount ?? 0}
              {" / 合計配点: "}
              {definition.totalPoints ?? 0}点 / 担当:{" "}
              {definition.ownerId === currentUser.id
                ? "自分"
                : definition.ownerName}
            </span>
          </span>
        )}
        dateLabel="使用日"
        referenceDate={(definition) => definition.referenceDate ?? null}
        updatedAt={(definition) => definition.updatedAt ?? null}
        overviewUrl={(definition) => `/answer-sheet-builder/${definition.id}`}
        nextStep={(definition) => {
          const status = getAnswerSheetStatus(definition)
          return { label: status.text, url: status.url }
        }}
        rowMenu={(definition) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`${definition.name}の操作`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {definition.ownerId === currentUser.id && (
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
              <DropdownMenuItem onClick={() => handleExport(definition)}>
                <FolderOutput className="mr-2 h-4 w-4" />
                .asb 書き出し
              </DropdownMenuItem>
              {definition.ownerId === currentUser.id && (
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
        )}
        actions={actions}
        search={{
          term: searchTerm,
          onChange: setSearchTerm,
          placeholder: "名前・タグで検索",
        }}
        tagFilter={tagFilterConfig}
        dateFilter={{
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
        }}
        updatedAtFilter={{
          from: updatedFrom,
          to: updatedTo,
          onFromChange: setUpdatedFrom,
          onToChange: setUpdatedTo,
        }}
        selectedIds={selectedIds}
        selectionDisabledReason={(definition) =>
          isTaggable(definition)
            ? undefined
            : `担当は ${definition.ownerName} さんです`
        }
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        allSelected={allSelected}
        empty={{
          message: showAllOwners
            ? "解答用紙がありません"
            : "担当している解答用紙がありません",
          action: (
            <Button variant="outline" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              最初の解答用紙を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する解答用紙がありません"
        sortStorageKey="answerSheetList-sort"
      />

      {exportOutcome && (
        <BaseModal
          open
          onOpenChange={(open) => !open && setExportOutcome(null)}
          title=".asb 書き出し"
          variant={
            exportOutcome.archives.some(
              (archive) => archive.missingFiles.length > 0
            )
              ? "warning"
              : "success"
          }
          size="lg"
          actions={{ cancel: { label: "閉じる" } }}
        >
          <ExportResultSummary outcome={exportOutcome} />
        </BaseModal>
      )}

      <TransferOwnerDialog
        definition={transferTarget}
        currentUserId={currentUser.id}
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
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
