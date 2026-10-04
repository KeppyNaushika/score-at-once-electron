"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FileEdit } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import BaseModal from "@/components/common/BaseModal"
import { bulkTagToolbarAction } from "@/components/common/BulkTagAssignButton"
import { EntityListPage } from "@/components/common/EntityListPage"
import {
  type ExportOutcome,
  ExportResultSummary,
} from "@/components/common/ExportResultSummary"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { Checkbox } from "@/components/ui/checkbox"
import type { UnifiedArchiveExportInitialSelection } from "@/components/unified-archive/export/types"
import { UnifiedArchiveExportDialog } from "@/components/unified-archive/export/UnifiedArchiveExportDialog"
import { unifiedArchiveImportToolbarAction } from "@/components/unified-archive/import/unifiedArchiveImportToolbarAction"
import { UnifiedArchiveImportWizard } from "@/components/unified-archive/import/UnifiedArchiveImportWizard"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { getAnswerSheetStatus } from "@/lib/answerSheetStatus"
import {
  answerSheetBuilderWorkflowSteps,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
import { exportAnswerSheetDefinitionMutation } from "@/queries/answerSheetBuilder"
import {
  addTagToAnswerSheetDefinitionsMutation,
  findOrCreateTagMutation,
  tagListQuery,
} from "@/queries/tag"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

import { CreateDefinitionButton } from "./components/list/CreateDefinitionButton"
import { DefinitionRowMenu } from "./components/list/DefinitionRowMenu"
import { DefinitionSummary } from "./components/list/DefinitionSummary"
import { DeleteDefinitionDialog } from "./components/list/DeleteDefinitionDialog"
import { ImportDefinitionButton } from "./components/list/ImportDefinitionButton"
import { TransferOwnerDialog } from "./components/list/TransferOwnerDialog"
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

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []

export function AnswerSheetDefinitionList() {
  const currentUser = useCurrentUser()
  const router = useRouter()
  const { definitions, isLoading, deleteDefinition, duplicateDefinition } =
    useAnswerSheetDefinitions(currentUser.id)

  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const definitionDeletion = useDialogTarget<ASBDefinitionListItem>()
  const [transferTarget, setTransferTarget] =
    useState<ASBDefinitionListItem | null>(null)
  /** 書き出しの結果。渡している間は結果モーダルを見せる */
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
  const { mutateAsync: exportDefinition } = useMutation(
    exportAnswerSheetDefinitionMutation()
  )
  const { mutateAsync: findOrCreateTag } = useMutation(
    findOrCreateTagMutation()
  )
  const { mutateAsync: addTagToDefinitions } = useMutation(
    addTagToAnswerSheetDefinitionsMutation()
  )
  /** 一覧には全員の解答用紙が載る。既定は自分が担当のものだけを出す */
  const [showAllOwners, setShowAllOwners] = useState(false)
  const [showUnifiedImport, setShowUnifiedImport] = useState(false)
  /** .sao 書き出しを開いたときの最初の選択。null の間は閉じている */
  const [unifiedExportSelection, setUnifiedExportSelection] =
    useState<UnifiedArchiveExportInitialSelection | null>(null)

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
   * **弾かれたことが利用者に伝わらない**。
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

  // ドロップダウン「編集」: 作成ページ（エディタ）へ直行
  const handleOpenEditor = useCallback(
    (id: string) => {
      router.push(
        workflowStepHref(
          `/answer-sheet-builder/${id}`,
          answerSheetBuilderWorkflowSteps,
          "01-edit"
        )
      )
    },
    [router]
  )

  const confirmDelete = async () => {
    const definition = definitionDeletion.target
    if (!definition) return
    await deleteDefinition(definition.id)
    // 削除した定義の id を選択から除く（stale id への一括タグ付与を防ぐ）
    toggleSelect(definition.id, false)
    definitionDeletion.close()
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
          <CreateDefinitionButton
            userId={currentUser.id}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            新規作成
          </CreateDefinitionButton>
        ),
        collapsedNode: (
          <CreateDefinitionButton
            userId={currentUser.id}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            新規作成
          </CreateDefinitionButton>
        ),
      },
      {
        id: "import",
        priority: 70,
        node: (
          <ImportDefinitionButton
            userId={currentUser.id}
            variant="outline"
            className="rounded-lg"
          />
        ),
        collapsedNode: (
          <ImportDefinitionButton
            userId={currentUser.id}
            variant="ghost"
            className="w-full justify-start"
          />
        ),
      },
      unifiedArchiveImportToolbarAction({
        priority: 69,
        onClick: () => setShowUnifiedImport(true),
      }),
      {
        // 「誰の解答用紙を見るか」は絞り込みの一種なので、他の絞り込みと同じ側に置く
        id: "owner-scope",
        priority: 65,
        node: ownerScopeToggle,
        collapsedNode: ownerScopeToggle,
      },
    ]

    if (selectedIds.size > 0) {
      toolbarActions.push(
        bulkTagToolbarAction({
          priority: 60,
          selectedCount: selectedIds.size,
          allTags,
          onAssign: handleBulkAddTag,
        })
      )
    }

    return toolbarActions
  }, [allTags, currentUser.id, handleBulkAddTag, showAllOwners, selectedIds])

  return (
    <>
      <EntityListPage<ASBDefinitionListItem>
        title="解答用紙作成"
        rows={filteredDefinitions}
        totalCount={visibleDefinitions.length}
        isLoading={isLoading}
        name={(definition) => definition.name}
        summary={(definition) => (
          <DefinitionSummary
            definition={definition}
            currentUserId={currentUser.id}
          />
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
          <DefinitionRowMenu
            definition={definition}
            isOwner={definition.ownerId === currentUser.id}
            onEdit={() => handleOpenEditor(definition.id)}
            onDuplicate={() => duplicateDefinition(definition.id)}
            onExport={() => handleExport(definition)}
            onUnifiedExport={() =>
              setUnifiedExportSelection({
                roots: { AsbDefinition: [definition.id] },
              })
            }
            onTransfer={() => setTransferTarget(definition)}
            onDelete={() => definitionDeletion.openWith(definition)}
          />
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
          icon: FileEdit,
          message: showAllOwners
            ? "解答用紙がありません"
            : "担当している解答用紙がありません",
          action: (
            <CreateDefinitionButton userId={currentUser.id} variant="outline">
              最初の解答用紙を作成
            </CreateDefinitionButton>
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

      <UnifiedArchiveExportDialog
        open={unifiedExportSelection !== null}
        onOpenChange={(open) => {
          if (!open) setUnifiedExportSelection(null)
        }}
        initialSelection={unifiedExportSelection ?? {}}
      />

      <TransferOwnerDialog
        definition={transferTarget}
        currentUserId={currentUser.id}
        onClose={() => setTransferTarget(null)}
      />

      <DeleteDefinitionDialog
        open={definitionDeletion.isOpen}
        onOpenChange={definitionDeletion.handleOpenChange}
        definitionName={definitionDeletion.target?.name}
        onConfirm={confirmDelete}
      />

      <UnifiedArchiveImportWizard
        open={showUnifiedImport}
        onOpenChange={setShowUnifiedImport}
      />
    </>
  )
}
