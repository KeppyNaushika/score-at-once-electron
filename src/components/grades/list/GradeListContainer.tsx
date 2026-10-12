"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { ChartColumn, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

import { bulkTagToolbarAction } from "@/components/common/BulkTagAssignButton"
import { EntityListArchiveDialogs } from "@/components/common/entity-list/EntityListArchiveDialogs"
import { deleteFromEntityList } from "@/components/common/entity-list/entityListDeletion"
import { useEntityListArchive } from "@/components/common/entity-list/useEntityListArchive"
import { useEntityListControls } from "@/components/common/entity-list/useEntityListControls"
import { EntityListPage } from "@/components/common/EntityListPage"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import { Button } from "@/components/ui/button"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import type { ListFilterAccessors } from "@/hooks/useListFilter"
import { collectClassroomOptions } from "@/lib/filterOptions"
import { getGradeStatus } from "@/lib/gradeStatus"
import {
  addTagToGradesMutation,
  createGradeMutation,
  deleteGradeMutation,
  duplicateGradeMutation,
  gradeListQuery,
} from "@/queries/grade"
import { findOrCreateTagMutation, tagListQuery } from "@/queries/tag"
import type { GradeSummary } from "@/types/grade.types"

import { DeleteGradeModal } from "../DeleteGradeModal"
import { GradeRowMenu } from "./GradeRowMenu"
import { GradeRowSummary } from "./GradeRowSummary"

/**
 * 成績算出一覧のフィルタ対象値（名前・説明・学級名・タグ名／タグ／学級／成績算出日）
 */
const GRADE_FILTER_ACCESSORS: ListFilterAccessors<GradeSummary> = {
  searchTexts: (grade) => [
    grade.name,
    grade.description,
    ...grade.gradeClassrooms.map(
      (gradeClassroom) => gradeClassroom.classroom.name
    ),
    ...grade.gradeTags.map((gradeTag) => gradeTag.tag.name),
  ],
  tagIds: (grade) => grade.gradeTags.map((gradeTag) => gradeTag.tagId),
  classroomIds: (grade) =>
    grade.gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroomId),
  date: (grade) => grade.referenceDate,
  updatedAt: (grade) => grade.updatedAt,
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_GRADES: GradeSummary[] = []
const EMPTY_TAGS: TagWithAllRelations[] = []

/**
 * 成績算出の一覧コンテナ
 *
 * 列・当たり判定・並べ替え・空の出し分けは `EntityListPage` が1つだけ持つ。
 * ここが渡すのは「行1件から6つの列をどう作るか」と、ヘッダー右に並べる操作。
 *
 * **語は「成績算出」で通す。** 中身は成績算出試験だが、試験一覧と同じ「試験」で
 * 呼ぶと、どちらの一覧を見ているのか見分けが付かない。
 */
export function GradeListContainer() {
  const router = useRouter()
  const { data: grades = EMPTY_GRADES, isPending: isLoading } =
    useQuery(gradeListQuery())
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const createGrade = useMutation(createGradeMutation())
  const deleteGrade = useMutation(deleteGradeMutation())
  const duplicateGrade = useMutation(duplicateGradeMutation())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToGrades = useMutation(addTagToGradesMutation())
  const archive = useEntityListArchive()
  const { importToolbarAction, openUnifiedExport } = archive
  // 削除確認を開いている成績算出。押しただけでは消さず、確認で決めてもらう
  const gradeDeletion = useDialogTarget<GradeSummary>()

  /**
   * 新規作成。**ダイアログを出さずに既定値の1件を作り、その概要ページへ直行する。**
   *
   * 名前・成績算出日・説明・タグは概要ページでその場で編集できるので、作る前に
   * 訊くことが無い。作成直後に基本設定を促すために編集モーダルを自動で開いていた
   * （`?setup=1`）のも、開く先が概要ページそのものになったので要らない。
   *
   * id は renderer が振る（規約）。失敗したときは遷移しない。
   */
  const handleCreate = useCallback(async () => {
    const gradeId = crypto.randomUUID()
    try {
      await createGrade.mutateAsync({ id: gradeId, name: "新しい成績" })
      router.push(`/grades/${gradeId}`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [createGrade, router])

  const handleDelete = (grade: GradeSummary) =>
    deleteFromEntityList({
      remove: () => deleteGrade.mutateAsync(grade.id),
      closeDialog: gradeDeletion.close,
      successMessage: "成績算出を削除しました",
      entityName: grade.name,
    })

  const handleDuplicate = async (gradeId: string) => {
    try {
      const duplicated = await duplicateGrade.mutateAsync(gradeId)
      toast.success(`「${duplicated.name}」を複製しました`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }

  // 一覧に出現する学級を集約してフィルタ選択肢にする
  const classroomOptions = useMemo(
    () =>
      collectClassroomOptions(grades, (grade) =>
        grade.gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroom)
      ),
    [grades]
  )

  const { selectedIds, addTagToSelection, listProps } = useEntityListControls(
    grades,
    GRADE_FILTER_ACCESSORS,
    {
      rowNoun: "成績算出",
      searchPlaceholder: "成績算出名・タグ・学級で検索",
      tagOptions: allTags,
      classroomOptions,
    }
  )

  /** 選んだ成績算出へ、既存のタグを保ったまま同じタグを足す */
  const handleBulkAddTag = useCallback(
    (tagName: string) =>
      addTagToSelection(tagName, async (trimmedTagName, gradeIds) => {
        const tag = await findOrCreateTag.mutateAsync(trimmedTagName)
        await addTagToGrades.mutateAsync({ gradeIds, tagId: tag.id })
      }),
    [addTagToSelection, findOrCreateTag, addTagToGrades]
  )

  const actions = useMemo<ToolbarAction[]>(() => {
    const toolbarActions: ToolbarAction[] = [
      toolbarButtonAction({
        id: "create",
        priority: 80,
        icon: Plus,
        label: "新規作成",
        onClick: () => void handleCreate(),
      }),
      importToolbarAction,
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
    handleBulkAddTag,
    handleCreate,
    importToolbarAction,
    selectedIds,
  ])

  return (
    <>
      <EntityListPage<GradeSummary>
        {...listProps}
        title="成績算出"
        totalCount={grades.length}
        isLoading={isLoading}
        name={(grade) => grade.name}
        summary={(grade) => <GradeRowSummary grade={grade} />}
        dateLabel="成績算出日"
        referenceDate={(grade) => grade.referenceDate}
        updatedAt={(grade) => grade.updatedAt}
        overviewUrl={(grade) => `/grades/${grade.id}`}
        nextStep={(grade) => {
          const status = getGradeStatus(grade)
          return { label: status.text, url: status.url }
        }}
        rowMenu={(grade) => (
          <GradeRowMenu
            grade={grade}
            onDuplicate={() => handleDuplicate(grade.id)}
            onUnifiedExport={() =>
              openUnifiedExport({ roots: { Grade: [grade.id] } })
            }
            onRequestDelete={() => gradeDeletion.openWith(grade)}
          />
        )}
        actions={actions}
        empty={{
          icon: ChartColumn,
          message: "成績算出がありません",
          action: (
            <Button variant="outline" onClick={() => void handleCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              最初の成績算出を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する成績算出がありません"
        sortStorageKey="gradeList-sort"
      />

      <DeleteGradeModal
        open={gradeDeletion.isOpen}
        target={gradeDeletion.target}
        onClose={gradeDeletion.close}
        onConfirm={() =>
          gradeDeletion.target ? handleDelete(gradeDeletion.target) : undefined
        }
        loading={deleteGrade.isPending}
      />

      <EntityListArchiveDialogs archive={archive} />
    </>
  )
}
