"use client"

import { ChevronDown } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AuditLogEntry } from "@/types/auditLog.types"

import { AUDIT_LOG_ROW_HEIGHT, CATEGORY_LABELS, VERB_META } from "../constants"

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
      <div className="text-sm text-muted-foreground">
        詳細な変更内容は記録されていません。
      </div>
    )
  }
  return (
    <div className="max-h-80 space-y-1.5 overflow-auto">
      {changes.map((change) => (
        <div key={change.field} className="text-sm">
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

/**
 * 監査ログ1行。
 *
 * **高さは `AUDIT_LOG_ROW_HEIGHT` に固定する。** 「自動」のページ件数が
 * 表示領域の高さを1行の高さで割って決めるので、行が伸び縮みすると件数が
 * 合わなくなる。文字は折り返さずに切り、変更内容は行を押し広げないよう
 * ポップオーバーへ出す。
 */
export function AuditLogItem({ entry }: { entry: AuditLogEntry }) {
  const verb = VERB_META[entry.verb] ?? VERB_META.other
  const { Icon } = verb
  const hasChanges = (entry.metadata?.changes?.length ?? 0) > 0
  const actor = entry.actorName ?? "不明なユーザー"

  return (
    <div
      className="flex items-center gap-3 border-b border-border/60 px-2 transition-colors hover:bg-muted/40"
      style={{ height: AUDIT_LOG_ROW_HEIGHT }}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">
          {initials(entry.actorName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${verb.className}`} />
          <span className="shrink-0 font-semibold">{actor}</span>
          <span className="truncate text-foreground">が {entry.summary}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="shrink-0 font-normal">
            {CATEGORY_LABELS[entry.category] ?? entry.category}
          </Badge>
          {entry.scopeLabel && (
            <span className="truncate">{entry.scopeLabel}</span>
          )}
          {entry.occurrences > 1 && (
            <span className="shrink-0 text-muted-foreground/80">
              {entry.occurrences}回
            </span>
          )}
        </div>
      </div>

      {/* 時刻は行の右端で揃える。幅を決めておかないと、隣の「変更内容」が
          出る行と出ない行で右端の位置がずれる */}
      <div className="flex shrink-0 items-center gap-2">
        {hasChanges && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <ChevronDown className="h-4 w-4" />
                <span className="ml-1 text-xs">変更内容</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96">
              <ChangeDiff entry={entry} />
            </PopoverContent>
          </Popover>
        )}
        <span
          className="w-20 text-right text-xs text-muted-foreground"
          title={formatAbsoluteTime(entry.updatedAt)}
        >
          {formatRelativeTime(entry.updatedAt)}
        </span>
      </div>
    </div>
  )
}
