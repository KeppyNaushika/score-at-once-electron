"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

export type SortDirection = "asc" | "desc" | null

export interface SortConfig<T> {
  key: keyof T | null
  direction: SortDirection
}

interface UseTableSortOptions<T> {
  defaultSort?: SortConfig<T>
  /** localStorageに保存するキー（指定すると永続化される） */
  storageKey?: string
}

/**
 * localStorageからソート設定を読み込む
 */
function loadSortConfig<T>(storageKey: string): SortConfig<T> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        parsed &&
        typeof parsed === "object" &&
        "key" in parsed &&
        "direction" in parsed
      ) {
        return parsed as SortConfig<T>
      }
    }
  } catch {
    // パースエラーは無視
  }
  return null
}

/**
 * localStorageにソート設定を保存
 */
function saveSortConfig<T>(storageKey: string, config: SortConfig<T>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(storageKey, JSON.stringify(config))
  } catch {
    // 保存エラーは無視
  }
}

/**
 * テーブルのソート機能を提供するカスタムフック
 * @param data ソート対象のデータ配列
 * @param options オプション設定
 * @returns ソート済みデータ、ソート設定、ソートリクエスト関数
 */
export function useTableSort<T extends object>(
  data: T[],
  options?: UseTableSortOptions<T>
) {
  // 初期値の決定: localStorage > defaultSort > null
  const getInitialConfig = (): SortConfig<T> => {
    if (options?.storageKey) {
      const stored = loadSortConfig<T>(options.storageKey)
      if (stored) return stored
    }
    return options?.defaultSort || { key: null, direction: null }
  }

  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(getInitialConfig)

  // localStorageへの保存
  useEffect(() => {
    if (options?.storageKey) {
      saveSortConfig(options.storageKey, sortConfig)
    }
  }, [sortConfig, options?.storageKey])

  const sortedData = useMemo((): T[] => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    const key = sortConfig.key
    return [...data].sort((a, b) => {
      const aVal = a[key] as unknown
      const bVal = b[key] as unknown

      // null/undefined の処理
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortConfig.direction === "asc" ? 1 : -1
      if (bVal == null) return sortConfig.direction === "asc" ? -1 : 1

      let comparison = 0

      // 型に応じた比較
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime()
      } else if (
        typeof aVal === "string" &&
        typeof bVal === "string" &&
        isDateString(aVal) &&
        isDateString(bVal)
      ) {
        // 日付文字列の比較
        comparison = new Date(aVal).getTime() - new Date(bVal).getTime()
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        // 日本語対応の文字列比較
        comparison = aVal.localeCompare(bVal, "ja")
      } else {
        // その他の型はtoStringして比較
        comparison = String(aVal).localeCompare(String(bVal), "ja")
      }

      return sortConfig.direction === "asc" ? comparison : -comparison
    })
  }, [data, sortConfig])

  const requestSort = useCallback((key: keyof T) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        // 新しいキーの場合は昇順から開始
        return { key, direction: "asc" }
      }

      // 同じキーの場合は null -> asc -> desc -> null のサイクル
      if (prev.direction === null) {
        return { key, direction: "asc" }
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" }
      }
      return { key: null, direction: null }
    })
  }, [])

  /**
   * ソート設定を直接指定する
   */
  const setSort = useCallback((key: keyof T, direction: SortDirection) => {
    setSortConfig({ key, direction })
  }, [])

  return {
    sortedData,
    sortConfig,
    requestSort,
    setSort,
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
