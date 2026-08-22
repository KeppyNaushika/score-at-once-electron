"use client"

import {
  Calendar,
  Edit,
  FolderOutput,
  MoreVertical,
  Tag,
  Trash2,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExamForDetail } from "@/queries/exam"

interface ExamHeaderProps {
  /** 詳細画面が取る試験1件（`examForDetailQuery` の戻り）をそのまま受け取る */
  exam: ExamForDetail
  onEdit: () => void
  onDelete: () => void
  onExport?: () => void
  /**
   * 協調採点のメンバーを招く。
   *
   * 段のヘッダーから外した（行き先を持たない操作はタブに並べられない）ので、
   * 「この試験が何か」を見せるこの画面が引き受ける。参加者も試験の一部である。
   */
  onManageMembers: () => void
}

export default function ExamHeader({
  exam,
  onEdit,
  onDelete,
  onExport,
  onManageMembers,
}: ExamHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{exam.examName}</h1>
          {exam.description && (
            <p className="mt-2 text-muted-foreground">{exam.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4">
            {exam.examTags.map((examTag) => (
              <Badge
                key={examTag.tag.id}
                variant="outline"
                style={
                  examTag.tag.color
                    ? {
                        borderColor: examTag.tag.color,
                        color: examTag.tag.color,
                      }
                    : undefined
                }
              >
                <Tag className="mr-1 h-3 w-3" />
                {examTag.tag.name}
              </Badge>
            ))}
            {exam.referenceDate && (
              <Badge variant="outline">
                <Calendar className="mr-1 h-3 w-3" />
                {exam.referenceDate.toLocaleDateString()}
              </Badge>
            )}
            <Badge variant="secondary">
              作成日: {exam.createdAt.toLocaleDateString()}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            編集
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                試験を編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageMembers}>
                <Users className="mr-2 h-4 w-4" />
                メンバー
              </DropdownMenuItem>
              {onExport && (
                <DropdownMenuItem onClick={onExport}>
                  <FolderOutput className="mr-2 h-4 w-4" />
                  .score 書き出し
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                試験を削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
