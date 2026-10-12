"use client"

import { ArchiveImportScreens } from "@/components/archive-import/ArchiveImportScreens"
import { UnifiedArchiveExportDialog } from "@/components/unified-archive/export/UnifiedArchiveExportDialog"

import type { EntityListArchive } from "./useEntityListArchive"

/** 一覧の .sao 書き出しの窓と、読み込みの画面（`useEntityListArchive` の状態を描く） */
export function EntityListArchiveDialogs({
  archive,
}: {
  archive: EntityListArchive
}) {
  return (
    <>
      <UnifiedArchiveExportDialog
        open={archive.unifiedExportSelection !== null}
        onOpenChange={(open) => {
          if (!open) archive.closeUnifiedExport()
        }}
        initialSelection={archive.unifiedExportSelection ?? {}}
      />

      <ArchiveImportScreens launcher={archive.importLauncher} />
    </>
  )
}
