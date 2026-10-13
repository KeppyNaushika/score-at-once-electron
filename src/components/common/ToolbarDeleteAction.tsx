import { Trash } from "lucide-react"

import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { Button } from "@/components/ui/button"

/**
 * 詳細ページのヘッダー右に置く「削除」。並びでは控えめで、触れたときだけ赤く、
 * 「…」の中では最初から赤い項目にする。
 *
 * 学級の詳細と生徒の詳細が同じ2つの姿を書き並べていたのを1つにした。押したときに
 * 何をするか（確認を開く）は呼び手が決める。
 */
export function toolbarDeleteAction({
  onClick,
}: {
  onClick: () => void
}): ToolbarAction {
  return {
    id: "delete",
    priority: 10,
    node: (
      <Button
        variant="ghost"
        size="sm"
        className="rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        onClick={onClick}
      >
        <Trash className="mr-2 h-4 w-4" />
        削除
      </Button>
    ),
    collapsedNode: (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onClick}
      >
        <Trash className="mr-2 h-4 w-4" />
        削除
      </Button>
    ),
  }
}
