/**
 * ID統合インポートモジュール
 *
 * 新しいインポートフロー（Step 3: ID統合）に基づいてデータをインポート
 *
 * 2段階処理:
 * 1. マッピング段階: .scoreのIDを既存IDにマッピングしてデータ挿入
 * 2. ID変更段階: 「書き出したPCに合わせる」を選んだ場合、既存IDを.scoreのIDに変更
 *
 * エンティティ別の挿入ロジックはドメイン単位で別モジュールへ分割している:
 * - importExamCore: Exam根・ExamPage・CropRegion・参加情報
 * - importSubtotals: Subtotal・CropSubtotal
 * - importExamAttachments: 採点マーク/出力設定・OMR・複合解答構造・タグ・学級関連
 * - importScoring: QuestionScore・ScoreDecision・CompoundAnswerScore
 * - importSyncRecords: DrawingAnnotation・Membership
 */

import type {
  ArchiveDataCounts,
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../../../src/types/examArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { executeIdChanges } from "./idChangeExecutor"
import { copyImportImages, createImportImageRecords } from "./imageImporter"
import {
  processCompoundAnswers,
  processExamClassrooms,
  processExamExportSettings,
  processOmrConfigs,
  processTags,
} from "./importExamAttachments"
import {
  processCropRegions,
  processExam,
  processExamPages,
  processExamStudents,
  processExamSubtotalGroups,
  processUserExam,
} from "./importExamCore"
import {
  processCompoundAnswerScores,
  processCropRegionAssignments,
  processQuestionScores,
  processReturnSnapshots,
  processScoreDecisions,
} from "./importScoring"
import { processCropSubtotals, processSubtotals } from "./importSubtotals"
import {
  processDrawingAnnotations,
  processMemberships,
} from "./importSyncRecords"
import {
  processClassroomIdIntegration,
  processStudentIdIntegration,
  processSubtotalGroupIdIntegration,
} from "./processors"
import type { IdChangeTarget, IdMappings, ImportCounts } from "./types"
import { createEmptyCounts } from "./types"

/** インポート結果 */
interface IdIntegrationImportResult {
  examId: string
  summary: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
    unchanged: ArchiveDataCounts
  }
  warnings: string[]
}

/**
 * ID統合インポートを実行
 *
 * @param data - 展開されたアーカイブデータ
 * @param preMatchResult - 事前照合結果
 * @param integrationConfig - ID統合設定（ユーザーの選択）
 * @param currentUserId - 現在ログインしているユーザーID
 * @param scoringConflictConfig - 採点結果の競合解決設定
 * @param updateDecisions - フィールド更新決定（ユーザーの選択）
 * @returns インポート結果
 */
export async function executeIdIntegrationImport(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  integrationConfig: IdIntegrationConfig,
  currentUserId: string,
  scoringConflictConfig?: ScoringConflictConfig,
  updateDecisions?: UpdateDecisions
): Promise<IdIntegrationImportResult> {
  // 旧バージョンアーカイブの変換チェーン警告を結果へ引き継ぐ
  const warnings: string[] = [...data.transformWarnings]
  const counts: ImportCounts = {
    created: createEmptyCounts(),
    updated: createEmptyCounts(),
    skipped: createEmptyCounts(),
    unchanged: createEmptyCounts(),
  }

  const idMappings: IdMappings = {
    student: {},
    classroom: {},
    subtotalGroup: {},
    subtotal: {},
    exam: {},
    examPage: {},
    cropRegion: {},
    studentAnswerImage: {},
    examStudent: {},
    userExam: {},
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

  // ID変更が必要なもの（Stage 2で処理）
  const idChangeTargets: IdChangeTarget[] = []

  try {
    // ========================================================================
    // Stage 1: マッピングとデータ挿入
    // ========================================================================
    await prisma.$transaction(
      async (tx) => {
        // 1. 生徒のID統合処理
        await processStudentIdIntegration(
          data,
          preMatchResult,
          integrationConfig.student,
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          tx,
          updateDecisions
        )

        // 2. 学級のID統合処理
        await processClassroomIdIntegration(
          data,
          preMatchResult,
          integrationConfig.classroom,
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          tx,
          updateDecisions
        )

        // 3. 小計グループのID統合処理
        await processSubtotalGroupIdIntegration(
          data,
          preMatchResult,
          integrationConfig.subtotalGroup,
          idMappings,
          idChangeTargets,
          counts,
          warnings,
          tx,
          updateDecisions
        )

        // 4. 小計のマージ
        await processSubtotals(
          data,
          idMappings,
          warnings,
          tx,
          integrationConfig.subtotalMappings
        )

        // 5. 試験処理
        const isExamIdMatch = preMatchResult.exam?.isIdMatch ?? false
        const newExamId = await processExam(
          data,
          preMatchResult,
          idMappings,
          counts,
          warnings,
          tx
        )

        // 6. UserExam
        await processUserExam(isExamIdMatch, newExamId, currentUserId, tx)

        // 7. ExamSubtotalGroup
        await processExamSubtotalGroups(data, newExamId, idMappings, tx)

        // 8. ExamStudent
        await processExamStudents(
          data,
          isExamIdMatch,
          newExamId,
          idMappings,
          tx
        )

        // 9. ExamPage（不一致時のみ）
        if (!isExamIdMatch) {
          await processExamPages(data, newExamId, idMappings, counts, tx)
        }

        // 10. CropRegion（不一致時のみ）
        if (!isExamIdMatch) {
          await processCropRegions(data, idMappings, counts, tx)
        }

        // 10a. ExamMarkingFormat (v1.4.0+)

        // 10b. ExamExportSettings (v1.4.0+)
        await processExamExportSettings(data, newExamId, tx)

        // 10c. Tag & TagSubtotalGroup & ExamTag (v1.10.0+, 旧Subject)
        await processTags(data, idMappings, warnings, tx)

        // 10d. ExamClassroom (v1.1.0+)
        await processExamClassrooms(data, newExamId, idMappings, tx)

        // 10e. OMR設定（CropRegionOmrConfig/ChoiceOption） (v1.7.0+)
        await processOmrConfigs(data, idMappings, tx)

        // 10f. 複合解答（CompoundAnswer/Member） (v1.11.0+)
        await processCompoundAnswers(data, idMappings, tx)

        // 11. CropSubtotal
        await processCropSubtotals(
          data,
          isExamIdMatch,
          idMappings,
          warnings,
          tx
        )

        // 12. QuestionScore（競合解決対応）
        await processQuestionScores(
          data,
          preMatchResult,
          currentUserId,
          idMappings,
          counts,
          scoringConflictConfig,
          tx
        )

        // 12b. ScoreDecision（OWNER確定スコア。decidedAt LWWで競合解決） (v1.13.0+)
        await processScoreDecisions(data, currentUserId, idMappings, counts, tx)

        // 12c. CompoundAnswerScore（複合解答スコア。updatedAt LWWで競合解決） (v1.11.0+)
        await processCompoundAnswerScores(
          data,
          currentUserId,
          idMappings,
          counts,
          tx
        )

        // 12d. CropRegionAssignment（設問ごとの採点担当。usernameで照合） (v1.20.0+)
        warnings.push(
          ...(await processCropRegionAssignments(
            data,
            currentUserId,
            idMappings,
            counts,
            tx
          ))
        )

        // 12e. ReturnSnapshot（返却版スナップショット。capturedAt LWWで競合解決） (v1.14.0+)
        warnings.push(
          ...(await processReturnSnapshots(data, idMappings, counts, tx))
        )

        // 13. DrawingAnnotation
        await processDrawingAnnotations(data, idMappings, counts, tx)

        // 14. 学級所属
        await processMemberships(data.classesData.memberships, idMappings, tx)

        // 15. ID変更処理（「書き出したPCに合わせる」を選んだ場合）
        if (idChangeTargets.length > 0) {
          await executeIdChanges(idChangeTargets, idMappings, warnings, tx)
        }

        // 16. 画像レコード作成（DB操作のみ）
        await createImportImageRecords(data, idMappings, tx)
      },
      { timeout: 60000 }
    )

    // ========================================================================
    // 画像ファイルのコピー（ファイルI/O - トランザクション外）
    // ========================================================================
    const newExamId = idMappings.exam[data.examData.exam.id]
    try {
      await copyImportImages(data, newExamId)
    } catch (copyError) {
      warnings.push(
        "画像ファイルのコピーに一部失敗しました。再インポートで修復可能です。"
      )
      console.error("Image copy failed:", copyError)
    }

    // 監査ログ: 試験インポート
    const importedExamName = data.examData.exam.examName
    await recordAuditLog({
      action: "exam.import",
      userId: currentUserId,
      entityType: "Exam",
      entityId: newExamId,
      scopeId: newExamId,
      scopeLabel: importedExamName,
      target: importedExamName,
    })

    return { examId: newExamId, summary: counts, warnings }
  } catch (error) {
    console.error("Error executing ID integration import:", error)
    throw error
  }
}
