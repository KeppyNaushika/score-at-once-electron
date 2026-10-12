"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { PencilSparkles, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo } from "react"

import { EntityListArchiveDialogs } from "@/components/common/entity-list/EntityListArchiveDialogs"
import {
  entityListBulkUnifiedExportAction,
  entityListCreateAction,
  entityListToolbarActions,
} from "@/components/common/entity-list/entityListToolbarActions"
import { useEntityListArchive } from "@/components/common/entity-list/useEntityListArchive"
import { useEntityListControls } from "@/components/common/entity-list/useEntityListControls"
import { EntityListPage } from "@/components/common/EntityListPage"
import DeleteExamModal from "@/components/exams/shared/DeleteExamModal"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { useInFlightGuard } from "@/hooks/useInFlightGuard"
import type { ListFilterAccessors } from "@/hooks/useListFilter"
import {
  type ExamSummary,
  getExamProgress,
  getExamWorkflowStatus,
} from "@/lib/examStatus"
import {
  createExamMutation,
  examForDetailQuery,
  examListQuery,
} from "@/queries/exam"
import {
  addTagToExamsMutation,
  findOrCreateTagMutation,
  tagListQuery,
} from "@/queries/tag"

import { ExamRowMenu } from "./ExamRowMenu"
import { ExamRowSummary } from "./ExamRowSummary"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_EXAMS: ExamSummary[] = []

/** 試験一覧のフィルタ対象値の取り出し（列見出しの popover が絞る先） */
const EXAM_FILTER_ACCESSORS: ListFilterAccessors<ExamSummary> = {
  searchTexts: (exam) => [
    exam.examName,
    exam.description,
    ...exam.tags.map((tag) => tag.name),
  ],
  tagIds: (exam) => exam.tags.map((tag) => tag.id),
  date: (exam) => exam.referenceDate,
  updatedAt: (exam) => exam.updatedAt,
}

/**
 * 一覧から開く試験の削除確認。中身は概要ページと同じ `DeleteExamModal`（2段階の確認）。
 *
 * 確認は巻き添えになる件数（模範解答・採点領域・答案）を見せるので、一覧の行（概要）では
 * 足りず、概要ページと同じ試験1件の取得を、開いたときだけ取りに行く。取れるまでは窓を出さない。
 * 消した後は一覧に留まる（一覧は削除の書き込みが取り直し、選択からは
 * `useEntityListControls` が消えた行を落とす）。
 */
function ExamListDeleteModal({
  examId,
  open,
  onOpenChange,
}: {
  examId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: exam } = useQuery({
    ...examForDetailQuery(examId),
    enabled: open,
  })
  if (!exam) return null
  return (
    <DeleteExamModal
      exam={exam}
      open={open}
      onOpenChange={onOpenChange}
      onExamDeleted={() => {}}
    />
  )
}

const ExamList = () => {
  const currentUser = useCurrentUser()
  const { data: exams = EMPTY_EXAMS, isPending: isLoading } = useQuery(
    examListQuery(currentUser.id)
  )
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const { mutateAsync: findOrCreateTag } = useMutation(
    findOrCreateTagMutation()
  )
  const { mutateAsync: addTagToExams } = useMutation(addTagToExamsMutation())
  const archive = useEntityListArchive()
  const { importToolbarAction, openUnifiedExport } = archive

  const createExam = useMutation(createExamMutation(currentUser.id))
  // 削除確認を開いている試験。押しただけでは消さず、確認で決めてもらう
  const examDeletion = useDialogTarget<ExamSummary>()
  const router = useRouter()

  // 押せなくするのは isPending だが、それが描画に届く前の連打はここで止める
  const { tryAcquire: tryStartCreate, release: finishCreate } =
    useInFlightGuard()

  /**
   * 新規作成。**ダイアログを出さずに既定値の1件を作り、その概要ページへ直行する。**
   *
   * 名前・試験日・説明・タグは概要ページでその場で編集できるので、作る前に訊く
   * ことが無い。訊いていた頃は「作成は通ったがタグ付けで失敗した」という**途中まで
   * 成功した状態**が生まれ、作り直しを避けるために作った試験を覚えておく必要があった
   * （その覚えのせいで、名前を直して押し直しても名前が反映されなかった）。
   *
   * id は renderer が振る（規約）。失敗したときは遷移しない。
   */
  const handleCreate = useCallback(async () => {
    if (!tryStartCreate()) return
    const examId = crypto.randomUUID()
    try {
      await createExam.mutateAsync({ id: examId, examName: "新しい試験" })
      router.push(`/exams/${examId}`)
    } catch {
      // 失敗の通知は MutationCache が出す
    } finally {
      finishCreate()
    }
  }, [createExam, router, tryStartCreate, finishCreate])

  /** 選んだ試験へ、既存のタグを保ったまま同じタグを足す */
  const assignTagToExams = useCallback(
    async (tagName: string, examIds: string[]) => {
      const tag = await findOrCreateTag(tagName)
      await addTagToExams({ examIds, tagId: tag.id })
    },
    [findOrCreateTag, addTagToExams]
  )

  const { selectedIds, bulkTagAction, listProps } = useEntityListControls(
    exams,
    EXAM_FILTER_ACCESSORS,
    {
      rowNoun: "試験",
      searchPlaceholder: "試験名・タグで検索",
      tagOptions: allTags,
      assignTag: assignTagToExams,
    }
  )

  const actions = useMemo(
    () =>
      entityListToolbarActions({
        create: entityListCreateAction({
          label: "新規作成",
          onClick: () => void handleCreate(),
          disabled: createExam.isPending,
        }),
        archiveImport: importToolbarAction,
        bulkTag: bulkTagAction,
        // 選択中だけ現れる。幅が急に増えるが、畳みは実測なので自然に吸収される
        bulk: [
          entityListBulkUnifiedExportAction({
            rootTable: "Exam",
            selectedIds,
            openUnifiedExport,
          }),
        ],
      }),
    [
      bulkTagAction,
      createExam.isPending,
      handleCreate,
      importToolbarAction,
      openUnifiedExport,
      selectedIds,
    ]
  )

  return (
    <>
      <EntityListPage<ExamSummary>
        {...listProps}
        title="試験"
        totalCount={exams.length}
        isLoading={isLoading}
        name={(exam) => exam.examName}
        summary={(exam) => <ExamRowSummary exam={exam} />}
        dateLabel="試験日"
        referenceDate={(exam) => exam.referenceDate}
        updatedAt={(exam) => exam.updatedAt}
        overviewUrl={(exam) => `/exams/${exam.id}`}
        nextStep={(exam) => {
          const workflow = getExamWorkflowStatus(getExamProgress(exam), exam.id)
          return { label: workflow.text, url: workflow.url }
        }}
        rowMenu={(exam) => (
          <ExamRowMenu
            exam={exam}
            onUnifiedExport={() =>
              openUnifiedExport({ roots: { Exam: [exam.id] } })
            }
            onRequestDelete={() => examDeletion.openWith(exam)}
          />
        )}
        actions={actions}
        empty={{
          icon: PencilSparkles,
          message: "まだ試験がありません",
          action: (
            <Button
              variant="outline"
              onClick={() => void handleCreate()}
              disabled={createExam.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              最初の試験を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する試験がありません"
        sortStorageKey="examList-sort"
      />

      {examDeletion.target && (
        <ExamListDeleteModal
          examId={examDeletion.target.id}
          open={examDeletion.isOpen}
          onOpenChange={examDeletion.handleOpenChange}
        />
      )}

      <EntityListArchiveDialogs archive={archive} />
    </>
  )
}

export default ExamList
