/**
 * ID統合インポート共通型定義
 */

import type { ArchiveDataCounts } from "../../../../types/projectArchive.types"
import type prisma from "../../prisma/client"

/** IDマッピング */
export interface IdMappings {
  student: Record<string, string>
  class: Record<string, string>
  subtotalGroup: Record<string, string>
  subtotal: Record<string, string>
  project: Record<string, string>
  projectPage: Record<string, string>
  cropRegion: Record<string, string>
  masterImage: Record<string, string>
  studentAnswerImage: Record<string, string>
  projectStudent: Record<string, string>
  userProject: Record<string, string>
  projectSubtotalGroup: Record<string, string>
  cropSubtotal: Record<string, string>
  questionScore: Record<string, string>
  drawingAnnotation: Record<string, string>
  membership: Record<string, string>
}

/** ID変更対象 */
export interface IdChangeTarget {
  category: "student" | "class" | "subtotalGroup"
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
    classes: 0,
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
