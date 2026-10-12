"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FilePen } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import { bulkTagToolbarAction } from "@/components/common/BulkTagAssignButton"
import { EntityListArchiveDialogs } from "@/components/common/entity-list/EntityListArchiveDialogs"
import { deleteFromEntityList } from "@/components/common/entity-list/entityListDeletion"
import { useEntityListArchive } from "@/components/common/entity-list/useEntityListArchive"
import { useEntityListControls } from "@/components/common/entity-list/useEntityListControls"
import { EntityListPage } from "@/components/common/EntityListPage"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { Checkbox } from "@/components/ui/checkbox"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import type { ListFilterAccessors } from "@/hooks/useListFilter"
import { getAnswerSheetStatus } from "@/lib/answerSheetStatus"
import {
  answerSheetBuilderWorkflowSteps,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
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
  const { mutateAsync: findOrCreateTag } = useMutation(
    findOrCreateTagMutation()
  )
  const { mutateAsync: addTagToDefinitions } = useMutation(
    addTagToAnswerSheetDefinitionsMutation()
  )
  /** 一覧には全員の解答用紙が載る。既定は自分が担当のものだけを出す */
  const [showAllOwners, setShowAllOwners] = useState(false)
  const archive = useEntityListArchive()
  const { importToolbarAction, openUnifiedExport } = archive

  const visibleDefinitions = useMemo(
    () =>
      showAllOwners
        ? definitions
        : definitions.filter(
            (definition) => definition.ownerId === currentUser.id
          ),
    [definitions, showAllOwners, currentUser.id]
  )

  /**
   * 一括操作の対象にできる行＝**自分が担当のものだけ**。
   *
   * タグ付けは他の編集と同じく担当の確認を通るので、他人の解答用紙を選んでも main が
   * 弾く。しかも一括の書き込みは「既に付いている」を飛ばすために失敗を握り潰すので、
   * **弾かれたことが利用者に伝わらない**。
   * 押す前に選べなくしておく。選んだ後に担当が変わったとき（同期で他の端末から届く）は、
   * `useEntityListControls` がその行を選択から落とす。
   */
  const isTaggable = useCallback(
    (definition: ASBDefinitionListItem) =>
      definition.ownerId === currentUser.id,
    [currentUser.id]
  )

  const { selectedIds, addTagToSelection, listProps } = useEntityListControls(
    visibleDefinitions,
    ASB_FILTER_ACCESSORS,
    {
      rowNoun: "解答用紙",
      searchPlaceholder: "名前・タグで検索",
      tagOptions: allTags,
      isSelectable: isTaggable,
    }
  )

  const handleBulkAddTag = useCallback(
    (tagName: string) =>
      addTagToSelection(tagName, async (trimmedTagName, definitionIds) => {
        const tag = await findOrCreateTag(trimmedTagName)
        await addTagToDefinitions({ definitionIds, tagId: tag.id })
      }),
    [addTagToSelection, findOrCreateTag, addTagToDefinitions]
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
    await deleteFromEntityList({
      remove: () => deleteDefinition(definition.id),
      closeDialog: definitionDeletion.close,
      successMessage: "解答用紙を削除しました",
      entityName: definition.name,
    })
  }

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
      importToolbarAction,
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
  }, [
    allTags,
    currentUser.id,
    handleBulkAddTag,
    importToolbarAction,
    showAllOwners,
    selectedIds,
  ])

  return (
    <>
      <EntityListPage<ASBDefinitionListItem>
        {...listProps}
        title="解答用紙作成"
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
            onUnifiedExport={() =>
              openUnifiedExport({
                roots: { AsbDefinition: [definition.id] },
              })
            }
            onTransfer={() => setTransferTarget(definition)}
            onDelete={() => definitionDeletion.openWith(definition)}
          />
        )}
        actions={actions}
        selectionDisabledReason={(definition) =>
          isTaggable(definition)
            ? undefined
            : `担当は ${definition.ownerName} さんです`
        }
        empty={{
          icon: FilePen,
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

      <EntityListArchiveDialogs archive={archive} />
    </>
  )
}
