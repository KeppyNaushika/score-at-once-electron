import { useCallback, useState } from "react"

/**
 * テーブル行のチェックボックス選択を管理する汎用フック。
 *
 * `visibleRows` は現在表示中（フィルタ・ソート適用後）の行。全選択判定と
 * 全選択トグルはこの範囲に対して行うため、フィルタで隠れた行は巻き込まない。
 */
export function useRowSelection<Row extends { id: string }>(
  visibleRows: Row[]
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const row of visibleRows) {
          if (checked) next.add(row.id)
          else next.delete(row.id)
        }
        return next
      })
    },
    [visibleRows]
  )

  const allSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row) => selectedIds.has(row.id))

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  return {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  }
}
