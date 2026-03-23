"use client"

import {
  Calendar,
  Download,
  Edit,
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
  examTags?: { tag: { id: string; name: string } }[]
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
            <p className="text-muted-foreground mt-2">{exam.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4">
            {exam.examTags && exam.examTags.length > 0 &&
              exam.examTags.map((et) => (
                <Badge key={et.tag.id} variant="outline">
                  <Tag className="mr-1 h-3 w-3" />
                  {et.tag.name}
                </Badge>
              ))}
            {exam.examDate && (
              <Badge variant="outline">
                <Calendar className="mr-1 h-3 w-3" />
                {new Date(exam.examDate).toLocaleDateString()}
              </Badge>
            )}
            <Badge variant="secondary">
              作成日: {new Date(exam.createdAt).toLocaleDateString()}
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
                  <Download className="mr-2 h-4 w-4" />
                  エクスポート
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
