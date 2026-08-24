import { useCallback, useMemo, useState } from "react"

/**
 * 一覧フィルタ（検索・タグ・学級・日付範囲）の適用ロジック。
 *
 * 各画面のアイテム型は異なるため、フィルタ対象値の取り出しは `accessors` で注入する。
 * 使う次元だけ accessor を渡せばよい（未指定の次元はフィルタ UI・判定ともに無効）。
 *
 * `accessors` は依存配列に含まれるため、呼び出し側ではモジュールレベル定数か
 * `useMemo` で参照を安定させること。
 */
export interface ListFilterAccessors<T> {
  /** 検索テキストの対象となる文字列群（名前・説明・タグ名など） */
  searchTexts: (listItem: T) => (string | null | undefined)[]
  /** タグフィルタ用のタグ ID 群 */
  tagIds?: (listItem: T) => string[]
  /** 学級フィルタ用の学級 ID 群 */
  classroomIds?: (listItem: T) => string[]
  /**
   * 日付範囲フィルタ用の日付（未設定は null）。
   *
   * DB 由来の行はそのまま `Date` で渡ってくる（IPC の structured clone は Date を
   * そのまま通す）。フォームや設定由来の ISO 文字列も受けるので、実装に合わせて
   * 両方を許す（下の絞り込みは `new Date(...)` でどちらも扱える）。
   */
  date?: (listItem: T) => string | Date | null
  /**
   * 更新日時の範囲フィルタ用の値。`date` と別に持つのは、一覧が日付列を2つ
   * （実施日と更新日時）出しており、**列見出しごとに絞れる**ようにするため。
   */
  updatedAt?: (listItem: T) => string | Date | null
}

interface UseListFilterResult<T> {
  filteredItems: T[]
  searchTerm: string
  setSearchTerm: (value: string) => void
  filterTagIds: Set<string>
  toggleTagId: (tagId: string, checked: boolean) => void
  clearTagIds: () => void
  filterClassroomIds: Set<string>
  toggleClassroomId: (classroomId: string, checked: boolean) => void
  clearClassroomIds: () => void
  /** 日付範囲の下端（YYYY-MM-DD、空文字は未指定） */
  dateFrom: string
  setDateFrom: (value: string) => void
  /** 日付範囲の上端（YYYY-MM-DD、空文字は未指定） */
  dateTo: string
  setDateTo: (value: string) => void
  /** 更新日時の下端（YYYY-MM-DD、空文字は未指定） */
  updatedFrom: string
  setUpdatedFrom: (value: string) => void
  /** 更新日時の上端（YYYY-MM-DD、空文字は未指定） */
  updatedTo: string
  setUpdatedTo: (value: string) => void
}

/**
 * ローカル日の `YYYY-MM-DD`。
 *
 * 一覧の日付列は `toLocaleDateString` で描いているので、絞り込みも同じローカル日で
 * 比べる（UTC で切ると、画面に出ている日と1日ずれる行が出る）。
 */
function toLocalDay(date: string | Date): string {
  const localDate = new Date(date)
  return `${localDate.getFullYear()}-${String(
    localDate.getMonth() + 1
  ).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`
}

/** 日付が範囲に入っているか。**未設定の行は範囲を指定した時点で外れる** */
function isWithinDayRange(
  date: string | Date | null,
  from: string,
  to: string
): boolean {
  if (date === null) return false
  const day = toLocalDay(date)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

export function useListFilter<T>(
  items: T[],
  accessors: ListFilterAccessors<T>
): UseListFilterResult<T> {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set())
  const [filterClassroomIds, setFilterClassroomIds] = useState<Set<string>>(
    new Set()
  )
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [updatedFrom, setUpdatedFrom] = useState("")
  const [updatedTo, setUpdatedTo] = useState("")

  const toggleTagId = useCallback((tagId: string, checked: boolean) => {
    setFilterTagIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(tagId)
      } else {
        next.delete(tagId)
      }
      return next
    })
  }, [])

  const clearTagIds = useCallback(() => setFilterTagIds(new Set()), [])

  const toggleClassroomId = useCallback(
    (classroomId: string, checked: boolean) => {
      setFilterClassroomIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          next.add(classroomId)
        } else {
          next.delete(classroomId)
        }
        return next
      })
    },
    []
  )

  const clearClassroomIds = useCallback(
    () => setFilterClassroomIds(new Set()),
    []
  )

  const filteredItems = useMemo(() => {
    return items.filter((listItem) => {
      // テキスト検索（対象文字列のいずれかに部分一致）
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase()
        const hit = accessors
          .searchTexts(listItem)
          .some((text) => text?.toLowerCase().includes(term))
        if (!hit) return false
      }
      // タグフィルタ（選択タグのいずれかを持つ = OR）
      if (accessors.tagIds && filterTagIds.size > 0) {
        const ids = new Set(accessors.tagIds(listItem))
        const hasMatch = [...filterTagIds].some((tagId) => ids.has(tagId))
        if (!hasMatch) return false
      }
      // 学級フィルタ（選択学級のいずれかを持つ = OR）
      if (accessors.classroomIds && filterClassroomIds.size > 0) {
        const ids = new Set(accessors.classroomIds(listItem))
        const hasMatch = [...filterClassroomIds].some((classroomId) =>
          ids.has(classroomId)
        )
        if (!hasMatch) return false
      }
      // 日付範囲フィルタ（実施日など、画面が持つ日付の列）
      if (accessors.date && (dateFrom || dateTo)) {
        if (!isWithinDayRange(accessors.date(listItem), dateFrom, dateTo)) {
          return false
        }
      }
      // 更新日時の範囲フィルタ
      if (accessors.updatedAt && (updatedFrom || updatedTo)) {
        if (
          !isWithinDayRange(
            accessors.updatedAt(listItem),
            updatedFrom,
            updatedTo
          )
        ) {
          return false
        }
      }
      return true
    })
  }, [
    items,
    accessors,
    searchTerm,
    filterTagIds,
    filterClassroomIds,
    dateFrom,
    dateTo,
    updatedFrom,
    updatedTo,
  ])

  return {
    filteredItems,
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
  }
}
