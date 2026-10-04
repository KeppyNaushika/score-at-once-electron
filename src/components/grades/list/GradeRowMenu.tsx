import { Copy, FolderOutput, MoreHorizontal, Trash2 } from "lucide-react"

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
  onExport: () => void
  /** 押しただけでは消さない。確認を開く */
  onRequestDelete: () => void
}

/** 成績算出一覧の行末の「…」 */
export function GradeRowMenu({
  grade,
  onDuplicate,
  onExport,
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
        <DropdownMenuItem onClick={onExport}>
          <FolderOutput />
          .grade 書き出し
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onRequestDelete}>
          <Trash2 />
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
