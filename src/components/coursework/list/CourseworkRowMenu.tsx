import { FileArchive, MoreHorizontal, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CourseworkSummary } from "@/types/coursework.types"

interface CourseworkRowMenuProps {
  coursework: CourseworkSummary
  /** 「.sao 書き出し」を押したとき（統合アーカイブの書き出しをこの1件から始める） */
  onUnifiedExport: () => void
  /** 押しただけでは消さない。確認を開く */
  onRequestDelete: () => void
}

/** 資料一覧の行末の「…」 */
export function CourseworkRowMenu({
  coursework,
  onUnifiedExport,
  onRequestDelete,
}: CourseworkRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`${coursework.name}の操作`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onUnifiedExport}>
          <FileArchive />
          .sao 書き出し
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onRequestDelete}>
          <Trash2 />
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
