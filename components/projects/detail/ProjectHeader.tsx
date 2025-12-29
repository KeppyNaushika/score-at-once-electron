"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar, Download, Edit, Info, MoreVertical, Tag, Trash2 } from "lucide-react"
import Link from "next/link"

interface ProjectData {
  id: string
  examName: string
  description: string | null
  examDate: Date | null
  subject: string | null
  createdAt: Date
}

interface ProjectHeaderProps {
  project: ProjectData
  onEdit: () => void
  onDelete: () => void
  onExport?: () => void
}

export default function ProjectHeader({
  project,
  onEdit,
  onDelete,
  onExport,
}: ProjectHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{project.examName}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-2">{project.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4">
            {project.subject && (
              <Badge variant="outline">
                <Tag className="mr-1 h-3 w-3" />
                {project.subject}
              </Badge>
            )}
            {project.examDate && (
              <Badge variant="outline">
                <Calendar className="mr-1 h-3 w-3" />
                {new Date(project.examDate).toLocaleDateString()}
              </Badge>
            )}
            <Badge variant="secondary">
              作成日: {new Date(project.createdAt).toLocaleDateString()}
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
                プロジェクトを編集
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}/score`}>
                  <Info className="mr-2 h-4 w-4" />
                  プロジェクト設定
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
                プロジェクトを削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
