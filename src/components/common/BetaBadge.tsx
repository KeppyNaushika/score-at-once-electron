/**
 * まだ仕様が固まっていない機能に付ける「beta」の印。
 *
 * 同じ印を入口ごとに手で書くと、色や文字がすぐ食い違う。**印は1つだけ**にして、
 * 付ける場所を増やすときはこれを置く。見た目は既存の `Badge` の `outline` で、
 * 新しい色は作らない（目立たせるのは印ではなく、その横に置く注意書きの役目）。
 *
 * トーストのように React の要素を置けない文面には {@link BETA_ORIGIN_PREFIX} を使う。
 */
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * トーストの見出しに付ける、同期（beta）由来だと分かる印。
 *
 * トーストは同期以外の操作でも出るので、**どこから来た知らせか**が分からないと、
 * 利用者は自分の操作の結果だと読む。要素を置けないので文字で印を付ける。
 */
export const BETA_ORIGIN_PREFIX = "同期（beta）｜"

export function BetaBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("uppercase", className)}>
      beta
    </Badge>
  )
}
