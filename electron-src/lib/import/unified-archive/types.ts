/**
 * 統合アーカイブ（.sao）の取り込みで、main の中だけが使う型
 */

import type { UnifiedArchiveManifest } from "../../../../src/types/unifiedArchive.types"

/** 開いて現行化したアーカイブ。一時ディレクトリの中を指す */
export interface OpenedUnifiedArchive {
  readonly manifest: UnifiedArchiveManifest
  /** 現行化済みの archive.db（一時ディレクトリ内） */
  readonly databasePath: string
  /** 展開した files/ の場所（無ければ空のディレクトリ） */
  readonly filesDirectory: string
  /** 現行化で当てた migration 名 */
  readonly appliedMigrations: readonly string[]
  /** 現行化で生まれた行（表名 → id）。現行化の前後で id 集合を比べた差。段階4で使う */
  readonly migratedRowIds: Readonly<Record<string, readonly string[]>>
}
