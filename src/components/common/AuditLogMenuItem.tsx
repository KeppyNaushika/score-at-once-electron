"use client"

import { History } from "lucide-react"

import { GuardedLink } from "@/components/common/GuardedLink"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { auditLogsHrefOfScope } from "@/lib/auditLogFilterQuery"

/**
 * 詳細ページの見出し右のドロップダウンに置く「操作履歴」。
 * その作業領域（試験・成績算出・資料・解答用紙定義・学級）で絞り込んだ一覧へ飛ぶ。
 */
export function AuditLogMenuItem({
  scopeId,
  scopeLabel,
}: {
  scopeId: string
  /** 絞り込みの chip に出す名前 */
  scopeLabel: string | null
}) {
  return (
    <DropdownMenuItem asChild>
      <GuardedLink href={auditLogsHrefOfScope(scopeId, scopeLabel)}>
        <History />
        操作履歴
      </GuardedLink>
    </DropdownMenuItem>
  )
}
