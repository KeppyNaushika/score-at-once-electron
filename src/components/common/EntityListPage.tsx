"use client"

import { useRouter } from "next/navigation"
import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { useMemo } from "react"

import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { OverflowToolbar } from "@/components/common/OverflowToolbar"
import { HistoryNavButtons } from "@/components/layout/HistoryNavButtons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

interface EntityListPageProps<TRow extends { id: string }> {
  /** ヘッダーの中央に出す画面の題（「試験一覧」「解答用紙作成」など） */
  title: string
  /** ヘッダー右端の「使い方」。`usePageHelp` が作ったものを呼び手が渡す */
  helpButton?: ReactNode
  /** 絞り込み済みの行（並べ替えは部品の中でやる） */
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
  /**
   * 選択の状態。**呼び手が持つ**（ヘッダーの一括操作が選択を読むため）。
   * 並べ替えは行の集合を変えないので、呼び手は絞り込み済みの行に対して
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

function formatDay(date: EntityListDate): string {
  if (date === null) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function formatDayAndTime(date: EntityListDate): string {
  if (date === null) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableRows, {
    defaultSort: { key: "updatedAt", direction: "desc" },
    storageKey: sortStorageKey,
    sortableKeys: SORTABLE_KEYS,
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
          <div className="h-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
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
                  <SortableTableHead
                    sortKey="name"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={requestSort}
                  >
                    名前
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="referenceDate"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="w-32 text-center"
                  >
                    {dateLabel}
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="updatedAt"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="w-40 text-center"
                  >
                    更新日時
                  </SortableTableHead>
                  <TableHead className="w-52 text-center">
                    次のステップ
                  </TableHead>
                  <TableHead className="w-12" />
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
                  sortedData.map((sortableRow) => {
                    const row = sortableRow.row
                    const step = nextStep(row)
                    const disabledReason = selectionDisabledReason?.(row)
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
                          <div className="font-medium">{sortableRow.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {summary(row)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                          {formatDay(sortableRow.referenceDate)}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                          {formatDayAndTime(sortableRow.updatedAt)}
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
        )}
      </div>
    </div>
  )
}
