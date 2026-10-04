/**
 * 統合アーカイブ（.sao）の形式の型と定数
 *
 * 設計は docs/unified-archive-design.md §4。ZIP の中身は manifest.json・archive.db・files/。
 * スキーマの版は archive.db の `_prisma_migrations` そのもので、ここには持たない。
 */

export const UNIFIED_ARCHIVE_FORMAT = "score-at-once-archive"
/** ZIP の構成が変わったときだけ上げる。スキーマの版ではない */
export const UNIFIED_ARCHIVE_FORMAT_VERSION = 1
export const UNIFIED_ARCHIVE_EXTENSION = ".sao"
export const UNIFIED_ARCHIVE_MANIFEST_NAME = "manifest.json"
export const UNIFIED_ARCHIVE_DATABASE_NAME = "archive.db"
/** ZIP 内では `files/<DB に入っているデータディレクトリからの相対パス>` に置く */
export const UNIFIED_ARCHIVE_FILES_DIR = "files"

/** 書き出し画面で選べる項目（docs §5.5） */
export type ArchiveOptionalItem = "userSettings" | "appPreference" | "auditLog"

/** 採点の範囲。本人分のときは、他の教員の採点・確定・返却版などを外す（docs §5.3） */
export type UnifiedArchiveScoringScope =
  { readonly kind: "all" } | { readonly kind: "self"; readonly userId: string }

/** DB が指しているのに同梱できなかったファイル */
export interface UnifiedArchiveMissingFile {
  /** DB に入っているパスそのもの */
  path: string
  /** notFound: データディレクトリに無い / outsideDataDirectory: 絶対パスや `..` で外を指す */
  reason: "notFound" | "outsideDataDirectory"
}

export interface UnifiedArchiveManifest {
  format: typeof UNIFIED_ARCHIVE_FORMAT
  formatVersion: number
  appVersion: string
  /** archive.db に適用済みの最後の migration 名（`_prisma_migrations` が無ければ null） */
  lastMigration: string | null
  /** ISO 8601 */
  exportedAt: string
  exportedByUserId: string | null
  selection: {
    /** 表名 → id（空の表は載せない） */
    roots: Record<string, string[]>
    shared: Record<string, string[]>
    /** 既定（全員分）でも明示して書く */
    scoring: UnifiedArchiveScoringScope
    /** 既定（含める）でも明示して書く */
    includeAnswers: boolean
    optionalItems: ArchiveOptionalItem[]
  }
  /** 利用者が外したもの。取り込み側は「含まれていない」と示し、削除とは読まない（docs §7.1） */
  exclusions: {
    /** 利用者が外した行（表名 → id） */
    requested: Record<string, string[]>
    /** 外したことで入らなくなった行の数（表名 → 件数） */
    excludedRowCounts: Record<string, number>
  }
  /** archive.db の表ごとの行数。0 の表と `_prisma_migrations` は載せない */
  rowCounts: Record<string, number>
  files: { count: number; missing: UnifiedArchiveMissingFile[] }
}
