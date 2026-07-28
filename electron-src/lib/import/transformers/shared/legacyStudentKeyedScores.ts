/**
 * 1.21.0 より前のアーカイブ形状（採点層が Student 直結）の型。
 *
 * `ArchiveScoresData` / `ArchiveExamData` は常に**最新版**の形を表すため、
 * 1.21.0 で `studentId` → `examStudentId` へ配線変更した後は、それ以前を扱う
 * 変換器（V1_1_0_to_V1_2_0 / V1_12_0_to_V1_13_0）が最新版の型では書けなくなる。
 * そこで「その変換器が実際に触るデータの形」をここに明示して使う。
 *
 * 最新版へ揃えるのは V1_20_0_to_V1_21_0 の仕事であり、それより手前の変換器は
 * この旧形状のまま次の変換器へ渡してよい（チェーンが順に適用される）。
 */

import type { ArchiveScoresData } from "../../../../../src/types/examArchive.types"

/** examStudentId を studentId に差し替える（1.21.0 より前の形） */
type StudentKeyed<T extends { examStudentId: string }> = Omit<
  T,
  "examStudentId"
> & { studentId: string }

export type LegacyQuestionScore = StudentKeyed<
  ArchiveScoresData["questionScores"][number]
>

export type LegacyScoreDecision = StudentKeyed<
  NonNullable<ArchiveScoresData["scoreDecisions"]>[number]
>

/** 1.21.0 より前の scores.json */
export type LegacyScoresData = Omit<
  ArchiveScoresData,
  "questionScores" | "scoreDecisions"
> & {
  questionScores: LegacyQuestionScore[]
  scoreDecisions?: LegacyScoreDecision[]
}
