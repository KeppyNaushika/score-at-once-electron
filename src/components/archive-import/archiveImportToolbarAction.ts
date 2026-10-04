import { FolderInput } from "lucide-react"

import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"

/**
 * 一覧のツールバーの「読み込み」。試験・資料・成績算出・解答用紙定義・生徒の5つの一覧に
 * 同じものを置く。どの一覧から押しても全ての形式を受け付け、選んだファイルの拡張子で
 * 開く取り込み画面が決まる（`useArchiveImportLauncher`）。
 */
export function archiveImportToolbarAction({
  priority,
  isOpening,
  onClick,
}: {
  priority: number
  /** 選んだファイルを開いている間（押せなくして、開いていることを見せる） */
  isOpening: boolean
  onClick: () => void
}): ToolbarAction {
  return toolbarButtonAction({
    id: "archive-import",
    priority,
    icon: FolderInput,
    label: isOpening ? "開いています..." : "読み込み",
    onClick,
    disabled: isOpening,
  })
}
