import type { ReactNode } from "react"

/**
 * 押す前に知っておくべき注意の枠（橙）。削除・名簿から外す確認で、成績算出への
 * 影響を見せるのに使う。確認の説明文（`<p>`）の中にも置けるよう `span` で描く。
 */
export function CautionNotice({ children }: { children: ReactNode }) {
  return (
    <span className="block rounded-md border border-orange-200 bg-orange-50 p-3 text-sm whitespace-pre-line text-orange-800">
      {children}
    </span>
  )
}
