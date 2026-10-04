"use client"

import {
  Copy,
  FileArchive,
  FolderOutput,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserRoundCog,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

interface DefinitionRowMenuProps {
  definition: ASBDefinitionListItem
  /** 自分が担当か。編集・担当の受け渡し・削除は担当者だけに出す */
  isOwner: boolean
  onEdit: () => void
  onDuplicate: () => void
  onExport: () => void
  /** 「.sao 書き出し」を押したとき（統合アーカイブの書き出しをこの1件から始める） */
  onUnifiedExport: () => void
  onTransfer: () => void
  onDelete: () => void
}

/** 解答用紙一覧の行の「…」メニュー */
export function DefinitionRowMenu({
  definition,
  isOwner,
  onEdit,
  onDuplicate,
  onExport,
  onUnifiedExport,
  onTransfer,
  onDelete,
}: DefinitionRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`${definition.name}の操作`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOwner && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            編集
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          複製
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExport}>
          <FolderOutput />
          .asb 書き出し
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUnifiedExport}>
          <FileArchive />
          .sao 書き出し
        </DropdownMenuItem>
        {isOwner && (
          <>
            <DropdownMenuItem onClick={onTransfer}>
              <UserRoundCog />
              担当を渡す
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              削除
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
