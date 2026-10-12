"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { ClipboardList, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo } from "react"

import { EntityListArchiveDialogs } from "@/components/common/entity-list/EntityListArchiveDialogs"
import { deleteFromEntityList } from "@/components/common/entity-list/entityListDeletion"
import {
  entityListBulkUnifiedExportAction,
  entityListCreateAction,
  entityListToolbarActions,
} from "@/components/common/entity-list/entityListToolbarActions"
import { useEntityListArchive } from "@/components/common/entity-list/useEntityListArchive"
import { useEntityListControls } from "@/components/common/entity-list/useEntityListControls"
import { EntityListPage } from "@/components/common/EntityListPage"
import { Button } from "@/components/ui/button"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { useInFlightGuard } from "@/hooks/useInFlightGuard"
import type { ListFilterAccessors } from "@/hooks/useListFilter"
import { getCourseworkStatus } from "@/lib/courseworkStatus"
import { collectClassroomOptions } from "@/lib/filterOptions"
import {
  addTagToCourseworksMutation,
  courseworkListQuery,
  createCourseworkMutation,
  deleteCourseworkMutation,
} from "@/queries/coursework"
import { findOrCreateTagMutation, tagListQuery } from "@/queries/tag"
import type { CourseworkSummary } from "@/types/coursework.types"

import { DeleteCourseworkModal } from "../DeleteCourseworkModal"
import { CourseworkRowMenu } from "./CourseworkRowMenu"
import { CourseworkRowSummary } from "./CourseworkRowSummary"

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
  date: (coursework) => coursework.referenceDate,
  updatedAt: (coursework) => coursework.updatedAt,
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_COURSEWORKS: CourseworkSummary[] = []

/**
 * 試験外成績資料（Coursework）の一覧コンテナ
 *
 * 列・当たり判定・並べ替え・空の出し分けは `EntityListPage` が1つだけ持つ。
 * ここが渡すのは「行1件から6つの列をどう作るか」と、ヘッダー右に並べる操作。
 * 削除は確認（`DeleteCourseworkModal`）を通してから行う。成績算出から参照中の
 * 資料は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkListContainer() {
  const router = useRouter()
  const deleteCoursework = useMutation(deleteCourseworkMutation())
  const { mutateAsync: findOrCreateTag } = useMutation(
    findOrCreateTagMutation()
  )
  const { mutateAsync: addTagToCourseworks } = useMutation(
    addTagToCourseworksMutation()
  )
  const createCoursework = useMutation(createCourseworkMutation())
  const { data: courseworks = EMPTY_COURSEWORKS, isPending: isLoading } =
    useQuery(courseworkListQuery())
  const archive = useEntityListArchive()
  const { importToolbarAction, openUnifiedExport } = archive
  // 押しただけでは消さず、確認で決めてもらう
  const courseworkDeletion = useDialogTarget<CourseworkSummary>()
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())

  // 押せなくするのは isPending だが、それが描画に届く前の連打はここで止める
  const { tryAcquire: tryStartCreate, release: finishCreate } =
    useInFlightGuard()

  /**
   * 新規作成。**ダイアログを出さずに既定値の1件を作り、その概要ページへ直行する。**
   *
   * 名前・実施日・説明・タグは概要ページでその場で編集できるので、作る前に訊く
   * ことが無い。作成直後に基本設定を促すために編集モーダルを自動で開いていた
   * （`?setup=1`）のも、開く先が概要ページそのものになったので要らない。
   *
   * id は renderer が振る（規約）。失敗したときは遷移しない。
   */
  const handleCreate = useCallback(async () => {
    if (!tryStartCreate()) return
    const courseworkId = crypto.randomUUID()
    try {
      await createCoursework.mutateAsync({
        id: courseworkId,
        name: "新しい資料",
      })
      router.push(`/coursework/${courseworkId}`)
    } catch {
      // 失敗の通知は MutationCache が出す
    } finally {
      finishCreate()
    }
  }, [createCoursework, router, tryStartCreate, finishCreate])

  const handleDelete = (coursework: CourseworkSummary) =>
    // 成績算出で使われていて断られたときも、失敗の通知は MutationCache が出す
    deleteFromEntityList({
      remove: () => deleteCoursework.mutateAsync(coursework.id),
      closeDialog: courseworkDeletion.close,
      successMessage: "資料を削除しました",
      entityName: coursework.name,
    })

  const classroomOptions = useMemo(
    () =>
      collectClassroomOptions(courseworks, (coursework) =>
        coursework.classrooms.map(
          (courseworkClassroom) => courseworkClassroom.classroom
        )
      ),
    [courseworks]
  )

  // 既存タグを保ったまま1件ずつ足す（全置換 setTags による stale 消失を回避）
  const assignTagToCourseworks = useCallback(
    async (tagName: string, courseworkIds: string[]) => {
      const tag = await findOrCreateTag(tagName)
      await addTagToCourseworks({ courseworkIds, tagId: tag.id })
    },
    [findOrCreateTag, addTagToCourseworks]
  )

  const { selectedIds, bulkTagAction, listProps } = useEntityListControls(
    courseworks,
    COURSEWORK_FILTER_ACCESSORS,
    {
      rowNoun: "資料",
      searchPlaceholder: "資料名・タグ・学級で検索",
      tagOptions: allTags,
      assignTag: assignTagToCourseworks,
      classroomOptions,
    }
  )

  const actions = useMemo(
    () =>
      entityListToolbarActions({
        create: entityListCreateAction({
          label: "新規作成",
          onClick: () => void handleCreate(),
          disabled: createCoursework.isPending,
        }),
        archiveImport: importToolbarAction,
        bulkTag: bulkTagAction,
        bulk: [
          entityListBulkUnifiedExportAction({
            rootTable: "Coursework",
            selectedIds,
            openUnifiedExport,
          }),
        ],
      }),
    [
      bulkTagAction,
      createCoursework.isPending,
      handleCreate,
      importToolbarAction,
      openUnifiedExport,
      selectedIds,
    ]
  )

  return (
    <>
      <EntityListPage<CourseworkSummary>
        {...listProps}
        title="試験外成績資料"
        totalCount={courseworks.length}
        isLoading={isLoading}
        name={(coursework) => coursework.name}
        summary={(coursework) => (
          <CourseworkRowSummary coursework={coursework} />
        )}
        dateLabel="実施日"
        referenceDate={(coursework) => coursework.referenceDate}
        updatedAt={(coursework) => coursework.updatedAt}
        overviewUrl={(coursework) => `/coursework/${coursework.id}`}
        nextStep={(coursework) => {
          const status = getCourseworkStatus(coursework)
          return { label: status.text, url: status.url }
        }}
        rowMenu={(coursework) => (
          <CourseworkRowMenu
            coursework={coursework}
            onUnifiedExport={() =>
              openUnifiedExport({
                roots: { Coursework: [coursework.id] },
              })
            }
            onRequestDelete={() => courseworkDeletion.openWith(coursework)}
          />
        )}
        actions={actions}
        empty={{
          icon: ClipboardList,
          message: "まだ試験外成績資料がありません",
          action: (
            <Button
              variant="outline"
              onClick={() => void handleCreate()}
              disabled={createCoursework.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              最初の資料を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する資料がありません"
        sortStorageKey="courseworkList-sort"
      />

      <DeleteCourseworkModal
        open={courseworkDeletion.isOpen}
        target={courseworkDeletion.target}
        onClose={courseworkDeletion.close}
        onConfirm={() =>
          courseworkDeletion.target
            ? handleDelete(courseworkDeletion.target)
            : undefined
        }
        loading={deleteCoursework.isPending}
      />

      <EntityListArchiveDialogs archive={archive} />
    </>
  )
}
