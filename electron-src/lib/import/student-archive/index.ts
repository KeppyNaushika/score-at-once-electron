/**
 * 生徒アーカイブ インポート機能
 *
 * .studentsファイルから生徒・学級データをインポート
 * 既存の試験アーカイブインポートのマッチング・プロセッサーロジックを再利用
 */

import type { UpdateDecisions } from "../../../../src/types/examArchive.types"
import type {
  StudentArchiveFileOverviewData,
  StudentArchiveIdIntegrationConfig,
  StudentArchiveImportResult,
  StudentArchiveManifest,
} from "../../../../src/types/studentArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { executeIdChanges } from "../merge/idChangeExecutor"
import { processMemberships } from "../merge/importSyncRecords"
import { preMatchClassrooms } from "../merge/matchers/classroomMatcher"
import { preMatchStudents } from "../merge/matchers/studentMatcher"
import {
  processClassroomIdIntegration,
  processStudentIdIntegration,
} from "../merge/processors"
import type { IdChangeTarget, IdMappings } from "../merge/types"
import { transformStudentToLatest } from "../student-transformers"
import type { ExtractedStudentArchiveData } from "./archiveExtractor"

/**
 * ExtractedStudentArchiveData を ExtractedArchiveData 互換のオブジェクトに変換
 *
 * preMatchStudents/preMatchClassrooms は ExtractedArchiveData を受け取るため、
 * 必要なフィールドのみを持つ互換オブジェクトを作成する
 */
function toCompatibleData(
  data: ExtractedStudentArchiveData
): Pick<ExtractedArchiveData, "studentsData" | "classesData"> {
  return {
    studentsData: data.studentsData,
    classesData: data.classesData,
  }
}

/**
 * マニフェストを解析（Step 1）
 */
export function analyzeStudentArchive(manifest: StudentArchiveManifest): {
  success: boolean
  manifest: StudentArchiveManifest
} {
  return { success: true, manifest }
}

/**
 * 事前照合を実行（Step 2）
 */
export async function performStudentPreMatching(
  rawData: ExtractedStudentArchiveData
): Promise<StudentArchiveFileOverviewData> {
  const { data } = transformStudentToLatest(rawData)
  const compatData = toCompatibleData(data)
  const [studentResult, classroomResult] = await Promise.all([
    preMatchStudents(compatData as ExtractedArchiveData),
    preMatchClassrooms(compatData as ExtractedArchiveData),
  ])

  return {
    student: studentResult,
    classroom: classroomResult,
  }
}

/**
 * 生徒アーカイブのインポートを実行（Step 6）
 */
export async function executeStudentImport(
  rawData: ExtractedStudentArchiveData,
  preMatchResult: StudentArchiveFileOverviewData,
  integrationConfig: StudentArchiveIdIntegrationConfig,
  updateDecisions?: UpdateDecisions
): Promise<StudentArchiveImportResult> {
  const { data, warnings: transformWarnings } =
    transformStudentToLatest(rawData)
  const warnings: string[] = [...transformWarnings]
  const counts = {
    created: { students: 0, classrooms: 0, memberships: 0 },
    updated: { students: 0, classrooms: 0, memberships: 0 },
    skipped: { students: 0, classrooms: 0, memberships: 0 },
    unchanged: { students: 0, classrooms: 0, memberships: 0 },
  }

  // ArchiveDataCounts互換のカウント（プロセッサーが使用）
  const archiveCounts = {
    created: createEmptyArchiveCounts(),
    updated: createEmptyArchiveCounts(),
    skipped: createEmptyArchiveCounts(),
    unchanged: createEmptyArchiveCounts(),
  }

  const idMappings: IdMappings = {
    student: {},
    classroom: {},
    subtotalGroup: {},
    subtotal: {},
    exam: {},
    examPage: {},
    cropRegion: {},
    masterImage: {},
    studentAnswerImage: {},
    examStudent: {},
    userExam: {},
    examSubtotalGroup: {},
    cropSubtotal: {},
    questionScore: {},
    drawingAnnotation: {},
    membership: {},
    cropRegionOmrConfig: {},
    cropRegionOmrChoiceOption: {},
    compoundAnswer: {},
    compoundAnswerMember: {},
    compoundAnswerScore: {},
    scoreDecision: {},
  }

  const idChangeTargets: IdChangeTarget[] = []

  // FileOverviewData互換に変換（プロセッサーが使用）
  const compatPreMatch = {
    student: preMatchResult.student,
    classroom: preMatchResult.classroom,
    subtotalGroup: { byId: [], noMatch: [] },
  }

  const compatData = toCompatibleData(data)

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. 生徒のID統合処理
        await processStudentIdIntegration(
          compatData as ExtractedArchiveData,
          compatPreMatch,
          integrationConfig.student,
          idMappings,
          idChangeTargets,
          archiveCounts,
          warnings,
          tx,
          updateDecisions
        )

        // 2. 学級のID統合処理
        await processClassroomIdIntegration(
          compatData as ExtractedArchiveData,
          compatPreMatch,
          integrationConfig.classroom,
          idMappings,
          idChangeTargets,
          archiveCounts,
          warnings,
          tx,
          updateDecisions
        )

        // 3. 学級所属の処理
        await processMemberships(data.classesData.memberships, idMappings, tx)

        // 4. ID変更処理
        if (idChangeTargets.length > 0) {
          await executeIdChanges(idChangeTargets, idMappings, warnings, tx)
        }
      },
      { timeout: 60000 }
    )

    // archiveCounts → counts に変換
    counts.created.students = archiveCounts.created.students
    counts.created.classrooms = archiveCounts.created.classrooms
    counts.updated.students = archiveCounts.updated.students
    counts.updated.classrooms = archiveCounts.updated.classrooms
    counts.skipped.students = archiveCounts.skipped.students
    counts.skipped.classrooms = archiveCounts.skipped.classrooms
    counts.unchanged.students = archiveCounts.unchanged.students
    counts.unchanged.classrooms = archiveCounts.unchanged.classrooms

    // memberships のカウントはprocessMembershipでは集計されないため
    // idMappings.membership のサイズで推定
    counts.created.memberships = Object.keys(idMappings.membership).length

    const importedStudents = counts.created.students + counts.updated.students
    await recordAuditLog({
      action: "student.import",
      entityType: "Student",
      entityId: "student-archive",
      summary: `生徒を${importedStudents}名インポートしました`,
      extra: { counts },
    })

    return {
      success: true,
      summary: counts,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error("Error executing student import:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "インポートに失敗しました",
    }
  }
}

function createEmptyArchiveCounts() {
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

export {
  cleanupStudentTempDir,
  extractStudentArchive,
} from "./archiveExtractor"
