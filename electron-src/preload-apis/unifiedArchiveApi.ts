import type { UnifiedArchiveExportPhase } from "../lib/export/unified-archive/unifiedArchiveCreator"
import { bind } from "./invoke"
import { subscribe } from "./subscribe"

/** 統合アーカイブ（.sao）の書き出し・取り込みの IPC API */
export function createUnifiedArchiveApi() {
  return {
    unifiedArchive: {
      previewExport: bind("unifiedArchive:previewExport"),
      selectExportPath: bind("unifiedArchive:selectExportPath"),
      export: bind("unifiedArchive:export"),
      selectImportFile: bind("unifiedArchive:selectImportFile"),
      open: bind("unifiedArchive:open"),
      analyze: bind("unifiedArchive:analyze"),
      import: bind("unifiedArchive:import"),
      close: bind("unifiedArchive:close"),

      /** 書き出しの段（範囲を決める・DB を書く・詰める）が進んだら呼ばれる購読を張る */
      onExportProgress: (
        callback: (phase: UnifiedArchiveExportPhase) => void
      ) => subscribe("unifiedArchive:export-progress", callback),
    },
  }
}
