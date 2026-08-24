"use client"

import { useRouter } from "next/navigation"
import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { useMemo } from "react"

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
import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { OverflowToolbar } from "@/components/common/OverflowToolbar"
import { HistoryNavButtons } from "@/components/layout/HistoryNavButtons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useListPagination } from "@/hooks/useListPagination"
import { useTableSort } from "@/hooks/useTableSort"

/**
 * 日付列に出す値。
 *
 * `Date` と ISO 文字列の両方を受けるのは、**いまの4画面で型が割れているから**。
 * 試験・資料・成績は Prisma の行がそのまま IPC の structured clone を通るので `Date`
 * （4実体とも `referenceDate` と `updatedAt`）だが、
 * 解答用紙だけは `listAsbDefinitions`（`electron-src/lib/prisma/asbDefinition.ts`）が
 * `toISOString()` して返すので文字列である（`ASBDefinitionListItem.updatedAt`）。
 * 既存の `useListFilter` の `date` accessor も同じ理由で両方を受けている。
 */
export type EntityListDate = Date | string | null

/** 「次のステップ」列に出すもの */
interface EntityListNextStep {
  label: string
  url: string
}

/** 1件も無いときに出すもの */
interface EntityListEmptyState {
  /** 本文（「まだ試験がありません」など） */
  message: string
  /** 作成へ導く導線。無くてもよい */
  action?: ReactNode
}

/**
 * 日付列の絞り込み。`useListFilter` が持っている値と setter をそのまま渡す。
 *
 * 見出しの語は列の見出しと同じものを使うので、ここでは受け取らない
 * （呼び手が2回書くと、列の語と popover の語がずれる）。
 */
export interface EntityListDateFilter {
  /** YYYY-MM-DD、空文字は未指定 */
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

/**
 * 名前列の popover に入る横断検索。
 *
 * 名前だけでなく説明・タグ名・学級名も見ているので、どの列の値でもない。
 * 名前列に置くのは、行の中でいちばん多く目に入る列だからである。
 */
interface EntityListSearch {
  term: string
  onChange: (value: string) => void
  /** 「試験名・タグで検索」など、何を見ているかを言う */
  placeholder: string
}

interface EntityListPageProps<TRow extends { id: string }> {
  /** ヘッダーの中央に出す画面の題（「試験一覧」「解答用紙作成」など） */
  title: string
  /** ヘッダー右端の「使い方」。`usePageHelp` が作ったものを呼び手が渡す */
  helpButton?: ReactNode
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
   * 弾かれたことが利用者へ届かない（docs/branch-review-findings.md #10）。押す前に
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

/** 並べ替えに載せるために、行から値だけ抜いた形 */
interface SortableEntityRow<TRow> {
  id: string
  name: string
  referenceDate: EntityListDate
  updatedAt: EntityListDate
  row: TRow
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

/** `yy/mm/dd`。列幅を食わないよう西暦は下2桁 */
function formatDay(date: EntityListDate): string {
  if (date === null) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"
  return `${String(parsed.getFullYear()).slice(-2)}/${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}`
}

/** その日を指す鍵（`toLocaleDateString` を挟まず、ローカルの年月日で比べる） */
function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * 更新日時の短い姿。今日と昨日は時刻まで、それより前は `yy/mm/dd`。
 *
 * 「今日」は**描いた時点の判定**なので、一覧を開いたまま日付を跨ぐと「今日」のまま
 * 残る。正確な値は tooltip で常に読めるので、そのために時計を持たない。
 */
function formatUpdatedAt(date: EntityListDate): string {
  if (date === null) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"

  const now = new Date()
  const dayKey = toDayKey(parsed)
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(
    parsed.getMinutes()
  ).padStart(2, "0")}`

  if (dayKey === toDayKey(now)) return `今日 ${time}`
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  )
  if (dayKey === toDayKey(yesterday)) return `昨日 ${time}`
  return formatDay(parsed)
}

/** tooltip に出す `yyyy/mm/dd hh:mm`。省略のない形はここだけ */
function formatFullDateTime(date: EntityListDate): string | null {
  if (date === null) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(
    2,
    "0"
  )}/${String(parsed.getDate()).padStart(2, "0")} ${String(
    parsed.getHours()
  ).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
}

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
  helpButton,
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

  const isNameFiltered =
    search.term !== "" ||
    (tagFilter?.selectedIds.size ?? 0) > 0 ||
    (classroomFilter?.selectedIds.size ?? 0) > 0
  const isDateFiltered = dateFilter.from !== "" || dateFilter.to !== ""
  const isUpdatedAtFiltered =
    updatedAtFilter.from !== "" || updatedAtFilter.to !== ""

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

  /** 押されたのが行そのものか、行の中の別の導線かを分ける */
  const stopRowActivation = (event: MouseEvent<HTMLTableCellElement>) => {
    event.stopPropagation()
  }

  const openOverview = (row: TRow) => {
    router.push(overviewUrl(row))
  }

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: TRow
  ) => {
    // 行そのものが導線なので、マウスと同じことをキーボードからもできるようにする
    if (event.key !== "Enter" && event.key !== " ") return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    openOverview(row)
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      {/*
        ヘッダーは**1行**。左からクイックアクセス（戻る／進む）・題・件数、右に操作。
        詳細画面の `WorkflowTabHeader` の上段と同じ姿で、違うのは「一覧へ戻る」が
        無いこと（一覧に一覧の親は無い）と、下段のタブが無いことだけ。

        題は**クイックアクセスのすぐ右**。行の中央に絶対配置していたが、目が最初に
        行くのは左端で、そこから中央まで戻って読むことになる。左から
        「どこへ行けるか → いま何を見ているか → 何件あるか」と並べば視線が一方向で済む。

        絞り込みはここに置かない（列見出しへ移した）ので、並ぶのは操作だけである。
      */}
      <header className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
        <div className="flex shrink-0 items-center gap-2">
          <HistoryNavButtons />
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          {/*
            件数は畳まない（畳むと「何件あるのか」が見えなくなる）ので、実測して
            畳む並びの外に置く。絞り込むと分母と分子が出る
          */}
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {rows.length === totalCount
              ? `${totalCount}件`
              : `${rows.length} / ${totalCount}件`}
          </span>
        </div>
        <OverflowToolbar actions={actions} />
        {/* 「使い方」は畳まない。読み方が分からないときに真っ先に隠れると詰む */}
        {helpButton === undefined || helpButton === null ? null : (
          <div className="shrink-0">{helpButton}</div>
        )}
      </header>

      <div className="min-h-0 flex-1 p-4">
        {!isLoading && totalCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60">
            <p className="text-muted-foreground">{empty.message}</p>
            {empty.action}
          </div>
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
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          onToggleSelectAll(checked === true)
                        }
                        aria-label="全選択"
                      />
                    </TableHead>
                    <FilterableTableHead
                      label="名前"
                      sortKey="name"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={applySort}
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
                        {classroomFilter &&
                          classroomFilter.options.length > 0 && (
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
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={applySort}
                      isFiltered={isDateFiltered}
                      className="w-36"
                    >
                      <DateRangeFilterPanel
                        config={{ label: dateLabel, ...dateFilter }}
                      />
                    </FilterableTableHead>
                    <FilterableTableHead
                      label="更新日時"
                      sortKey="updatedAt"
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={applySort}
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
                      const disabledReason = selectionDisabledReason?.(row)
                      const fullUpdatedAt = formatFullDateTime(
                        sortableRow.updatedAt
                      )
                      return (
                        <TableRow
                          key={sortableRow.id}
                          className="group cursor-pointer"
                          tabIndex={0}
                          aria-label={`${sortableRow.name}の概要を開く`}
                          onClick={() => openOverview(row)}
                          onKeyDown={(event) => handleRowKeyDown(event, row)}
                        >
                          {/* 選択の当たり判定はこのセルの中のチェックボックスだけ */}
                          <TableCell
                            className="text-center"
                            onClick={stopRowActivation}
                          >
                            <Checkbox
                              checked={selectedIds.has(sortableRow.id)}
                              onCheckedChange={(checked) =>
                                onToggleSelect(sortableRow.id, checked === true)
                              }
                              disabled={disabledReason !== undefined}
                              title={disabledReason}
                              aria-label={`${sortableRow.name}を選択`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {sortableRow.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {summary(row)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                            {formatDay(sortableRow.referenceDate)}
                          </TableCell>
                          {/*
                            短い姿だけを出し、省略のない日時は hover で読ませる。
                            行はどこを押しても概要ページへ飛ぶので、押して開く形にはできない
                          */}
                          <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                            {fullUpdatedAt === null ? (
                              formatUpdatedAt(sortableRow.updatedAt)
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    {formatUpdatedAt(sortableRow.updatedAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{fullUpdatedAt}</TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          {/* 概要とは別の飛び先なので、行の当たり判定を止める */}
                          <TableCell
                            className="text-center"
                            onClick={stopRowActivation}
                          >
                            <Button
                              size="sm"
                              className="w-48 justify-start rounded-lg text-left"
                              onClick={() => router.push(step.url)}
                            >
                              <span className="text-xs">{step.label}</span>
                            </Button>
                          </TableCell>
                          {/* 行メニュー。ここも行の当たり判定を止める */}
                          <TableCell
                            className="text-center"
                            onClick={stopRowActivation}
                          >
                            {rowMenu(row)}
                          </TableCell>
                        </TableRow>
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
