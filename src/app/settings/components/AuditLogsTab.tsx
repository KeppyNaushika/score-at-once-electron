"use client"

import {
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  FileX2,
  History,
  Pencil,
  Upload,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useAuditLogs } from "@/app/settings/hooks/useAuditLogs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  AuditCategory,
  AuditVerb,
} from "@/electron-src/lib/prisma/auditActions"
import type { AuditLogEntry } from "@/types/auditLog.types"

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  exam: "試験",
  grade: "成績",
  answer_sheet: "解答用紙",
  student: "生徒・学級",
  user: "ユーザー",
  system: "システム",
}

const VERB_META: Record<
  AuditVerb,
  { label: string; className: string; Icon: typeof Pencil }
> = {
  create: { label: "作成", className: "text-emerald-600", Icon: FilePlus2 },
  update: { label: "更新", className: "text-blue-600", Icon: Pencil },
  delete: { label: "削除", className: "text-red-600", Icon: FileX2 },
  export: { label: "出力", className: "text-violet-600", Icon: Download },
  import: { label: "取込", className: "text-amber-600", Icon: Upload },
  other: { label: "操作", className: "text-muted-foreground", Icon: History },
}

interface SimpleUser {
  id: string
  name: string
}

const initials = (name: string | null): string => {
  if (!name) return "?"
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 2) : "?"
}

const formatRelativeTime = (iso: string): string => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffSec = Math.floor((Date.now() - then) / 1000)
  if (diffSec < 60) return "たった今"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}日前`
  return new Date(iso).toLocaleDateString("ja-JP")
}

const formatAbsoluteTime = (iso: string): string =>
  new Date(iso).toLocaleString("ja-JP")

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "（なし）"
  if (typeof value === "boolean") return value ? "はい" : "いいえ"
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function ChangeDiff({ entry }: { entry: AuditLogEntry }) {
  const changes = entry.metadata?.changes
  if (!changes || changes.length === 0) {
    return (
      <div className="mt-2 ml-11 text-sm text-muted-foreground">
        詳細な変更内容は記録されていません。
      </div>
    )
  }
  return (
    <div className="mt-2 ml-11 space-y-1.5">
      {changes.map((change, i) => (
        <div key={i} className="text-sm">
          <span className="text-muted-foreground">
            {change.label ?? change.field}:{" "}
          </span>
          <span className="text-red-600 line-through">
            {formatValue(change.before)}
          </span>
          <span className="mx-1.5 text-muted-foreground">→</span>
          <span className="text-emerald-600">{formatValue(change.after)}</span>
        </div>
      ))}
    </div>
  )
}

function AuditLogItem({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const verb = VERB_META[entry.verb] ?? VERB_META.other
  const { Icon } = verb
  const hasChanges = (entry.metadata?.changes?.length ?? 0) > 0
  const actor = entry.actorName ?? "不明なユーザー"

  return (
    <div className="rounded-md px-2 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <Avatar className="mt-0.5 h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">
            {initials(entry.actorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${verb.className}`} />
            <span className="font-semibold">{actor}</span>
            <span className="text-foreground">が {entry.summary}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </Badge>
            {entry.scopeLabel && (
              <span className="truncate">{entry.scopeLabel}</span>
            )}
            <span title={formatAbsoluteTime(entry.updatedAt)}>
              {formatRelativeTime(entry.updatedAt)}
            </span>
            {entry.occurrences > 1 && (
              <span className="text-muted-foreground/80">
                ・{entry.occurrences}回
              </span>
            )}
          </div>
          {hasChanges && expanded && <ChangeDiff entry={entry} />}
        </div>
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="ml-1 text-xs">変更内容</span>
          </Button>
        )}
      </div>
    </div>
  )
}

const ALL = "__all__"

export function AuditLogsTab() {
  const {
    entries,
    total,
    loading,
    loadingMore,
    error,
    filter,
    setFilter,
    hasMore,
    loadMore,
  } = useAuditLogs()
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [searchText, setSearchText] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const data = await window.electronAPI.fetchUsers()
        setUsers(data.map((user) => ({ id: user.id, name: user.name })))
      } catch (e) {
        console.error("Failed to load users for audit filter:", e)
      }
    })()
  }, [])

  // 検索テキストはデバウンスしてフィルタへ反映。
  // 更新関数形にすることで、待機中に他のフィルタが変わっても上書きしない
  useEffect(() => {
    const id = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchText || undefined }))
    }, 300)
    return () => clearTimeout(id)
  }, [searchText, setFilter])

  const categoryOptions = useMemo(
    () => Object.entries(CATEGORY_LABELS) as [AuditCategory, string][],
    []
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filter.category ?? ALL}
          onValueChange={(v) =>
            setFilter({
              ...filter,
              category: v === ALL ? undefined : (v as AuditCategory),
            })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="カテゴリ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべてのカテゴリ</SelectItem>
            {categoryOptions.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.userId ?? ALL}
          onValueChange={(v) =>
            setFilter({ ...filter, userId: v === ALL ? undefined : v })
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

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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

      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "読み込み中..." : "さらに表示"}
          </Button>
        </div>
      )}
    </div>
  )
}
