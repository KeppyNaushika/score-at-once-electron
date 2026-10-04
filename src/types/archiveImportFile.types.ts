/**
 * 一覧の「読み込み」で選べるファイルの種類（docs/unified-archive-design.md §7.6）
 *
 * 統合アーカイブ（.sao）と、読み込みだけ残した旧形式の5種、試験の取り込みが受け付ける
 * 外部の形式（.hsz・.dat）。種類は拡張子で決まり、種類ごとに開く取り込み画面が決まる。
 * 拡張子と種類の名前は同じ（.dat だけは中身を見て、リアテンダント™の形式でなければ
 * .score として扱う。旧の試験の取り込みと同じ）。
 */
export const ARCHIVE_IMPORT_FILE_KINDS = [
  "sao",
  "score",
  "hsz",
  "dat",
  "coursework",
  "grade",
  "asb",
  "students",
] as const

export type ArchiveImportFileKind = (typeof ARCHIVE_IMPORT_FILE_KINDS)[number]

/** 選ばれたファイル。種類が分からない拡張子なら kind は null */
export interface SelectedArchiveImportFile {
  path: string
  kind: ArchiveImportFileKind | null
}
