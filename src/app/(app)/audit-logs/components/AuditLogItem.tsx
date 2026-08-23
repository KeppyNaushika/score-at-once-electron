"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AuditLogEntry } from "@/types/auditLog.types"

import { CATEGORY_LABELS, VERB_META } from "../constants"

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

export function AuditLogItem({ entry }: { entry: AuditLogEntry }) {
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
            {entry.occurrences > 1 && (
              <span className="text-muted-foreground/80">
                {entry.occurrences}回
              </span>
            )}
          </div>
          {hasChanges && expanded && <ChangeDiff entry={entry} />}
        </div>
        {/* 時刻は行の右端で揃える。幅を決めておかないと、隣の「変更内容」が
            出る行と出ない行で右端の位置がずれる */}
        <div className="flex shrink-0 items-start gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="ml-1 text-xs">変更内容</span>
            </Button>
          )}
          <span
            className="mt-1 w-20 text-right text-xs text-muted-foreground"
            title={formatAbsoluteTime(entry.updatedAt)}
          >
            {formatRelativeTime(entry.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
