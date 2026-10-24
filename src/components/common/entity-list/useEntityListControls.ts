import { useCallback, useMemo } from "react"
import { toast } from "sonner"

import { bulkTagToolbarAction } from "@/components/common/BulkTagAssignButton"
import type { MultiSelectFilterConfig } from "@/components/common/ListFilterControls"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"

import { pruneSelectedIds } from "./entityListSelection"
import type { EntityListControlProps } from "./types"

/**
 * 選んだ行へタグを足す書き込み。タグ名は前後の空白を落とした後のもの。
 * 失敗は投げる（`mutateAsync` をそのまま await すればよい）
 */
type AssignTagToRows = (tagName: string, rowIds: string[]) => Promise<void>

interface UseEntityListControlsOptions<TRow> {
  /** 行1件を何と呼ぶか（「試験」「資料」など。一括操作のトーストに出す） */
  rowNoun: string
  /** 検索欄の placeholder（「試験名・タグで検索」など、何を見ているかを言う） */
  searchPlaceholder: string
  /** タグ絞り込みの選択肢。一括タグ付けの候補にも同じものを出す */
  tagOptions: MultiSelectFilterConfig["options"]
  /**
   * 選んだ行へタグを足す書き込み（実体ごとに書き込み先が違う）。
   * 依存配列に入るので、呼び手は `useCallback` で参照を安定させること
   */
  assignTag: AssignTagToRows
  /** 学級絞り込みの選択肢。学級を持たない画面は渡さない（絞り込みごと出さない） */
  classroomOptions?: MultiSelectFilterConfig["options"]
  /**
   * 選べる行か。渡すと、全選択と「全部選んだか」の判定がこの行だけを相手にし、
   * 選択もこの行に限る（選んだ後に選べなくなった行は選択から落ちる）。
   * 依存配列に入るので、呼び手は `useCallback` で参照を安定させること
   */
  isSelectable?: (row: TRow) => boolean
}

/**
 * `EntityListPage` の絞り込みと選択をまとめて持つ。
 *
 * 4つの一覧（試験 / 試験外成績資料 / 成績算出 / 解答用紙）はどれも `useListFilter` と
 * `useRowSelection` を持ち、その値を `EntityListPage` の props へ1つずつ詰め直して
 * いた。詰め直しをここへ寄せ、呼び手は `listProps` を広げて渡すだけにする。
 *
 * `accessors` は `useListFilter` の依存配列に入るので、モジュールレベルの定数で渡す。
 */
export function useEntityListControls<TRow extends { id: string }>(
  rows: TRow[],
  accessors: ListFilterAccessors<TRow>,
  {
    rowNoun,
    searchPlaceholder,
    tagOptions,
    assignTag,
    classroomOptions,
    isSelectable,
  }: UseEntityListControlsOptions<TRow>
) {
  const {
    filteredItems: filteredRows,
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
  } = useListFilter(rows, accessors)

  const selectableRows = useMemo(
    () => (isSelectable ? filteredRows.filter(isSelectable) : filteredRows),
    [filteredRows, isSelectable]
  )

  const {
    selectedIds: storedSelectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(selectableRows)

  /**
   * 選択は**今ある行のうち選べるもの**に限る。絞り込みで隠れた行は選択に残す
   * （一括操作は「選択した全部」に効く）が、消えた行と選べなくなった行は落とす
   */
  const allSelectableRows = useMemo(
    () => (isSelectable ? rows.filter(isSelectable) : rows),
    [rows, isSelectable]
  )
  const selectedIds = useMemo(
    () => pruneSelectedIds(storedSelectedIds, allSelectableRows),
    [storedSelectedIds, allSelectableRows]
  )

  /**
   * 選択した全部へタグを足す。4つの一覧で同じ手順:
   *
   * - タグ名は前後の空白を落とし、空なら何もしない
   * - 失敗の通知は書き込みの宣言（`meta.errorMessage`）を見て `MutationCache` が出す。
   *   ここでは受け止めるだけにする（出すと二重になる。投げたままにすると拒否が漏れる）
   * - 成功したら件数を知らせ、選択を解く
   */
  const addTagToSelection = useCallback(
    async (tagName: string) => {
      const trimmedTagName = tagName.trim()
      if (!trimmedTagName || selectedIds.size === 0) return
      const rowIds = [...selectedIds]
      try {
        await assignTag(trimmedTagName, rowIds)
      } catch {
        return
      }
      toast.success("タグを付けました", {
        description: `${rowIds.length}件の${rowNoun}に「${trimmedTagName}」を付けました`,
      })
      clearSelection()
    },
    [selectedIds, assignTag, clearSelection, rowNoun]
  )

  /**
   * ヘッダー右の「タグ追加」。選択中だけ現れる。並びの中での優先度は4画面とも 60
   * （読み込みの 70 より先に畳む）。並びのどこに置くかは呼び手が決める
   */
  const bulkTagAction = useMemo<ToolbarAction | null>(
    () =>
      selectedIds.size > 0
        ? bulkTagToolbarAction({
            priority: 60,
            selectedCount: selectedIds.size,
            allTags: tagOptions,
            onAssign: addTagToSelection,
          })
        : null,
    [selectedIds.size, tagOptions, addTagToSelection]
  )

  const tagFilter = useMemo<MultiSelectFilterConfig>(
    () => ({
      options: tagOptions,
      selectedIds: filterTagIds,
      onToggle: toggleTagId,
      onClear: clearTagIds,
    }),
    [tagOptions, filterTagIds, toggleTagId, clearTagIds]
  )

  const classroomFilter = useMemo<MultiSelectFilterConfig | undefined>(
    () =>
      classroomOptions && {
        options: classroomOptions,
        selectedIds: filterClassroomIds,
        onToggle: toggleClassroomId,
        onClear: clearClassroomIds,
      },
    [classroomOptions, filterClassroomIds, toggleClassroomId, clearClassroomIds]
  )

  const listProps: EntityListControlProps<TRow> = {
    rows: filteredRows,
    search: {
      term: searchTerm,
      onChange: setSearchTerm,
      placeholder: searchPlaceholder,
    },
    tagFilter,
    classroomFilter,
    dateFilter: {
      from: dateFrom,
      to: dateTo,
      onFromChange: setDateFrom,
      onToChange: setDateTo,
    },
    updatedAtFilter: {
      from: updatedFrom,
      to: updatedTo,
      onFromChange: setUpdatedFrom,
      onToChange: setUpdatedTo,
    },
    selectedIds,
    onToggleSelect: toggleSelect,
    onToggleSelectAll: toggleSelectAll,
    allSelected,
  }

  return {
    /** 選択（今ある行のうち選べるものだけ。絞り込みで隠れた行も含む） */
    selectedIds,
    /** ヘッダー右の「タグ追加」。何も選んでいないときは null */
    bulkTagAction,
    /** `EntityListPage` へそのまま広げて渡す */
    listProps,
  }
}
