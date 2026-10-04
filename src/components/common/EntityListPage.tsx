"use client"

import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useMemo } from "react"

import type { MultiSelectFilterConfig } from "@/components/common/ListFilterControls"
import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { useListPagination } from "@/hooks/useListPagination"
import { useTableSort } from "@/hooks/useTableSort"

import { EntityListRow } from "./entity-list/EntityListRow"
import { EntityListTableHeader } from "./entity-list/EntityListTableHeader"
import type {
  EntityListDate,
  EntityListDateFilter,
  EntityListNextStep,
  EntityListSearch,
  SortableEntityRow,
} from "./entity-list/types"

/** 1件も無いときに出すもの */
interface EntityListEmptyState {
  /** 本文の上に出すアイコン。サイドバーでその一覧に付けているものを渡す */
  icon: LucideIcon
  /** 本文（「まだ試験がありません」など） */
  message: string
  /** 作成へ導く導線。無くてもよい */
  action?: ReactNode
}

interface EntityListPageProps<TRow extends { id: string }> {
  /** ヘッダーに出す画面の題（「試験一覧」「解答用紙作成」など） */
  title: string
  /** 絞り込み済みの行（並べ替えとページ分けは部品の中でやる） */
  rows: TRow[]
  /**
   * 絞り込む前の総数。`rows` が空でも「1件も無い」と「条件に一致しない」を
   * 分けて言えるようにするために要る
   */
  totalCount: number
  isLoading: boolean
  /** 名前セルの1行目。並べ替えの値も兼ねる */
  name: (row: TRow) => string
  /** 名前セルの2行目。画面ごとに変わるのはここだけ */
  summary: (row: TRow) => ReactNode
  /** 日付列の見出しの語（試験日 / 実施日 / 成績算出日 / …） */
  dateLabel: string
  /**
   * 日付列の値。
   *
   * **これは一時的な形。** DB の列名は4実体とも `referenceDate` へ揃ったので、型条件
   * （`TRow extends { referenceDate: EntityListDate; updatedAt: EntityListDate }`）へ
   * 畳んで、`referenceDate` と `updatedAt` の関数2つを消せる。
   * 解答用紙だけは IPC が ISO 文字列で返すため、畳むときも `EntityListDate` は要る。
   */
  referenceDate: (row: TRow) => EntityListDate
  /** 更新日時列の値。上と同じ理由で一時的に関数で受ける */
  updatedAt: (row: TRow) => EntityListDate
  /** 行を押したときの飛び先（概要ページ） */
  overviewUrl: (row: TRow) => string
  nextStep: (row: TRow) => EntityListNextStep
  /** 行末の「…」の中身。呼び手が DropdownMenu ごと渡す */
  rowMenu: (row: TRow) => ReactNode
  /** ヘッダー右の並び。溢れは「…」へ畳む */
  actions: ToolbarAction[]
  /** 名前列の popover に入る横断検索 */
  search: EntityListSearch
  /** 名前列の popover に入るタグ絞り込み */
  tagFilter?: MultiSelectFilterConfig
  /** 名前列の popover に入る学級絞り込み。学級を持たない画面は渡さない */
  classroomFilter?: MultiSelectFilterConfig
  /** 日付列の絞り込み */
  dateFilter: EntityListDateFilter
  /** 更新日時列の絞り込み */
  updatedAtFilter: EntityListDateFilter
  /**
   * 選択の状態。**呼び手が持つ**（ヘッダーの一括操作が選択を読むため）。
   * 並べ替えとページ分けは行の集合を変えないので、呼び手は絞り込み済みの行に対して
   * `useRowSelection` を持てばよい
   */
  selectedIds: Set<string>
  /**
   * その行を選べない理由。返したら選択を止め、理由を `title` に出す。
   *
   * **選ばせてから弾くのでは伝わらない。** 解答用紙の一括タグ付けは担当でない行を
   * main が弾くが、一括の書き込みは「既に付いている」を飛ばすために失敗を握り潰すので、
   * 弾かれたことが利用者へ届かない。押す前に
   * 選べなくしておく。他の3画面は行の持ち主で分かれないので渡さない
   */
  selectionDisabledReason?: (row: TRow) => string | undefined
  onToggleSelect: (rowId: string, checked: boolean) => void
  onToggleSelectAll: (checked: boolean) => void
  allSelected: boolean
  empty: EntityListEmptyState
  /** 絞り込みで0件になったときの文言（「条件に一致する試験がありません」など） */
  noMatchMessage: string
  /** 並び順の保存キー（画面ごとに別。localStorage） */
  sortStorageKey: string
}

/** 列は6つで固定なので、空・読み込みの行が跨ぐ数もここで決まる */
const COLUMN_COUNT = 6

/**
 * 並べ替えに使える列。**保存された並び順の照合にも使う。**
 *
 * 一覧は列名を localStorage に持つので、画面を作り直すと古い列名だけが残る
 * （試験一覧の `examList-sort` には、改名前の `"examDate"` が残っている）。
 * `useTableSort` はここに無い列名を「保存が無い」とみなして既定へ戻す。
 */
const SORTABLE_KEYS = ["name", "referenceDate", "updatedAt"] as const

/**
 * 「自動」で高さから件数を割り出すときの、1行の見積もり（px）。
 *
 * 1行は名前と要約の2段（`px-4 py-3.5` の余白込み）。実測より少し大きめに取り、
 * はみ出すより余らせる。
 */
const ENTITY_LIST_ROW_HEIGHT = 72

/** 行の上に居座る見出し行の高さ（`h-12`） */
const ENTITY_LIST_HEADER_HEIGHT = 48

/**
 * 4つのトップページ（解答用紙 / 試験 / 試験外成績資料 / 成績算出）で共通の一覧。
 *
 * **列は6つで固定**（チェックボックス / 名前＋要約 / 日付 / 更新日時 / 次のステップ / …）。
 * 画面ごとに変わるのは「行1件からその6つをどう作るか」だけなので、受け取るのは
 * 取り出しの関数と、ヘッダー右に並べる操作だけにしてある。
 *
 * 当たり判定の割り方:
 *
 * - **行のどこを押しても概要ページへ飛ぶ。**「詳細」ボタンと列は持たない
 * - **チェックボックスの上だけが選択**（行の他の場所を押しても選択は動かない）
 * - **「…」と「次のステップ」は行クリックを止める**（別の飛び先を持つため）
 *
 * 絞り込みは**列見出しの中**にある。並べ替えも同じ popover へ入れてあるので、見出しが
 * 持つ当たり判定は「popover を開く」1つだけ（`FilterableTableHead`）。「次のステップ」
 * 列だけは絞り込みを持たない —— 絞ると選択した行が見えなくなり、ヘッダーの一括操作が
 * 「見えていない行にも効く」ことになる。
 */
export function EntityListPage<TRow extends { id: string }>({
  title,
  rows,
  totalCount,
  isLoading,
  name,
  summary,
  dateLabel,
  referenceDate,
  updatedAt,
  overviewUrl,
  nextStep,
  rowMenu,
  actions,
  search,
  tagFilter,
  classroomFilter,
  dateFilter,
  updatedAtFilter,
  selectedIds,
  selectionDisabledReason,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  empty,
  noMatchMessage,
  sortStorageKey,
}: EntityListPageProps<TRow>) {
  const router = useRouter()

  const sortableRows = useMemo<SortableEntityRow<TRow>[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: name(row),
        referenceDate: referenceDate(row),
        updatedAt: updatedAt(row),
        row,
      })),
    [rows, name, referenceDate, updatedAt]
  )

  // 既定は更新日時の新しい順。日付（実施日）は未設定を許すので、降順にすると
  // 未設定の行が先頭へ集まってしまう（`useTableSort` は降順で null を先に置く）
  const { sortedData, sortConfig, applySort } = useTableSort(sortableRows, {
    defaultSort: { key: "updatedAt", direction: "desc" },
    storageKey: sortStorageKey,
    sortableKeys: SORTABLE_KEYS,
  })

  // 条件か並び順が変わったら先頭のページから見る
  const paginationResetKey = [
    search.term,
    [...(tagFilter?.selectedIds ?? [])].sort().join(","),
    [...(classroomFilter?.selectedIds ?? [])].sort().join(","),
    dateFilter.from,
    dateFilter.to,
    updatedAtFilter.from,
    updatedAtFilter.to,
    sortConfig.key ?? "",
    sortConfig.direction ?? "",
  ].join("|")

  const {
    pageRows,
    pageNumber,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    pageCount,
    setPageNumber,
    firstRowNumber,
    lastRowNumber,
    viewportRef,
  } = useListPagination(sortedData, {
    rowHeight: ENTITY_LIST_ROW_HEIGHT,
    reservedHeight: ENTITY_LIST_HEADER_HEIGHT,
    resetKey: paginationResetKey,
  })

  const openOverview = (row: TRow) => {
    router.push(overviewUrl(row))
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      {/*
        ヘッダーは段の無いページと共通（`PageHeader`）。絞り込みはここに置かない
        （列見出しへ移した）ので、並ぶのは操作だけである。

        件数は題のすぐ右。畳まない（畳むと「何件あるのか」が見えなくなる）。
        絞り込むと分母と分子が出る
      */}
      <PageHeader
        title={title}
        subtitle={
          rows.length === totalCount
            ? `${totalCount}件`
            : `${rows.length} / ${totalCount}件`
        }
        actions={actions}
      />

      <div className="min-h-0 flex-1 p-4">
        {!isLoading && totalCount === 0 ? (
          <Empty className="h-full rounded-xl border border-dashed border-border/60">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <empty.icon />
              </EmptyMedia>
              <EmptyTitle>{empty.message}</EmptyTitle>
            </EmptyHeader>
            {empty.action && <EmptyContent>{empty.action}</EmptyContent>}
          </Empty>
        ) : (
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 shadow-sm">
            {/*
              「自動」はこの箱の高さを1行の高さで割る。上下の余白を置かない。

              **縦に流すのは中の `Table` の側**（`wrapperClassName`）。ここで
              `overflow-auto` を持つと、こちらが最も近いスクロール領域になり、
              しかも中身の高さぶんに伸びて一度も流れないので、見出し行の `sticky` が
              効かなくなる（貼り付く相手が動かない）。
            */}
            <div ref={viewportRef} className="min-h-0 flex-1">
              <Table wrapperClassName="h-full">
                <EntityListTableHeader
                  allSelected={allSelected}
                  onToggleSelectAll={onToggleSelectAll}
                  currentSortKey={sortConfig.key}
                  currentDirection={sortConfig.direction}
                  onSort={applySort}
                  search={search}
                  tagFilter={tagFilter}
                  classroomFilter={classroomFilter}
                  dateLabel={dateLabel}
                  dateFilter={dateFilter}
                  updatedAtFilter={updatedAtFilter}
                />
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        className="py-8 text-center text-muted-foreground"
                      >
                        読み込み中...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {noMatchMessage}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    pageRows.map((sortableRow) => {
                      const row = sortableRow.row
                      const step = nextStep(row)
                      return (
                        <EntityListRow
                          key={sortableRow.id}
                          sortableRow={sortableRow}
                          summary={summary(row)}
                          step={step}
                          selectionDisabledReason={selectionDisabledReason?.(
                            row
                          )}
                          isSelected={selectedIds.has(sortableRow.id)}
                          onToggleSelect={(checked) =>
                            onToggleSelect(sortableRow.id, checked)
                          }
                          onOpenOverview={() => openOverview(row)}
                          onOpenNextStep={() => router.push(step.url)}
                          rowMenu={rowMenu(row)}
                        />
                      )
                    })}
                </TableBody>
              </Table>
            </div>
            <ListPaginationFooter
              total={rows.length}
              firstRowNumber={firstRowNumber}
              lastRowNumber={lastRowNumber}
              pageSize={pageSize}
              pageSizeChoice={pageSizeChoice}
              onPageSizeChoiceChange={setPageSizeChoice}
              pageNumber={pageNumber}
              pageCount={pageCount}
              onPageChange={setPageNumber}
            />
          </div>
        )}
      </div>
    </div>
  )
}
