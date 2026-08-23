"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { type PublicUser, userListQuery } from "@/queries/user"

import {
  AUDIT_LOG_PAGE_SIZES,
  CATEGORY_LABELS,
  isAuditCategory,
} from "../constants"
import { useAuditLogs } from "../hooks/useAuditLogs"
import { AuditLogItem } from "./AuditLogItem"
import { AuditLogPager } from "./AuditLogPager"

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
    pageCount,
    setPageNumber,
    setPageSize,
  } = useAuditLogs()
  const [searchText, setSearchText] = useState("")

  // 操作者フィルタの選択肢（ログイン画面と同じ利用者一覧のキャッシュを共有する）
  const { data: users = EMPTY_USERS } = useQuery(userListQuery())

  // 検索テキストはデバウンスしてフィルタへ反映。
  // 更新関数形にすることで、待機中に他のフィルタが変わっても上書きしない
  useEffect(() => {
    const id = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchText || undefined }))
    }, 300)
    return () => clearTimeout(id)
  }, [searchText, setFilter])

  const categoryOptions = useMemo(
    () => Object.keys(CATEGORY_LABELS).filter(isAuditCategory),
    []
  )

  // 何件目から何件目までを見ているか（総件数は main が数えた値）
  const firstRowNumber = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1
  const lastRowNumber = Math.min(total, pageNumber * pageSize)

  return (
    <div className="flex h-full flex-col">
      {/* 絞り込みは動かさない。スクロールするのはログの並びだけ */}
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
        <Select
          value={filter.category ?? ALL}
          onValueChange={(value) =>
            setFilter((prev) => ({
              ...prev,
              category: isAuditCategory(value) ? value : undefined,
            }))
          }
        >
          <SelectTrigger className="w-40">
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

        <Select
          value={filter.userId ?? ALL}
          onValueChange={(value) =>
            setFilter((prev) => ({
              ...prev,
              userId: value === ALL ? undefined : value,
            }))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="ユーザー" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべてのユーザー</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="内容で検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-56"
        />

        <span className="ml-auto text-sm text-muted-foreground">
          {total} 件
        </span>
      </div>

      {/* ここだけが伸び縮みする。`min-h-0` が無いと flex の子は縮まず、
          はみ出した分がページごとスクロールしてフッターが流れていく */}
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
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
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <History className="h-8 w-8 opacity-50" />
            <p className="text-sm">記録された操作はありません。</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {entries.map((entry) => (
              <AuditLogItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* 初回の取得中は総件数が 0 なので出ない。ページを送っている間は
          前のページを出したままなので、フッターは動かない */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-4 border-t px-6 py-3">
          <span className="text-sm text-muted-foreground">
            {total} 件中 {firstRowNumber}〜{lastRowNumber} 件
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIT_LOG_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} 件ずつ
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pageCount > 1 && (
            <div className="ml-auto">
              <AuditLogPager
                pageNumber={pageNumber}
                pageCount={pageCount}
                onPageChange={setPageNumber}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
