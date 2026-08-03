"use client"

import {
  Calendar,
  Edit,
  FolderOutput,
  Info,
  MoreVertical,
  Tag,
  Trash2,
} from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ExamData {
  id: string
  examName: string
  description: string | null
  examDate: Date | null
  examTags?: { tag: { id: string; name: string; color: string | null } }[]
  createdAt: Date
}

interface ExamHeaderProps {
  exam: ExamData
  onEdit: () => void
  onDelete: () => void
  onExport?: () => void
}

export default function ExamHeader({
  exam,
  onEdit,
  onDelete,
  onExport,
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
            {exam.examTags &&
              exam.examTags.length > 0 &&
              exam.examTags.map((examTag) => (
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
            {exam.examDate && (
              <Badge variant="outline">
                <Calendar className="mr-1 h-3 w-3" />
                {exam.examDate.toLocaleDateString()}
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
              <DropdownMenuItem asChild>
                <Link href={`/exams/${exam.id}/score`}>
                  <Info className="mr-2 h-4 w-4" />
                  試験設定
                </Link>
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
