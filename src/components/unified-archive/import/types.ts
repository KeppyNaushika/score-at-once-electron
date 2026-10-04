/**
 * 統合アーカイブ（.sao）の取り込みウィザードの中で共有する型
 *
 * main から届く形は、IPC の戻り値（queries の関数）から推論で取る。決定（照合・衝突の
 * id の選択）の型は、使う側が main の core（`unified-archive/types`）から `import type` で引く。
 */

import type {
  analyzeUnifiedArchiveImport,
  importUnifiedArchiveMutation,
  openUnifiedArchive,
} from "@/queries/unifiedArchive"

/** ウィザードの段（並び＝画面の並び） */
export const ARCHIVE_IMPORT_STEPS = [
  "fileSelect",
  "overview",
  "match",
  "conflict",
  "confirm",
  "execute",
] as const
export type ArchiveImportStep = (typeof ARCHIVE_IMPORT_STEPS)[number]

type OpenResult = Awaited<ReturnType<typeof openUnifiedArchive>>
/** 開けたアーカイブ（manifest・照合の候補・初期値） */
export type OpenedUnifiedArchive = Extract<OpenResult, { kind: "opened" }>
/** 開けなかった理由 */
export type RejectedUnifiedArchive = Extract<OpenResult, { kind: "rejected" }>
export type ArchiveMatchCandidate =
  OpenedUnifiedArchive["matchCandidates"][number]

/** 試し取り込みの結果 */
export type ArchiveAnalyzeOutcome = Awaited<
  ReturnType<typeof analyzeUnifiedArchiveImport>
>
export type ArchiveImportResult = Extract<
  ArchiveAnalyzeOutcome,
  { kind: "ok" }
>["result"]
export type ArchiveUniqueConflict =
  ArchiveImportResult["uniqueConflicts"][number]
export type ArchiveUnresolvableReason = Extract<
  ArchiveAnalyzeOutcome,
  { kind: "unresolvable" }
>["reasons"][number]

/** 取り込みの結果 */
export type ArchiveImportOutcome = Awaited<
  ReturnType<
    NonNullable<ReturnType<typeof importUnifiedArchiveMutation>["mutationFn"]>
  >
>
