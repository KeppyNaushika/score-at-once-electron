/**
 * ID統合インポート共通型定義
 */

import type { ArchiveDataCounts } from "../../../../src/types/examArchive.types"
import type prisma from "../../prisma/client"

/** IDマッピング */
export interface IdMappings {
  student: Record<string, string>
  classroom: Record<string, string>
  subtotalGroup: Record<string, string>
  subtotal: Record<string, string>
  exam: Record<string, string>
  examPage: Record<string, string>
  cropRegion: Record<string, string>
  studentAnswerImage: Record<string, string>
  examStudent: Record<string, string>
  userExam: Record<string, string>
  cropSubtotal: Record<string, string>
  questionScore: Record<string, string>
  drawingAnnotation: Record<string, string>
  membership: Record<string, string>
  cropRegionOmrConfig: Record<string, string>
  cropRegionOmrChoiceOption: Record<string, string>
  compoundAnswer: Record<string, string>
  compoundAnswerMember: Record<string, string>
  compoundAnswerScore: Record<string, string>
  scoreDecision: Record<string, string>
}

/** ID変更対象 */
export interface IdChangeTarget {
  category: "student" | "classroom" | "subtotalGroup"
  existingId: string
  newId: string
}

/** カウント */
export interface ImportCounts {
  created: ArchiveDataCounts
  updated: ArchiveDataCounts
  skipped: ArchiveDataCounts
  unchanged: ArchiveDataCounts
}

/** Prismaトランザクション型 */
export type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0]

/** 空のカウントを作成 */
export function createEmptyCounts(): ArchiveDataCounts {
  return {
    students: 0,
    classrooms: 0,
    users: 0,
    pages: 0,
    regions: 0,
    scores: 0,
    annotations: 0,
    subtotalGroups: 0,
    masterImages: 0,
    answerSheetImages: 0,
  }
}
