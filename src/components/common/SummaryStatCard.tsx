import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SummaryStatCardProps {
  icon: LucideIcon
  title: string
  /** 出す数。無いときは「—」 */
  value: number | null
  /** 数のあとに小さく添える単位（名・回・%・pt） */
  unit: string
  /** 数と単位の色。無ければ既定の文字色（単位は控えめ） */
  valueClassName?: string
  unitClassName?: string
}

/**
 * 詳細画面の上に並べる、見出しと大きな数1つのカード。
 * 学級の詳細と生徒の詳細が同じ姿で書き並べていたのを1つにした。
 */
export function SummaryStatCard({
  icon: Icon,
  title,
  value,
  unit,
  valueClassName,
  unitClassName = "text-muted-foreground",
}: SummaryStatCardProps) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold tabular-nums", valueClassName)}>
          {value != null ? (
            <>
              {value}
              <span className={cn("ml-1 text-lg font-normal", unitClassName)}>
                {unit}
              </span>
            </>
          ) : (
            <span className="text-lg font-normal text-muted-foreground">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
