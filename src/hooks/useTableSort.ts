"use client"

import { useCallback, useMemo, useState } from "react"

import { useLocalStorageText } from "@/hooks/useLocalStorageText"

export type SortDirection = "asc" | "desc" | null

/**
 * 並び順の指定。保存から復元することがあり、そのときの列名は素の文字列でしか名乗れないので
 * `key` は `string`（呼び手が渡す既定値と `requestSort` の引数は列名で縛る）
 */
interface TableSort {
  key: string | null
  direction: SortDirection
}

interface UseTableSortOptions<T> {
  defaultSort?: { key: (keyof T & string) | null; direction: SortDirection }
  /** localStorageに保存するキー（指定すると永続化される） */
  storageKey?: string
  /**
   * 並べ替えに使える列。渡すと、**これに無い列名で保存された並び順は捨てて既定へ戻る。**
   *
   * 保存は列名の文字列なので、列を消したり改名したりすると、既存の利用者の
   * localStorage にだけ古い名前が残る。`Reflect.get` はそれを `undefined` として
   * 読むため比較が常に 0 になり、**一度見出しを押すまで並ばない**一覧になる
   * （実例: 試験一覧の `examList-sort` に残った `"examDate"`。列は `referenceDate` へ
   * 改名済みだった）。読むときに照合すれば、消えた列名は次に押した時点で上書きされる。
   */
  sortableKeys?: readonly (keyof T & string)[]
}

/**
 * 保存された並び順を読む。壊れていれば「保存が無い」とみなす
 */
function parseTableSort(storedText: string | null): TableSort | null {
  if (storedText === null) return null
  try {
    const parsed: unknown = JSON.parse(storedText)
    if (parsed === null || typeof parsed !== "object") return null
    if (!("key" in parsed) || !("direction" in parsed)) return null

    const storedKey = parsed.key
    const storedDirection = parsed.direction
    if (storedKey !== null && typeof storedKey !== "string") return null
    if (
      storedDirection !== null &&
      storedDirection !== "asc" &&
      storedDirection !== "desc"
    ) {
      return null
    }
    return { key: storedKey, direction: storedDirection }
  } catch {
    // パースエラーは無視
    return null
  }
}

/**
 * 同じ列を押したときは null -> asc -> desc -> null のサイクル、別の列なら昇順から
 */
function nextTableSort(currentSort: TableSort, key: string): TableSort {
  if (currentSort.key !== key) return { key, direction: "asc" }
  if (currentSort.direction === null) return { key, direction: "asc" }
  if (currentSort.direction === "asc") return { key, direction: "desc" }
  return { key: null, direction: null }
}

/**
 * テーブルのソート機能を提供するカスタムフック
 *
 * `storageKey` を渡したときは localStorage が唯一の出所（購読するので、同じキーを見ている
 * 別の画面とも揃う）。事前描画では localStorage を読めないため、マウントするまでは
 * `defaultSort` で描き、読めた時点で保存された並び順へ差し替わる。
 *
 * @param data ソート対象のデータ配列
 * @param options オプション設定
 * @returns ソート済みデータ、ソート設定、ソートリクエスト関数
 */
export function useTableSort<T extends object>(
  data: T[],
  options?: UseTableSortOptions<T>
) {
  const storageKey = options?.storageKey ?? null
  const defaultSortKey = options?.defaultSort?.key ?? null
  const defaultSortDirection = options?.defaultSort?.direction ?? null
  const sortableKeys = options?.sortableKeys

  const { storedText, setStoredText } = useLocalStorageText(storageKey)
  // 永続化しないときの置き場。永続化するときは触らない（出所を2つにしない）
  const [chosenSort, setChosenSort] = useState<TableSort | null>(null)

  const storedSort = useMemo(() => {
    const parsedSort = parseTableSort(storedText)
    if (parsedSort === null) return null
    // 今は無い列名で保存されていたら「保存が無い」とみなす（既定の並びへ戻す）
    if (
      sortableKeys !== undefined &&
      parsedSort.key !== null &&
      !sortableKeys.some((sortableKey) => sortableKey === parsedSort.key)
    ) {
      return null
    }
    return parsedSort
  }, [storedText, sortableKeys])
  const activeSort = storageKey !== null ? storedSort : chosenSort

  const sortKey = activeSort ? activeSort.key : defaultSortKey
  const sortDirection = activeSort ? activeSort.direction : defaultSortDirection
  const sortConfig = useMemo(
    () => ({ key: sortKey, direction: sortDirection }),
    [sortKey, sortDirection]
  )

  const sortedData = useMemo((): T[] => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    const key = sortConfig.key
    return [...data].sort((leftRow, rightRow) => {
      const leftCell: unknown = Reflect.get(leftRow, key)
      const rightCell: unknown = Reflect.get(rightRow, key)

      // null/undefined の処理
      if (leftCell == null && rightCell == null) return 0
      if (leftCell == null) return sortConfig.direction === "asc" ? 1 : -1
      if (rightCell == null) return sortConfig.direction === "asc" ? -1 : 1

      let comparison: number

      // 型に応じた比較
      if (typeof leftCell === "number" && typeof rightCell === "number") {
        comparison = leftCell - rightCell
      } else if (leftCell instanceof Date && rightCell instanceof Date) {
        comparison = leftCell.getTime() - rightCell.getTime()
      } else if (
        typeof leftCell === "string" &&
        typeof rightCell === "string" &&
        isDateString(leftCell) &&
        isDateString(rightCell)
      ) {
        // 日付文字列の比較
        comparison =
          new Date(leftCell).getTime() - new Date(rightCell).getTime()
      } else if (
        typeof leftCell === "string" &&
        typeof rightCell === "string"
      ) {
        // 日本語対応の文字列比較
        comparison = leftCell.localeCompare(rightCell, "ja")
      } else {
        // その他の型はtoStringして比較
        comparison = String(leftCell).localeCompare(String(rightCell), "ja")
      }

      return sortConfig.direction === "asc" ? comparison : -comparison
    })
  }, [data, sortConfig])

  const requestSort = useCallback(
    (key: keyof T & string) => {
      const nextSort = nextTableSort(sortConfig, key)
      if (storageKey !== null) {
        setStoredText(JSON.stringify(nextSort))
        return
      }
      setChosenSort(nextSort)
    },
    [setStoredText, sortConfig, storageKey]
  )

  return {
    sortedData,
    sortConfig,
    requestSort,
  }
}

/**
 * 文字列が日付形式かどうかを判定
 */
function isDateString(value: string): boolean {
  // YYYY-MM-DD または YYYY/MM/DD 形式をチェック
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/
  if (!datePattern.test(value)) return false

  const date = new Date(value)
  return !isNaN(date.getTime())
}
