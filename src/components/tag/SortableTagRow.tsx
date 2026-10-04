import { Calculator, Edit2, Trash2 } from "lucide-react"

import { DragHandle } from "@/components/common/sortable-table/DragHandle"
import { useSortableRow } from "@/components/common/sortable-table/useSortableRow"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import type { TagSubtotalGroupWithSubtotalGroup } from "@/electron-src/lib/prisma/tagSubtotalGroup"

import { formatTagUsage } from "./tagUsage"

/** タグ1行。掴んで並べ替え、色・編集・削除・紐づく小計点グループの展開 */
export function SortableTagRow({
  tag,
  expanded,
  linkedSubtotalGroups,
  onToggleSubtotalGroups,
  onEdit,
  onDelete,
}: {
  tag: TagWithAllRelations
  expanded: boolean
  /** 展開中タグの紐付け。読み込み中は null */
  linkedSubtotalGroups: TagSubtotalGroupWithSubtotalGroup[] | null
  onToggleSubtotalGroups: (tag: TagWithAllRelations) => void
  onEdit: (tag: TagWithAllRelations) => void
  onDelete: (tag: TagWithAllRelations) => void
}) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(tag.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <DragHandle dragHandleProps={dragHandleProps} />
        {tag.color && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="h-4 w-4 shrink-0 cursor-pointer rounded-full border transition-transform hover:scale-125"
                style={{ backgroundColor: tag.color }}
                onClick={() => onEdit(tag)}
              />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              クリックして色を変更
            </TooltipContent>
          </Tooltip>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{tag.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatTagUsage(tag)}
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-normal"
          style={
            tag.color ? { borderColor: tag.color, color: tag.color } : undefined
          }
        >
          プレビュー
        </Badge>
        <WithTooltip
          content="紐づく小計点グループを表示"
          side="top"
          sideOffset={5}
        >
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 p-0 ${expanded ? "text-primary" : ""}`}
            onClick={() => onToggleSubtotalGroups(tag)}
          >
            <Calculator className="h-3.5 w-3.5" />
          </Button>
        </WithTooltip>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onEdit(tag)}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(tag)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2">
          {linkedSubtotalGroups === null ? (
            <p className="text-xs text-muted-foreground">読み込み中...</p>
          ) : linkedSubtotalGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              このタグが付いた小計点グループはありません。小計点グループ画面で付けられます。
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">
                小計点グループ
              </span>
              {linkedSubtotalGroups.map((tagSubtotalGroup) => (
                <Badge
                  key={tagSubtotalGroup.subtotalGroup.id}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {tagSubtotalGroup.subtotalGroup.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
