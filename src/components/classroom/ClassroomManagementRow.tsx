"use client"

import { Edit, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"

interface ClassroomManagementRowProps {
  classroom: ClassroomWithMemberships
  /** いま所属している生徒の数 */
  memberCount: number
  isSelected: boolean
  /** 行を押したとき（学級の詳細を開く） */
  onOpen: () => void
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

/** 学級管理の一覧の1行。選択・編集・削除のボタンは行を開く押下に伝えない */
export function ClassroomManagementRow({
  classroom,
  memberCount,
  isSelected,
  onOpen,
  onToggleSelect,
  onEdit,
  onDelete,
}: ClassroomManagementRowProps) {
  return (
    <TableRow
      onClick={onOpen}
      className="group cursor-pointer"
      data-state={isSelected ? "selected" : undefined}
    >
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`${classroom.name}を選択`}
        />
      </TableCell>
      <TableCell className="font-medium">
        {classroom.name}
        {classroom.isVisible === false && (
          <Badge
            variant="secondary"
            className="ml-2 rounded-full px-2 py-0 text-xs font-normal"
          >
            非表示
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {classroom.classroomCode ? (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-xs font-normal"
          >
            {classroom.classroomCode}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {classroom.grade || (
          <span className="text-muted-foreground">未設定</span>
        )}
      </TableCell>
      <TableCell>
        {classroom.description ? (
          <span className="max-w-xs truncate text-sm">
            {classroom.description}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">{memberCount}名</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="学級を編集"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>学級を編集</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="学級を削除"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>学級を削除</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  )
}
