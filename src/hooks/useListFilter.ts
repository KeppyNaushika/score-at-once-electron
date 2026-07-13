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
  /** 日付範囲フィルタ用の日付（ISO 文字列、未設定は null） */
  date?: (listItem: T) => string | null
}

export interface UseListFilterResult<T> {
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
      // 日付範囲フィルタ（表示(toLocaleDateString)と一致させるためローカル日で比較）
      if (accessors.date && (dateFrom || dateTo)) {
        const isoDate = accessors.date(listItem)
        if (!isoDate) return false
        const localDate = new Date(isoDate)
        const day = `${localDate.getFullYear()}-${String(
          localDate.getMonth() + 1
        ).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`
        if (dateFrom && day < dateFrom) return false
        if (dateTo && day > dateTo) return false
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
  }
}
