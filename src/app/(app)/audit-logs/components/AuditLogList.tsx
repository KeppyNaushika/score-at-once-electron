"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Combobox } from "@/components/common/Combobox"
import { ListSearchInput } from "@/components/common/ListFilterControls"
import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import { type ToolbarAction } from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { type PublicUser, userListQuery } from "@/queries/user"

import { CATEGORY_LABELS, isAuditCategory } from "../constants"
import { useAuditLogs } from "../hooks/useAuditLogs"
import { AuditLogItem } from "./AuditLogItem"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: PublicUser[] = []

const ALL = "__all__"

export function AuditLogList() {
  const {
    entries,
    total,
    loading,
    error,
    filter,
    setFilter,
    pageNumber,
    pageSize,
    pageSizeChoice,
    pageCount,
    setPageNumber,
    setPageSizeChoice,
    viewportRef,
  } = useAuditLogs()
  const [searchText, setSearchText] = useState("")

  // 操作者フィルタの選択肢（ログイン画面と同じ利用者一覧のキャッシュを共有する）
  const { data: users = EMPTY_USERS } = useQuery(userListQuery())

  // 検索テキストはデバウンスしてフィルタへ反映。
  // 更新関数形にすることで、待機中に他のフィルタが変わっても上書きしない。
  //
  // **いま効いている検索語と同じなら書かない。** `setFilter` は条件が変わった合図
  // なので、無条件に1ページ目へ戻す。書き換える理由が無いときに書くと、開いた直後
  // （どちらも空）に 300ms 遅れて絞り込みを「変えた」ことになり、その間に送った
  // ページが1ページ目へ引き戻される
  const appliedSearchText = filter.search ?? ""
  useEffect(() => {
    if (searchText === appliedSearchText) return
    const timeoutId = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchText || undefined }))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchText, appliedSearchText, setFilter])

  const userFilterOptions = useMemo(
    () => [
      { value: ALL, label: "すべてのユーザー" },
      ...users.map((user) => ({
        value: user.id,
        label: user.name,
        keywords: [user.username],
      })),
    ],
    [users]
  )

  const categoryOptions = useMemo(
    () => Object.keys(CATEGORY_LABELS).filter(isAuditCategory),
    []
  )

  // 何件目から何件目までを見ているか（総件数は main が数えた値）
  const firstRowNumber = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1
  const lastRowNumber = Math.min(total, pageNumber * pageSize)

  const categoryFilter = (
    <Select
      value={filter.category ?? ALL}
      onValueChange={(value) =>
        setFilter((prev) => ({
          ...prev,
          category: isAuditCategory(value) ? value : undefined,
        }))
      }
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue placeholder="カテゴリ" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>すべてのカテゴリ</SelectItem>
        {categoryOptions.map((category) => (
          <SelectItem key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const userFilter = (
    <Combobox
      options={userFilterOptions}
      value={filter.userId ?? ALL}
      onValueChange={(value) =>
        setFilter((prev) => ({
          ...prev,
          userId: value === ALL ? undefined : value,
        }))
      }
      placeholder="ユーザー"
      searchPlaceholder="名前・ユーザー名で検索"
      emptyText="該当するユーザーがいません"
      aria-label="ユーザーで絞り込む"
      className="h-8 w-44"
    />
  )
  const toolbarActions: ToolbarAction[] = [
    {
      id: "search",
      priority: 90,
      node: (
        <ListSearchInput
          searchTerm={searchText}
          onSearchTermChange={setSearchText}
          placeholder="内容で検索"
          className="w-56"
        />
      ),
      collapsedNode: (
        <ListSearchInput
          searchTerm={searchText}
          onSearchTermChange={setSearchText}
          placeholder="内容で検索"
          className="w-full"
        />
      ),
    },
    {
      id: "category-filter",
      priority: 85,
      node: categoryFilter,
      collapsedNode: categoryFilter,
    },
    {
      id: "user-filter",
      priority: 84,
      node: userFilter,
      collapsedNode: userFilter,
    },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* 絞り込みはヘッダーに置く。スクロールするのはログの並びだけ */}
      <PageHeader
        title="監査ログ"
        subtitle={`${total} 件`}
        actions={toolbarActions}
      />

      {/* ここだけが伸び縮みする。`min-h-0` が無いと flex の子は縮まず、
          はみ出した分がページごとスクロールしてフッターが流れていく。
          上下の余白は置かない —— 「自動」はこの箱の高さ（`clientHeight`）を
          1行の高さで割るので、余白を入れるとその分だけ多く数えてしまう */}
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto px-6">
        {error && (
          <div className="mt-4 mb-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>記録された操作はありません</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div>
            {entries.map((entry) => (
              <AuditLogItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* 初回の取得中は総件数が 0 なので出ない。ページを送っている間は
          前のページを出したままなので、フッターは動かない */}
      {total > 0 && (
        <ListPaginationFooter
          total={total}
          firstRowNumber={firstRowNumber}
          lastRowNumber={lastRowNumber}
          pageSize={pageSize}
          pageSizeChoice={pageSizeChoice}
          onPageSizeChoiceChange={setPageSizeChoice}
          pageNumber={pageNumber}
          pageCount={pageCount}
          onPageChange={setPageNumber}
        />
      )}
    </div>
  )
}
