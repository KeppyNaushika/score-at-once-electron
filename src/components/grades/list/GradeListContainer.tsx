"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Copy,
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  BulkTagAssignButton,
  BulkTagAssignPanel,
} from "@/components/common/BulkTagAssignButton"
import { EntityListPage } from "@/components/common/EntityListPage"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { usePageHelp } from "@/components/help/usePageHelp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { collectClassroomOptions } from "@/lib/filterOptions"
import { getGradeStatus } from "@/lib/gradeStatus"
import {
  addTagToGradesMutation,
  analyzeGradeArchiveMutation,
  createGradeMutation,
  deleteGradeMutation,
  duplicateGradeMutation,
  executeGradeImportMutation,
  exportGradeArchiveMutation,
  type GradeArchivePayload,
  gradeListQuery,
} from "@/queries/grade"
import { findOrCreateTagMutation, tagListQuery } from "@/queries/tag"
import type { CourseworkImportDecision } from "@/types/courseworkArchive.types"
import type { GradeSummary } from "@/types/grade.types"
import type { GradeArchiveImportPreview } from "@/types/gradeArchive.types"

import { GradeImportDialog } from "./GradeImportDialog"

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
  const queryClient = useQueryClient()
  const { helpButton } = usePageHelp()
  const { data: grades = EMPTY_GRADES, isPending: isLoading } =
    useQuery(gradeListQuery())
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const createGrade = useMutation(createGradeMutation())
  const deleteGrade = useMutation(deleteGradeMutation())
  const duplicateGrade = useMutation(duplicateGradeMutation())
  const exportArchive = useMutation(exportGradeArchiveMutation())
  const analyzeArchive = useMutation(analyzeGradeArchiveMutation())
  const executeImport = useMutation(executeGradeImportMutation())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToGrades = useMutation(addTagToGradesMutation())
  // インポート確認ウィザードの状態
  const [importPreview, setImportPreview] =
    useState<GradeArchiveImportPreview | null>(null)
  // 旧バージョンの形もそのまま来る（変換は取り込み実行時に main が行う）ので、
  // 境界の返り値をそのまま持つ
  const [importArchiveData, setImportArchiveData] =
    useState<GradeArchivePayload | null>(null)

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

  const handleDelete = (id: string) => {
    deleteGrade.mutate(id)
  }

  const handleDuplicate = async (id: string) => {
    const duplicated = await duplicateGrade.mutateAsync(id)
    toast.success(`「${duplicated.name}」を複製しました`)
  }

  // ヘッダーの並び（useMemo）から参照するので、参照を安定させる
  const handleImport = useCallback(async () => {
    const result = await analyzeArchive.mutateAsync()
    if (result.canceled) return
    // ファイル選択後はウィザードを開き、照合方法をユーザーに判断させる
    setImportArchiveData(result.archiveData)
    setImportPreview(result.preview)
  }, [analyzeArchive])

  const handleImportConfirm = async (
    decisions: Record<string, CourseworkImportDecision>
  ) => {
    if (!importArchiveData || !importPreview) return
    try {
      // 試験参照のマッピング（examName → 既存examId）を照合結果から構築
      const examMapping: Record<string, string> = {}
      for (const examMatch of importPreview.examMatches) {
        if (examMatch.found && examMatch.examId)
          examMapping[examMatch.examName] = examMatch.examId
      }
      const importResult = await executeImport.mutateAsync({
        archiveData: importArchiveData,
        options: { examMapping, courseworkDecisions: decisions },
      })
      // 取り込み警告（点数スキップ・参照先未検出など）があれば通知する。
      // 自動で消えると見落とすため手動で閉じるまで表示し、全件を本文に載せる。
      if (importResult.warnings.length > 0) {
        toast.warning(
          `インポートは完了しましたが ${importResult.warnings.length} 件の警告があります`,
          {
            description: importResult.warnings.join("\n"),
            duration: Infinity,
            closeButton: true,
          }
        )
      }
      router.push(`/grades/${importResult.gradeId}`)
    } finally {
      setImportPreview(null)
      setImportArchiveData(null)
    }
  }

  const handleImportCancel = () => {
    setImportPreview(null)
    setImportArchiveData(null)
  }

  // 一覧に出現する学級を集約してフィルタ選択肢にする
  const classroomOptions = useMemo(
    () =>
      collectClassroomOptions(grades, (grade) =>
        grade.gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroom)
      ),
    [grades]
  )

  const {
    filteredItems: filteredGrades,
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
    updatedFrom,
    setUpdatedFrom,
    updatedTo,
    setUpdatedTo,
  } = useListFilter(grades, GRADE_FILTER_ACCESSORS)

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(filteredGrades)

  /** 選んだ成績算出へ、既存のタグを保ったまま同じタグを足す */
  const handleBulkAddTag = useCallback(
    async (tagName: string) => {
      if (selectedIds.size === 0) return
      const tag = await findOrCreateTag.mutateAsync(tagName)
      await addTagToGrades.mutateAsync({
        gradeIds: [...selectedIds],
        tagId: tag.id,
      })
      toast.success("タグを追加しました", {
        description: `${selectedIds.size}件の成績算出に「${tagName}」を追加`,
      })
      clearSelection()
      await queryClient.invalidateQueries({
        queryKey: tagListQuery().queryKey,
      })
    },
    [addTagToGrades, clearSelection, findOrCreateTag, queryClient, selectedIds]
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

  const classroomFilterConfig = useMemo(
    () => ({
      options: classroomOptions,
      selectedIds: filterClassroomIds,
      onToggle: toggleClassroomId,
      onClear: clearClassroomIds,
    }),
    [classroomOptions, filterClassroomIds, toggleClassroomId, clearClassroomIds]
  )

  const actions = useMemo<ToolbarAction[]>(() => {
    const toolbarActions: ToolbarAction[] = [
      {
        id: "create",
        priority: 80,
        node: (
          <Button
            onClick={() => void handleCreate()}
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
            onClick={() => void handleCreate()}
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
            .grade 読み込み
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
            .grade 読み込み
          </Button>
        ),
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
  }, [allTags, handleBulkAddTag, handleCreate, handleImport, selectedIds])

  return (
    <>
      <EntityListPage<GradeSummary>
        title="成績算出"
        helpButton={helpButton}
        rows={filteredGrades}
        totalCount={grades.length}
        isLoading={isLoading}
        name={(grade) => grade.name}
        summary={(grade) => {
          const classroomNames = grade.gradeClassrooms
            .map((gradeClassroom) => gradeClassroom.classroom.name)
            .join("、")
          return (
            <span className="flex flex-wrap items-center gap-1">
              {grade.gradeTags.map((gradeTag) => (
                <Badge
                  key={gradeTag.tag.id}
                  variant="outline"
                  className="text-xs font-normal"
                  style={
                    gradeTag.tag.color
                      ? {
                          borderColor: gradeTag.tag.color,
                          color: gradeTag.tag.color,
                        }
                      : undefined
                  }
                >
                  {gradeTag.tag.name}
                </Badge>
              ))}
              <span>
                {classroomNames || "学級未登録"}
                {" / 生徒: "}
                {grade.gradeStudents.length}名 / 評価項目:{" "}
                {grade.gradeItems.length}
              </span>
            </span>
          )
        }}
        dateLabel="成績算出日"
        referenceDate={(grade) => grade.referenceDate}
        updatedAt={(grade) => grade.updatedAt}
        overviewUrl={(grade) => `/grades/${grade.id}`}
        nextStep={(grade) => {
          const status = getGradeStatus(grade)
          return { label: status.text, url: status.url }
        }}
        rowMenu={(grade) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`${grade.name}の操作`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDuplicate(grade.id)}>
                <Copy className="mr-2 h-4 w-4" />
                複製
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportArchive.mutate(grade.id)}>
                <FolderOutput className="mr-2 h-4 w-4" />
                .grade 書き出し
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(grade.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        actions={actions}
        search={{
          term: searchTerm,
          onChange: setSearchTerm,
          placeholder: "成績算出名・タグ・学級で検索",
        }}
        tagFilter={tagFilterConfig}
        classroomFilter={classroomFilterConfig}
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
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        allSelected={allSelected}
        empty={{
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

      <GradeImportDialog
        open={importPreview !== null}
        preview={importPreview}
        importing={executeImport.isPending}
        onCancel={handleImportCancel}
        onConfirm={handleImportConfirm}
      />
    </>
  )
}
