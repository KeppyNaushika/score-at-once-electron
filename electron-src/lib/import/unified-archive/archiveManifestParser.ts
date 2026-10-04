/**
 * 統合アーカイブ（.sao）の manifest.json を、実行時に検証して型へ絞る
 *
 * manifest は外から来たファイルなので、`JSON.parse` の結果を型と信じない（#1077 の趣旨）。
 * `unknown` から1項目ずつ確かめ、確かめた値だけで `UnifiedArchiveManifest` を組み直す。
 *
 * 形式の識別子と版は、形の検証より先に見る。新しい形式の版は形そのものが違いうるので、
 * 「形が違う」ではなく「この版は読めない」と言うため。
 */

import {
  type ArchiveOptionalItem,
  UNIFIED_ARCHIVE_FORMAT,
  UNIFIED_ARCHIVE_FORMAT_VERSION,
  type UnifiedArchiveManifest,
  type UnifiedArchiveMissingFile,
  type UnifiedArchiveScoringScope,
} from "../../../../src/types/unifiedArchive.types"

export type UnifiedArchiveManifestParseResult =
  | { readonly kind: "parsed"; readonly manifest: UnifiedArchiveManifest }
  | {
      readonly kind: "unsupportedFormat" | "invalidManifest"
      readonly details: readonly string[]
    }

/** 書き出し画面で選べる項目（`ArchiveOptionalItem`）の全部。型に足したらここにも足す */
const OPTIONAL_ITEMS: readonly ArchiveOptionalItem[] = [
  "userSettings",
  "appPreference",
  "auditLog",
]

const MISSING_FILE_REASONS: readonly UnifiedArchiveMissingFile["reason"][] = [
  "notFound",
  "outsideDataDirectory",
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * 項目を読みながら、形の違いを `problems` に溜める。違っていたら代わりの値を返すが、
 * 1つでも違いがあれば manifest は組まないので、代わりの値が外へ出ることはない
 */
class ManifestReader {
  readonly problems: string[] = []

  private fail(fieldPath: string, expected: string): void {
    this.problems.push(`${fieldPath}: ${expected}ではありません`)
  }

  record(value: unknown, fieldPath: string): Record<string, unknown> {
    if (isRecord(value)) return value
    this.fail(fieldPath, "オブジェクト")
    return {}
  }

  string(value: unknown, fieldPath: string): string {
    if (typeof value === "string") return value
    this.fail(fieldPath, "文字列")
    return ""
  }

  nullableString(value: unknown, fieldPath: string): string | null {
    if (value === null || typeof value === "string") return value
    this.fail(fieldPath, "文字列か null")
    return null
  }

  boolean(value: unknown, fieldPath: string): boolean {
    if (typeof value === "boolean") return value
    this.fail(fieldPath, "真偽値")
    return false
  }

  count(value: unknown, fieldPath: string): number {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      return value
    }
    this.fail(fieldPath, "0 以上の整数")
    return 0
  }

  isoTimestamp(value: unknown, fieldPath: string): string {
    const text = this.string(value, fieldPath)
    if (typeof value === "string" && Number.isNaN(Date.parse(text))) {
      this.fail(fieldPath, "日時の文字列")
    }
    return text
  }

  /** 表名 → id の一覧 */
  idsByTable(value: unknown, fieldPath: string): Record<string, string[]> {
    const idsByTable: Record<string, string[]> = {}
    for (const [table, ids] of Object.entries(this.record(value, fieldPath))) {
      if (!Array.isArray(ids)) {
        this.fail(`${fieldPath}.${table}`, "配列")
        continue
      }
      idsByTable[table] = ids.map((id, index) =>
        this.string(id, `${fieldPath}.${table}[${index}]`)
      )
    }
    return idsByTable
  }

  /** 表名 → 件数 */
  countsByTable(value: unknown, fieldPath: string): Record<string, number> {
    const countsByTable: Record<string, number> = {}
    for (const [table, count] of Object.entries(
      this.record(value, fieldPath)
    )) {
      countsByTable[table] = this.count(count, `${fieldPath}.${table}`)
    }
    return countsByTable
  }

  scoring(value: unknown, fieldPath: string): UnifiedArchiveScoringScope {
    const scoring = this.record(value, fieldPath)
    if (scoring.kind === "all") return { kind: "all" }
    if (scoring.kind === "self") {
      return {
        kind: "self",
        userId: this.string(scoring.userId, `${fieldPath}.userId`),
      }
    }
    this.fail(`${fieldPath}.kind`, '"all" か "self"')
    return { kind: "all" }
  }

  optionalItems(value: unknown, fieldPath: string): ArchiveOptionalItem[] {
    if (!Array.isArray(value)) {
      this.fail(fieldPath, "配列")
      return []
    }
    return value.flatMap((candidate: unknown, index) => {
      const optionalItem = OPTIONAL_ITEMS.find((item) => item === candidate)
      if (optionalItem) return [optionalItem]
      this.fail(
        `${fieldPath}[${index}]`,
        `${OPTIONAL_ITEMS.join(" / ")} のどれか`
      )
      return []
    })
  }

  missingFiles(value: unknown, fieldPath: string): UnifiedArchiveMissingFile[] {
    if (!Array.isArray(value)) {
      this.fail(fieldPath, "配列")
      return []
    }
    return value.flatMap((candidate: unknown, index) => {
      const missingFile = this.record(candidate, `${fieldPath}[${index}]`)
      const reason = MISSING_FILE_REASONS.find(
        (knownReason) => knownReason === missingFile.reason
      )
      if (!reason) {
        this.fail(
          `${fieldPath}[${index}].reason`,
          `${MISSING_FILE_REASONS.join(" / ")} のどれか`
        )
        return []
      }
      return [
        {
          path: this.string(missingFile.path, `${fieldPath}[${index}].path`),
          reason,
        },
      ]
    })
  }
}

/** `JSON.parse` した manifest.json を検証する */
export function parseUnifiedArchiveManifest(
  parsedJson: unknown
): UnifiedArchiveManifestParseResult {
  if (!isRecord(parsedJson)) {
    return {
      kind: "invalidManifest",
      details: ["manifest: オブジェクトではありません"],
    }
  }
  if (parsedJson.format !== UNIFIED_ARCHIVE_FORMAT) {
    return {
      kind: "unsupportedFormat",
      details: [`format が ${UNIFIED_ARCHIVE_FORMAT} ではありません`],
    }
  }
  const { formatVersion } = parsedJson
  if (
    typeof formatVersion !== "number" ||
    !Number.isInteger(formatVersion) ||
    formatVersion < 1
  ) {
    return {
      kind: "invalidManifest",
      details: ["formatVersion: 1 以上の整数ではありません"],
    }
  }
  if (formatVersion > UNIFIED_ARCHIVE_FORMAT_VERSION) {
    return {
      kind: "unsupportedFormat",
      details: [
        `formatVersion ${formatVersion} は、このアプリが読める版（${UNIFIED_ARCHIVE_FORMAT_VERSION}）より新しい`,
      ],
    }
  }

  const reader = new ManifestReader()
  const selection = reader.record(parsedJson.selection, "selection")
  const exclusions = reader.record(parsedJson.exclusions, "exclusions")
  const files = reader.record(parsedJson.files, "files")
  const manifest: UnifiedArchiveManifest = {
    format: UNIFIED_ARCHIVE_FORMAT,
    formatVersion,
    appVersion: reader.string(parsedJson.appVersion, "appVersion"),
    lastMigration: reader.nullableString(
      parsedJson.lastMigration,
      "lastMigration"
    ),
    exportedAt: reader.isoTimestamp(parsedJson.exportedAt, "exportedAt"),
    exportedByUserId: reader.nullableString(
      parsedJson.exportedByUserId,
      "exportedByUserId"
    ),
    selection: {
      roots: reader.idsByTable(selection.roots, "selection.roots"),
      shared: reader.idsByTable(selection.shared, "selection.shared"),
      scoring: reader.scoring(selection.scoring, "selection.scoring"),
      includeAnswers: reader.boolean(
        selection.includeAnswers,
        "selection.includeAnswers"
      ),
      optionalItems: reader.optionalItems(
        selection.optionalItems,
        "selection.optionalItems"
      ),
    },
    exclusions: {
      requested: reader.idsByTable(
        exclusions.requested,
        "exclusions.requested"
      ),
      excludedRowCounts: reader.countsByTable(
        exclusions.excludedRowCounts,
        "exclusions.excludedRowCounts"
      ),
    },
    rowCounts: reader.countsByTable(parsedJson.rowCounts, "rowCounts"),
    files: {
      count: reader.count(files.count, "files.count"),
      missing: reader.missingFiles(files.missing, "files.missing"),
    },
  }
  if (reader.problems.length > 0) {
    return { kind: "invalidManifest", details: reader.problems }
  }
  return { kind: "parsed", manifest }
}
