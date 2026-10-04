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

export type ArchiveIdChoice = "existing" | "archive"
/** 照合で id が一致しなかった共通の実体を、どう扱うか */
export type ArchiveMatchDecision =
  | {
      readonly kind: "same"
      readonly existingId: string
      readonly adoptId: ArchiveIdChoice
    } // 同じもの。adoptId=archive は取り込み先の id をアーカイブの id へ付け替える（今の ID 統合 = idChangeExecutor の後継。設計 §9）
  | { readonly kind: "new" } // 新しく作る（既定）
  | { readonly kind: "skip" } // 取り込まない。この行を必須で参照する行も取り込まない（任意の参照は NULL）
export interface UnifiedArchiveImportDecisions {
  /** 一意制約の衝突で採用する id。既定 "existing" */
  readonly conflictIdChoice?: ArchiveIdChoice
  /** 1件ずつの上書き。キーは `${table}:${archiveId}` */
  readonly conflictIdOverrides?: Readonly<Record<string, ArchiveIdChoice>>
  /** 照合の決定。キーは `${table}:${archiveId}`。無ければ new */
  readonly matches?: Readonly<Record<string, ArchiveMatchDecision>>
}
export const archiveRowKey = (table: string, id: string): string =>
  `${table}:${id}`
