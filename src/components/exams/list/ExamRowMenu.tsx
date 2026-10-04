import { FileArchive, FolderOutput, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExamSummary } from "@/lib/examStatus"

interface ExamRowMenuProps {
  exam: ExamSummary
  /** 「.score 書き出し」を押したとき（書き出しの相手をこの1件にする） */
  onExport: () => void
  /** 「.sao 書き出し」を押したとき（統合アーカイブの書き出しをこの1件から始める） */
  onUnifiedExport: () => void
}

/** 試験一覧の行末の「…」 */
export function ExamRowMenu({
  exam,
  onExport,
  onUnifiedExport,
}: ExamRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`${exam.examName}の操作`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExport}>
          <FolderOutput />
          .score 書き出し
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUnifiedExport}>
          <FileArchive />
          .sao 書き出し
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
