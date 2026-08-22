"use client"

import type { ReactNode } from "react"

import type {
  DateRangeFilterConfig,
  MultiSelectFilterConfig,
} from "@/components/common/ListFilterControls"
import {
  ClassroomFilterButton,
  DateRangeFilterButton,
  ListSearchInput,
  TagFilterButton,
} from "@/components/common/ListFilterControls"

interface ListFilterBarProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  searchPlaceholder: string
  totalCount: number
  filteredCount: number
  tagFilter?: MultiSelectFilterConfig
  classroomFilter?: MultiSelectFilterConfig
  dateRangeFilter?: DateRangeFilterConfig
  /** 左側に差し込む画面固有の要素（一括タグ付与ボタン等） */
  leading?: ReactNode
}

/**
 * 一覧共通のフィルタバー（検索・タグ・学級・日付範囲・件数表示）。
 *
 * **トップページ4画面はここを使わない。** あちらは `EntityListPage` のヘッダーへ
 * 移り、同じ部品（`ListFilterControls`）を溢れたら畳む並びに載せている。ここに
 * 残っているのは、段のある画面や小計点グループなど「1行のヘッダーへ移していない」側。
 */
export function ListFilterBar({
  searchTerm,
  onSearchTermChange,
  searchPlaceholder,
  totalCount,
  filteredCount,
  tagFilter,
  classroomFilter,
  dateRangeFilter,
  leading,
}: ListFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
          placeholder={searchPlaceholder}
        />
        {tagFilter && <TagFilterButton config={tagFilter} />}
        {classroomFilter && <ClassroomFilterButton config={classroomFilter} />}
        {dateRangeFilter && <DateRangeFilterButton config={dateRangeFilter} />}
        <span className="text-xs text-muted-foreground">
          {filteredCount === totalCount
            ? `${totalCount}件`
            : `${filteredCount} / ${totalCount}件`}
        </span>
      </div>
    </div>
  )
}
