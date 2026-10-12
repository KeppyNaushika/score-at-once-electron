import { column, identifier, table } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const SYNC_TYPES = "electron-src/lib/sync/types.ts"

export const DATA_TERM_IDS = [
  "unifiedArchive",
  "legacyArchiveFormats",
  "archiveImport",
  "idIntegration",
  "storageMode",
  "sharedProfile",
  "sync",
  "syncRecordFold",
  "syncParentDeleted",
  "auditLog",
  "userPreference",
  "appPreference",
  "pdfTools",
] as const
export type DataTermId = (typeof DATA_TERM_IDS)[number]

export const DATA_CATEGORY: GlossaryCategory<DataTermId> = {
  id: "data",
  termIds: DATA_TERM_IDS,
  codeRefs: {
    unifiedArchive: [
      identifier(
        "UNIFIED_ARCHIVE_EXTENSION",
        "src/types/unifiedArchive.types.ts"
      ),
    ],
    legacyArchiveFormats: [
      identifier(
        "ArchiveImportFileKind",
        "src/types/archiveImportFile.types.ts"
      ),
    ],
    archiveImport: [
      identifier("ImportAction", "src/types/importAction.types.ts"),
    ],
    idIntegration: [
      identifier(
        "ArchiveIdChoice",
        "electron-src/lib/import/unified-archive/types.ts"
      ),
    ],
    storageMode: [identifier("StorageMode", SYNC_TYPES)],
    sharedProfile: [identifier("SharedProfile", SYNC_TYPES)],
    sync: [identifier("SyncAppConfig", SYNC_TYPES)],
    syncRecordFold: [identifier("SyncRecordFold", SYNC_TYPES)],
    syncParentDeleted: [identifier("SyncParentDeleted", SYNC_TYPES)],
    auditLog: [
      table("AuditLog"),
      table("AuditLogTarget"),
      column("AuditLog", "action"),
    ],
    userPreference: [table("UserPreference")],
    appPreference: [table("AppPreference")],
    pdfTools: [identifier("PDF_EXPORT_MODES", "src/types/pdfTools.types.ts")],
  },
}
