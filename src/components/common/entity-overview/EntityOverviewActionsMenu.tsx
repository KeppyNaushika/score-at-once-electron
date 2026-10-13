"use client"

import { EllipsisVertical, FileArchive, Trash } from "lucide-react"

import { AuditLogMenuItem } from "@/components/common/AuditLogMenuItem"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EntityOverviewActionsMenuProps {
  /** 「.sao 書き出し」を押したとき（書き出しのダイアログは使う側が持つ） */
  onExportArchive: () => void
  /** 操作履歴を絞り込む作業領域の id */
  auditScopeId: string
  /** 操作履歴の絞り込みの chip に出す名前 */
  auditScopeLabel: string | null
  /**
   * 削除の項目。無ければ区切り線ごと出さない（解答用紙のように、削除を一覧の行の
   * 側にだけ置く実体がある）
   */
  deleteAction?: {
    /** 項目の文言（「資料を削除」など） */
    label: string
    /** 押したとき（押しただけでは消さず、確認は使う側が開く） */
    onSelect: () => void
  }
}

/**
 * 概要ページの見出し右の「その他の操作」。
 * `.sao` 書き出し・操作履歴・（あれば）削除を、どの実体でも同じ並びで出す。
 */
export function EntityOverviewActionsMenu({
  onExportArchive,
  auditScopeId,
  auditScopeLabel,
  deleteAction,
}: EntityOverviewActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="その他の操作">
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportArchive}>
          <FileArchive />
          .sao 書き出し
        </DropdownMenuItem>
        <AuditLogMenuItem scopeId={auditScopeId} scopeLabel={auditScopeLabel} />
        {deleteAction && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={deleteAction.onSelect}
              variant="destructive"
            >
              <Trash />
              {deleteAction.label}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
