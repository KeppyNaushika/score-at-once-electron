import { useMemo, useState } from "react"

import { archiveImportToolbarAction } from "@/components/archive-import/archiveImportToolbarAction"
import { useArchiveImportLauncher } from "@/components/archive-import/hooks/useArchiveImportLauncher"
import type { UnifiedArchiveExportInitialSelection } from "@/components/unified-archive/export/types"

/**
 * 一覧の「読み込み」と「.sao 書き出し」の状態をまとめて持つ。
 *
 * 4つの一覧はどれも、読み込みの起動（ヘッダー右の「読み込み」）と、行の「…」から
 * 開く .sao 書き出しを同じ形で持っていた。窓は `EntityListArchiveDialogs` が描く。
 */
export function useEntityListArchive() {
  const importLauncher = useArchiveImportLauncher()
  const { start: startArchiveImport, isOpening: isOpeningArchive } =
    importLauncher
  /** .sao 書き出しを開いたときの最初の選択。null の間は閉じている */
  const [unifiedExportSelection, setUnifiedExportSelection] =
    useState<UnifiedArchiveExportInitialSelection | null>(null)

  /** ヘッダー右の「読み込み」。並びの中での優先度は4画面とも 70 */
  const importToolbarAction = useMemo(
    () =>
      archiveImportToolbarAction({
        priority: 70,
        isOpening: isOpeningArchive,
        onClick: () => void startArchiveImport(),
      }),
    [isOpeningArchive, startArchiveImport]
  )

  return {
    importLauncher,
    importToolbarAction,
    unifiedExportSelection,
    /** .sao 書き出しを、この選択を初期値にして開く */
    openUnifiedExport: setUnifiedExportSelection,
    closeUnifiedExport: () => setUnifiedExportSelection(null),
  }
}

export type EntityListArchive = ReturnType<typeof useEntityListArchive>
