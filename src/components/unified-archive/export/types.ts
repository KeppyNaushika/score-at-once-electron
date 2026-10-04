import type { ArchivePreviewEntityTable } from "@/electron-src/lib/export/unified-archive/archiveExportPreview"
import type { ArchiveSelectableSharedTable } from "@/electron-src/lib/export/unified-archive/archiveScopeResolver"
import type { ArchiveRootTable } from "@/electron-src/lib/export/unified-archive/archiveTableRegistry"
import type { ArchiveOptionalItem } from "@/types/unifiedArchive.types"

/** 根の種（選ぶと配下が丸ごと入る）。画面に並べる順 */
export const ARCHIVE_ROOT_KINDS: readonly ArchiveRootTable[] = [
  "Exam",
  "Coursework",
  "Grade",
  "AsbDefinition",
]

/** 利用者が直接選べる共通の実体。画面に並べる順 */
export const ARCHIVE_SHARED_KINDS: readonly ArchiveSelectableSharedTable[] = [
  "Student",
  "Classroom",
  "SubtotalGroup",
  "Tag",
]

/** 一覧から選べる実体の種（根と共通の実体） */
export type ArchiveSelectableKind =
  ArchiveRootTable | ArchiveSelectableSharedTable

/** 選べる種の全部。画面に並べる順 */
export const ARCHIVE_SELECTABLE_KINDS: readonly ArchiveSelectableKind[] = [
  ...ARCHIVE_ROOT_KINDS,
  ...ARCHIVE_SHARED_KINDS,
]

/** 名前を引く実体の種（利用者は選べないが、含まれる人として並べる） */
export type ArchiveEntityKind = ArchivePreviewEntityTable

/**
 * 書き出しダイアログを開いたときに最初から入っている実体（押した画面の実体）。
 * 生徒表からは生徒だけを渡す。
 */
export interface UnifiedArchiveExportInitialSelection {
  roots?: Partial<Record<ArchiveRootTable, string[]>>
  shared?: { Student?: string[] }
}

/** ダイアログが持つ選択。書き出しの `ArchiveSelection` はここから作る */
export interface ExportSelectionState {
  /** 利用者が一覧から選んだ実体（種 → id。並びは足した順） */
  picked: Record<ArchiveSelectableKind, string[]>
  /** 関連して入るもののうち、利用者が外した実体（種 → id） */
  excluded: Record<ArchiveSelectableKind, string[]>
  /** 採点の範囲。本人分は今の利用者の採点だけ */
  scoringKind: "all" | "self"
  /** 受験生・採点・答案を含めるか */
  includeAnswers: boolean
  /** 選べる項目（既定は含めない） */
  optionalItems: ArchiveOptionalItem[]
}
