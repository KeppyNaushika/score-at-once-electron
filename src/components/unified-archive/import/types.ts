/**
 * 統合アーカイブ（.sao）の取り込みウィザードの中で共有する型
 *
 * main から届く形は、IPC の戻り値（queries の関数）から推論で取る。決定（照合・衝突の
 * id の選択）の型は、使う側が main の core（`unified-archive/types`）から `import type` で引く。
 */

import type { UsingGradeDataSource } from "@/lib/shared/gradeReferenceMessages"
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
type ArchiveAnalysis = Extract<ArchiveAnalyzeOutcome, { kind: "ok" }>
export type ArchiveImportResult = ArchiveAnalysis["result"]
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

/**
 * この取り込みで値が変わる成績算出1件（`archiveGradeImpact.ts` が導き、確認の段が見せる）。
 * 取り込み先に既にある成績算出だけ（取り込みで新しく作られるものは載らない）
 */
export interface ArchiveGradeImpact {
  readonly grade: UsingGradeDataSource["gradeItem"]["grade"]
  /** 値が変わりそうな評価項目（並び順） */
  readonly items: readonly ArchiveGradeItemImpact[]
  /** 名簿（名簿の行・生徒・在籍・統計対象の学級）が変わる */
  readonly rosterChanged: boolean
  /** 成績算出そのものの設定（基準日・統計対象の学級の選び方）が変わる */
  readonly settingsChanged: boolean
}

export interface ArchiveGradeItemImpact {
  readonly gradeItem: UsingGradeDataSource["gradeItem"]
  /** 確定済み（1人でも）。確定した値は元データが変わっても変わらない */
  readonly frozen: boolean
  /** 確定した値そのもの（GradeFrozenScore）を置き換える */
  readonly frozenScoresReplaced: boolean
}
