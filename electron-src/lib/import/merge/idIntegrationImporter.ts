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
import { createImportValuePolicy } from "./importValuePolicy"
import {
  processClassroomIdIntegration,
  processStudentIdIntegration,
  processSubtotalGroupIdIntegration,
  processUserIdIntegration,
} from "./processors"
import {
  reorderExamClassrooms,
  reorderExamStudents,
  reorderSubtotals,
} from "./reorderAfterImport"
import { rewriteAsSeparateExam } from "./separateExamRewriter"
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
 * @param archiveData - 展開されたアーカイブデータ
 * @param archivePreMatchResult - 事前照合結果
 * @param integrationConfig - ID統合設定（ユーザーの選択。試験ID一致時の扱いもここ）
 * @param currentUserId - 現在ログインしているユーザーID
 * @returns インポート結果
 */
export async function executeIdIntegrationImport(
  archiveData: ExtractedArchiveData,
  archivePreMatchResult: FileOverviewData,
  integrationConfig: IdIntegrationConfig,
  currentUserId: string
): Promise<IdIntegrationImportResult> {
  // 取り込みの方針は人が最初に1回だけ選ぶ（上書きする / 統合する / 別で追加する）。
  // 省略時は統合。**この1つが取り込む全レコードの全ての値に効く**。
  const examAction = integrationConfig.exam ?? "merge"
  const policy = createImportValuePolicy(examAction)

  // 「別で追加する」を選んだときは、DBへ触る前に試験配下の id を振り直す。
  // 振り直した後のデータは「一度も取り込んでいないアーカイブ」と同じ形になるので、
  // 事前照合の試験の欄も一致なしへ倒し、後段は新規作成の道を通す。
  const importAsSeparateExam =
    (archivePreMatchResult.exam?.isIdMatch ?? false) &&
    examAction === "separate"
  const data = importAsSeparateExam
    ? rewriteAsSeparateExam(archiveData)
    : archiveData
  const preMatchResult: FileOverviewData = importAsSeparateExam
    ? {
        ...archivePreMatchResult,
        // 採点の競合は「同じ試験の同じ設問に別の採点がある」ことなので、別物として
        // 取り込む以上どれも競合しない（全部が新しい採点として入る）
        scoringConflicts: undefined,
        exam: archivePreMatchResult.exam && {
          ...archivePreMatchResult.exam,
          isIdMatch: false,
          existingExamId: undefined,
          existingData: undefined,
          importExamId: data.examData.exam.id,
        },
      }
    : archivePreMatchResult

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
    user: {},
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
          policy,
          tx
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
          policy,
          tx
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
          policy,
          tx
        )

        // 3b. 採点者（利用者）のID統合処理。**採点より前に張る必要がある** —
        // 採点行を引く鍵が (設問, 受験者, 採点者) の3つ組で、その3つ目がこれ
        await processUserIdIntegration(
          data,
          preMatchResult,
          integrationConfig.user,
          idMappings,
          counts,
          warnings,
          policy,
          tx
        )

        // 4. 小計のマージ
        const { groupIdsWithOrderWritten } = await processSubtotals(
          data,
          idMappings,
          warnings,
          policy,
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
          policy,
          tx
        )

        // 6. UserExam
        await processUserExam(
          isExamIdMatch,
          newExamId,
          currentUserId,
          policy,
          tx
        )

        // 7. ExamSubtotalGroup
        await processExamSubtotalGroups(data, newExamId, idMappings, policy, tx)

        // 8. ExamStudent
        const examStudentResult = await processExamStudents(
          data,
          isExamIdMatch,
          newExamId,
          idMappings,
          policy,
          tx
        )

        // 9. ExamPage（不一致時のみ）
        if (!isExamIdMatch) {
          await processExamPages(
            data,
            newExamId,
            idMappings,
            counts,
            policy,
            tx
          )
        }

        // 10. CropRegion（不一致時のみ）
        if (!isExamIdMatch) {
          await processCropRegions(data, idMappings, counts, policy, tx)
        }

        // 10a. ExamMarkingFormat (v1.4.0+)

        // 10b. ExamExportSettings (v1.4.0+)
        await processExamExportSettings(data, newExamId, policy, tx)

        // 10c. Tag & TagSubtotalGroup & ExamTag (v1.10.0+, 旧Subject)
        await processTags(data, idMappings, warnings, policy, tx)

        // 10d. ExamClassroom (v1.1.0+)
        const examClassroomResult = await processExamClassrooms(
          data,
          newExamId,
          idMappings,
          policy,
          tx
        )

        // 10e. OMR設定（CropRegionOmrConfig/ChoiceOption） (v1.7.0+)
        await processOmrConfigs(data, idMappings, policy, tx)

        // 10f. 複合解答（CompoundAnswer/Member） (v1.11.0+)
        await processCompoundAnswers(data, idMappings, policy, tx)

        // 11. CropSubtotal
        await processCropSubtotals(
          data,
          isExamIdMatch,
          idMappings,
          warnings,
          policy,
          tx
        )

        // 12. QuestionScore（(設問, 受験者, 採点者) の3つ組で行を引く）
        warnings.push(
          ...(await processQuestionScores(
            data,
            currentUserId,
            idMappings,
            counts,
            policy,
            tx
          ))
        )

        // 12b. ScoreDecision（OWNER確定スコア。decidedAt LWWで競合解決） (v1.13.0+)
        warnings.push(
          ...(await processScoreDecisions(
            data,
            currentUserId,
            idMappings,
            counts,
            policy,
            tx
          ))
        )

        // 12c. CompoundAnswerScore（複合解答スコア。updatedAt LWWで競合解決） (v1.11.0+)
        warnings.push(
          ...(await processCompoundAnswerScores(
            data,
            currentUserId,
            idMappings,
            counts,
            policy,
            tx
          ))
        )

        // 12d. CropRegionAssignment（設問ごとの採点担当。usernameで照合） (v1.20.0+)
        warnings.push(
          ...(await processCropRegionAssignments(
            data,
            currentUserId,
            idMappings,
            counts,
            policy,
            tx
          ))
        )

        // 12e. ReturnSnapshot（返却版スナップショット。capturedAt LWWで競合解決） (v1.14.0+)
        warnings.push(
          ...(await processReturnSnapshots(
            data,
            idMappings,
            counts,
            policy,
            tx
          ))
        )

        // 13. DrawingAnnotation
        await processDrawingAnnotations(data, idMappings, counts, policy, tx)

        // 14. 学級所属
        await processMemberships(
          data.classesData.memberships,
          idMappings,
          policy,
          tx
        )

        // 15. ID変更処理（「書き出したPCに合わせる」を選んだ場合）
        if (idChangeTargets.length > 0) {
          await executeIdChanges(idChangeTargets, idMappings, warnings, tx)
        }

        // 16. 画像レコード作成（DB操作のみ）
        await createImportImageRecords(data, idMappings, policy, tx)

        // 17. 並び順の詰め直し
        //
        // 並び順は列全体の性質なので、行ごとの規則で入れた値には重複と穴ができる。
        // **並び順の列へ書き込んだときだけ**詰め直す —— 作成だけでなく更新も数える。
        // 上書き／統合は既存行の customOrder / order もアーカイブの値へ書き換えるので、
        // 行が1つも増えない取り込みでも番号は重なったまま残る。
        //
        // 何も書いていない取り込みで走らせないのは、触っていない名簿の updatedAt を
        // 動かさないため（詰め直し自体も、既に 1..n の連番なら1行も書かない）。
        if (examStudentResult.orderWrittenCount > 0) {
          await reorderExamStudents(newExamId, tx)
        }
        if (examClassroomResult.orderWrittenCount > 0) {
          await reorderExamClassrooms(newExamId, tx)
        }
        for (const subtotalGroupId of groupIdsWithOrderWritten) {
          await reorderSubtotals(subtotalGroupId, tx)
        }
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
