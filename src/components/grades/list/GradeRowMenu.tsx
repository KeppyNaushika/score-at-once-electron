import { Copy, FileArchive, MoreHorizontal, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { GradeSummary } from "@/types/grade.types"

interface GradeRowMenuProps {
  grade: GradeSummary
  onDuplicate: () => void
  /** 「.sao 書き出し」を押したとき（統合アーカイブの書き出しをこの1件から始める） */
  onUnifiedExport: () => void
  /** 押しただけでは消さない。確認を開く */
  onRequestDelete: () => void
}

/** 成績算出一覧の行末の「…」 */
export function GradeRowMenu({
  grade,
  onDuplicate,
  onUnifiedExport,
  onRequestDelete,
}: GradeRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`${grade.name}の操作`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          複製
        </DropdownMenuItem>
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
