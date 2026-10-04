/**
 * 取り込みウィザードの文言。main は理由の種類・鍵の識別子・生の行を返すので、
 * 人に見せる言葉と行の呼び名はここで作る。
 */

import type { UnifiedArchiveOpenErrorKind } from "@/electron-src/lib/import/unified-archive/archiveOpener"
import type { UnifiedArchiveUnresolvableKind } from "@/electron-src/lib/import/unified-archive/archiveRowImporter"

/** 開けなかった理由（`unifiedArchive:open` の rejected） */
export const ARCHIVE_REJECTION_MESSAGES: Record<
  UnifiedArchiveOpenErrorKind,
  string
> = {
  notArchive:
    "統合アーカイブ（.sao）のファイルではありません。別の種類のファイルか、ファイルが壊れています。",
  invalidManifest:
    "アーカイブの説明書き（manifest.json）の形が正しくありません。ファイルが壊れている可能性があります。",
  unsupportedFormat:
    "このバージョンのアプリでは読めない形式です。アプリを更新してから開いてください。",
  newerSchema:
    "新しいバージョンのアプリで書き出されています。アプリを更新してから開いてください。",
  corrupt:
    "アーカイブのデータベースが壊れています。書き出し直したファイルで試してください。",
  unsafeSchema:
    "アーカイブのデータベースに想定外の仕掛け（トリガー・ビュー）があるため、開きませんでした。",
  schemaMismatch:
    "アーカイブのデータベースを、このアプリのデータの形に揃えられませんでした。",
}

/** 解けない衝突の種類（`unresolvable` の reasons） */
export const ARCHIVE_UNRESOLVABLE_MESSAGES: Record<
  UnifiedArchiveUnresolvableKind,
  string
> = {
  multipleExisting: "読み込む1件が、このパソコンの複数の行と同じ値になります。",
  sharedExisting:
    "読み込む複数の行が、このパソコンの同じ1行に寄せられます（紐づけの選び方を見直してください）。",
  replacementCollides: "置き換えると、このパソコンの別の行と同じ値になります。",
  duplicateInArchive:
    "紐づけの結果、アーカイブの中の複数の行が同じ値になります（紐づけの選び方を見直してください）。",
  idTaken:
    "付け替え先のアーカイブの id が、このパソコンで既に使われています（「このパソコンの id」を選んでください）。",
  matchTargetMissing: "紐づけ先に選んだ行が、このパソコンにありません。",
  renameInSeparate:
    "「別で追加する」では、このパソコンの行をアーカイブの id に付け替えられません。",
}

/** 生の行の1列を文字にする（文字でも数でもなければ空） */
export function rowText(
  row: Readonly<Record<string, unknown>>,
  column: string
): string {
  const columnValue = row[column]
  if (typeof columnValue === "string") return columnValue
  if (typeof columnValue === "number" || typeof columnValue === "bigint") {
    return String(columnValue)
  }
  return ""
}

/** 照合の表（生徒・学級・小計グループ・利用者）の行の呼び名 */
export function matchRowLabel(
  table: string,
  row: Readonly<Record<string, unknown>>
): string {
  switch (table) {
    case "Student": {
      const fullName = `${rowText(row, "lastName")} ${rowText(row, "firstName")}`
      const studentNumber = rowText(row, "studentNumber")
      return studentNumber ? `${fullName} (${studentNumber})` : fullName
    }
    case "User": {
      const name = rowText(row, "name")
      const username = rowText(row, "username")
      return name === username || !username ? name : `${name}（${username}）`
    }
    default:
      return rowText(row, "name")
  }
}

/** 同じ名前の候補を見分けるための添え書き（生徒の読み、学級のコード・学年など） */
export function matchRowDetail(
  table: string,
  row: Readonly<Record<string, unknown>>
): string {
  const parts = (() => {
    switch (table) {
      case "Student":
        return [
          `${rowText(row, "lastNameKana")} ${rowText(row, "firstNameKana")}`.trim(),
        ]
      case "Classroom": {
        const grade = rowText(row, "grade")
        return [
          rowText(row, "classroomCode"),
          grade ? `${grade}年` : "",
          rowText(row, "description"),
        ]
      }
      case "SubtotalGroup":
        return [rowText(row, "description")]
      default:
        return []
    }
  })()
  return parts.filter((part) => part !== "").join("・")
}

/** 照合の候補を選ぶ Combobox の絞り込み語（表示はしないが打てば引っかかる） */
export function matchRowKeywords(
  table: string,
  row: Readonly<Record<string, unknown>>
): string[] {
  switch (table) {
    case "Student":
      return [
        rowText(row, "studentNumber"),
        `${rowText(row, "lastNameKana")} ${rowText(row, "firstNameKana")}`,
        `${rowText(row, "lastNameKana")}${rowText(row, "firstNameKana")}`,
      ]
    case "Classroom":
      return [rowText(row, "classroomCode"), rowText(row, "description")]
    case "User":
      return [rowText(row, "username")]
    default:
      return []
  }
}

/** 照合で当たった鍵の説明（`matchedBy`） */
export function matchedByLabel(
  table: string,
  matchedBy: string | null
): string {
  switch (matchedBy) {
    case "studentNumber":
      return "学籍番号が一致"
    case "name":
      return table === "Student" ? "姓名が一致" : "名前が一致"
    case "username":
      return "利用者名が一致"
    case null:
      return "このパソコンに同じものなし"
    default:
      return matchedBy
  }
}

/**
 * 一意キーの1列の値を見せる形にする。`…Id` の列は id そのものなので先頭だけ見せる
 * （同じ値かどうかが分かれば足りる）
 */
export function uniqueKeyValueText(
  row: Readonly<Record<string, unknown>>,
  column: string
): string {
  const text = rowText(row, column)
  if (text === "") return "（空）"
  return column.endsWith("Id") && text.length > 8
    ? `${text.slice(0, 8)}…`
    : text
}

/** manifest の時刻（ISO 8601）を見せる形にする */
export function formatArchiveDateTime(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  return Number.isNaN(parsed.getTime())
    ? isoDateTime
    : parsed.toLocaleString("ja-JP")
}
