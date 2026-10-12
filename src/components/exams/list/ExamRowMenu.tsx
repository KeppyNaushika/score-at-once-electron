import { Ellipsis, FileArchive, Trash } from "lucide-react"

import { useExamAccess } from "@/components/exams/shared/useExamAccess"
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
  /** 「.sao 書き出し」を押したとき（統合アーカイブの書き出しをこの1件から始める） */
  onUnifiedExport: () => void
  /** 押しただけでは消さない。確認を開く */
  onRequestDelete: () => void
}

/** 試験一覧の行末の「…」 */
export function ExamRowMenu({
  exam,
  onUnifiedExport,
  onRequestDelete,
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
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onUnifiedExport}>
          <FileArchive />
          .sao 書き出し
        </DropdownMenuItem>
        <ExamRowDeleteItem examId={exam.id} onRequestDelete={onRequestDelete} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 「削除」。概要ページと同じく、消せるのは**この試験のオーナーだけ**（`canManageExam`）。
 *
 * ロールは参加者の取得から引くので、メニューの中身（開いたときだけ描かれる）に置いて、
 * 開いた行の分だけ取りに行く。取れるまでは押させない（取れる前は「参加者でない」と
 * 区別が付かず、`canManageExam` が真になる）。オーナーでなければ出さない。
 */
function ExamRowDeleteItem({
  examId,
  onRequestDelete,
}: {
  examId: string
  onRequestDelete: () => void
}) {
  const access = useExamAccess(examId)
  if (!access.isPending && !access.canManageExam) return null
  return (
    <DropdownMenuItem
      variant="destructive"
      onClick={onRequestDelete}
      disabled={access.isPending}
    >
      <Trash />
      削除
    </DropdownMenuItem>
  )
}
