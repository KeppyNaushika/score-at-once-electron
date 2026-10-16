"use client"

import { ListTree, SquarePen, Trash } from "lucide-react"
import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SubtotalGroupRow } from "@/queries/subtotal"

interface SubtotalGroupCardProps {
  group: SubtotalGroupRow
  onEdit: () => void
  onDelete: () => void
  /** 並べ替えのつまみ。カードの見出しの先頭に置く */
  dragHandle: React.ReactNode
}

export function SubtotalGroupCard({
  group,
  onEdit,
  onDelete,
  dragHandle,
}: SubtotalGroupCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {dragHandle}
            <ListTree className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{group.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* タグ */}
          {group.tagSubtotalGroups.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {group.tagSubtotalGroups.map((tagSubtotalGroup) => (
                <Badge
                  key={tagSubtotalGroup.tag.id}
                  variant="outline"
                  className="text-xs font-normal"
                  style={
                    tagSubtotalGroup.tag.color
                      ? {
                          borderColor: tagSubtotalGroup.tag.color,
                          color: tagSubtotalGroup.tag.color,
                        }
                      : undefined
                  }
                >
                  {tagSubtotalGroup.tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* 統計情報 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">小計項目数</span>
              <Badge variant="outline">{group.subtotals.length}項目</Badge>
            </div>

            {/* 使用試験数 */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">利用試験</span>
              <Badge
                variant={
                  group.examSubtotalGroups.length > 0 ? "default" : "secondary"
                }
                className="text-xs"
              >
                {group.examSubtotalGroups.length}件
              </Badge>
            </div>
          </div>

          {/* 小計項目一覧 */}
          {group.subtotals.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                小計項目
              </div>
              <div className="space-y-1">
                {group.subtotals
                  .sort(
                    (subtotalA, subtotalB) => subtotalA.order - subtotalB.order
                  )
                  .slice(0, 3)
                  .map((subtotal) => (
                    <div
                      key={subtotal.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">{subtotal.name}</span>
                      {subtotal.markColor !== null && (
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border"
                          style={{ backgroundColor: subtotal.markColor }}
                          title={`採点マークの色 ${subtotal.markColor}`}
                        />
                      )}
                    </div>
                  ))}
                {group.subtotals.length > 3 && (
                  <div className="text-center text-xs text-muted-foreground">
                    他{group.subtotals.length - 3}項目
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 作成日 */}
          <div className="border-t pt-2 text-xs text-muted-foreground">
            作成: {group.createdAt.toLocaleDateString("ja-JP")}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
