"use client"

import { Calculator, Edit, Trash2 } from "lucide-react"

import type { SubtotalGroup } from "@/components/subtotal-groups/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SubtotalGroupCardProps {
  group: SubtotalGroup
  onEdit: () => void
  onDelete: () => void
}

export function SubtotalGroupCard({
  group,
  onEdit,
  onDelete,
}: SubtotalGroupCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{group.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 統計情報 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">小計項目数</span>
              <Badge variant="outline">{group.subtotals.length}項目</Badge>
            </div>

            {/* 使用試験数 */}
            {group.examSubtotalGroups && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">利用試験</span>
                <Badge
                  variant={
                    group.examSubtotalGroups.length > 0
                      ? "default"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {group.examSubtotalGroups.length}件
                </Badge>
              </div>
            )}
          </div>

          {/* 小計項目一覧 */}
          {group.subtotals.length > 0 && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm font-medium">
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
                    </div>
                  ))}
                {group.subtotals.length > 3 && (
                  <div className="text-muted-foreground text-center text-xs">
                    他{group.subtotals.length - 3}項目
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 作成日 */}
          <div className="text-muted-foreground border-t pt-2 text-xs">
            作成: {new Date(group.createdAt).toLocaleDateString("ja-JP")}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
