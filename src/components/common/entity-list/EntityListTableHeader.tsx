import {
  ColumnDivider,
  FilterableTableHead,
} from "@/components/common/FilterableTableHead"
import type { MultiSelectFilterConfig } from "@/components/common/ListFilterControls"
import {
  DateRangeFilterPanel,
  ListSearchInput,
  MultiSelectFilterPanel,
} from "@/components/common/ListFilterControls"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SortDirection } from "@/hooks/useTableSort"

import type {
  EntityListDateFilter,
  EntityListSearch,
  EntityListSortKey,
} from "./types"

interface EntityListTableHeaderProps {
  allSelected: boolean
  onToggleSelectAll: (checked: boolean) => void
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (
    sortKey: EntityListSortKey,
    direction: Exclude<SortDirection, null>
  ) => void
  search: EntityListSearch
  tagFilter?: MultiSelectFilterConfig
  classroomFilter?: MultiSelectFilterConfig
  dateLabel: string
  dateFilter: EntityListDateFilter
  updatedAtFilter: EntityListDateFilter
}

/**
 * 一覧の見出し行。絞り込みは**列見出しの中**にあり、並べ替えも同じ popover へ
 * 入れてある（`FilterableTableHead`）。
 */
export function EntityListTableHeader({
  allSelected,
  onToggleSelectAll,
  currentSortKey,
  currentDirection,
  onSort,
  search,
  tagFilter,
  classroomFilter,
  dateLabel,
  dateFilter,
  updatedAtFilter,
}: EntityListTableHeaderProps) {
  const isNameFiltered =
    search.term !== "" ||
    (tagFilter?.selectedIds.size ?? 0) > 0 ||
    (classroomFilter?.selectedIds.size ?? 0) > 0
  const isDateFiltered = dateFilter.from !== "" || dateFilter.to !== ""
  const isUpdatedAtFiltered =
    updatedAtFilter.from !== "" || updatedAtFilter.to !== ""

  return (
    <TableHeader className="sticky top-0 z-10 bg-card">
      <TableRow className="hover:bg-transparent">
        <TableHead className="w-10 text-center">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
            aria-label="全選択"
          />
        </TableHead>
        <FilterableTableHead
          label="名前"
          sortKey="name"
          currentSortKey={currentSortKey}
          currentDirection={currentDirection}
          onSort={onSort}
          isFiltered={isNameFiltered}
          showDivider={false}
        >
          <div className="space-y-2">
            <ListSearchInput
              searchTerm={search.term}
              onSearchTermChange={search.onChange}
              placeholder={search.placeholder}
              className="w-full"
            />
            {tagFilter && tagFilter.options.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="px-1 pb-1 text-xs text-muted-foreground">
                    タグ
                  </p>
                  <MultiSelectFilterPanel
                    config={tagFilter}
                    clearLabel="タグの選択を消す"
                  />
                </div>
              </>
            )}
            {classroomFilter && classroomFilter.options.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="px-1 pb-1 text-xs text-muted-foreground">
                    学級
                  </p>
                  <MultiSelectFilterPanel
                    config={classroomFilter}
                    clearLabel="学級の選択を消す"
                  />
                </div>
              </>
            )}
          </div>
        </FilterableTableHead>
        <FilterableTableHead
          label={dateLabel}
          sortKey="referenceDate"
          currentSortKey={currentSortKey}
          currentDirection={currentDirection}
          onSort={onSort}
          isFiltered={isDateFiltered}
          className="w-36"
        >
          <DateRangeFilterPanel config={{ label: dateLabel, ...dateFilter }} />
        </FilterableTableHead>
        <FilterableTableHead
          label="更新日時"
          sortKey="updatedAt"
          currentSortKey={currentSortKey}
          currentDirection={currentDirection}
          onSort={onSort}
          isFiltered={isUpdatedAtFiltered}
          className="w-40"
        >
          <DateRangeFilterPanel
            config={{ label: "更新日", ...updatedAtFilter }}
          />
        </FilterableTableHead>
        {/*
          絞り込みを持たない列。見出しに印は出さないが、列の区切り線は
          他の列と同じように引く
        */}
        <TableHead className="w-52 p-0 text-center">
          <div className="flex h-12 items-center">
            <ColumnDivider />
            <span className="flex-1 px-4">次のステップ</span>
          </div>
        </TableHead>
        <TableHead className="w-12 p-0">
          <div className="flex h-12 items-center">
            <ColumnDivider />
          </div>
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}
