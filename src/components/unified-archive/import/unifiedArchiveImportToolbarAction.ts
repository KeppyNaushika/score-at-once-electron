import { FolderInput } from "lucide-react"

import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"

/**
 * 一覧のツールバーの「.sao 読み込み」。試験・資料・成績算出・解答用紙定義・生徒の
 * 5つの一覧に同じものを置く（どこから開いても同じ統合アーカイブを取り込む）。
 * ウィザード（UnifiedArchiveImportWizard）は各一覧が1つ持ち、これで開く。
 */
export function unifiedArchiveImportToolbarAction({
  priority,
  onClick,
}: {
  priority: number
  onClick: () => void
}): ToolbarAction {
  return toolbarButtonAction({
    id: "unified-archive-import",
    priority,
    icon: FolderInput,
    label: ".sao 読み込み",
    onClick,
  })
}
