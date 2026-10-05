/**
 * 研究・実験のための機能に付ける「実験的機能」の印（AI 採点。設計 §9-1）。
 *
 * 同意したあとも、AI 採点の入口・送信の確認には必ずこの印を置く。beta（仕様が
 * 固まっていない）とは意味が違うので `BetaBadge` とは分ける。
 */
import { FlaskConical } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ExperimentalBadgeProps {
  className?: string
  /** 印の文字。既定は「実験的機能」（サイドバーなど狭いところでは「実験的」） */
  label?: string
  /**
   * 色の強さ。既定は橙。サイドバーでは、その項目を開いていないあいだ灰色で目立たせない
   * （開いているときだけ橙）
   */
  tone?: "default" | "muted"
}

export function ExperimentalBadge({
  className,
  label = "実験的機能",
  tone = "default",
}: ExperimentalBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        tone === "muted"
          ? "border-muted-foreground/40 text-muted-foreground"
          : "border-amber-400 text-amber-700",
        className
      )}
    >
      <FlaskConical />
      {label}
    </Badge>
  )
}
