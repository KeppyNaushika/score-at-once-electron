/**
 * 研究・実験のための機能に付ける「実験的機能」の印（AI 採点。設計 §9-1）。
 *
 * 同意したあとも、AI 採点の入口・送信の確認には必ずこの印を置く。beta（仕様が
 * 固まっていない）とは意味が違うので `BetaBadge` とは分ける。
 */
import { FlaskConical } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function ExperimentalBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-amber-400 text-amber-700", className)}
    >
      <FlaskConical />
      実験的機能
    </Badge>
  )
}
