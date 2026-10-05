"use client"

import { GuardedLink } from "@/components/common/GuardedLink"
import { AI_PRICING_TAB_HREF } from "@/lib/aiUsageCost"
import { cn } from "@/lib/utils"

interface AiPricingTabLinkProps {
  className?: string
}

/**
 * 「AI採点」の画面の「料金」タブへのリンク。単価未設定のモデルがあるときに添える
 * （07 の見積もり・試験の費用と、使用トークンのタブが使う）
 */
export function AiPricingTabLink({ className }: AiPricingTabLinkProps) {
  return (
    <GuardedLink
      href={AI_PRICING_TAB_HREF}
      className={cn(
        "underline underline-offset-2 hover:text-foreground",
        className
      )}
    >
      単価を入れる
    </GuardedLink>
  )
}
