/**
 * ID統合インポートモジュール
 *
 * 新しいインポートフロー（Step 3: ID統合）に基づいてデータをインポート
 *
 * 2段階処理:
 * 1. マッピング段階: .scoreのIDを既存IDにマッピングしてデータ挿入
 * 2. ID変更段階: 「書き出したPCに合わせる」を選んだ場合、既存IDを.scoreのIDに変更
 */

import { randomUUID } from "crypto"

import type {
  ArchiveClassesData,
  ArchiveDataCounts,
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../../../src/types/examArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { resolveExamClassOutputFlags } from "../examClassFlags"
import { isNewerByLww } from "./decisionMergePolicy"
import { executeIdChanges } from "./idChangeExecutor"
import { copyImportImages, createImportImageRecords } from "./imageImporter"
import {
  processClassIdIntegration,
  processStudentIdIntegration,
  processSubtotalGroupIdIntegration,
} from "./processors"
import { resolveScoringConflict } from "./scoringConflictResolver"
import type { IdChangeTarget, IdMappings, ImportCounts } from "./types"
import { createEmptyCounts } from "./types"

/** インポート結果 */
export interface IdIntegrationImportResult {
  success: boolean
  examId?: string
  summary?: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
    unchanged: ArchiveDataCounts
  }
  warnings?: string[]
  error?: string
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
  const warnings: string[] = []
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
        await processClassIdIntegration(
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
        await processExamMarkingFormats(data, newExamId, tx)

        // 10b. ExamExportSettings (v1.4.0+)
        await processExamExportSettings(data, newExamId, tx)

        // 10c. CropRegionMarkingOverride (v1.4.0+)
        await processCropRegionMarkingOverrides(data, idMappings, tx)

        // 10d. Tag & TagSubtotalGroup & ExamTag (v1.10.0+, 旧Subject)
        await processTags(data, idMappings, tx)

        // 10e. ExamClass (v1.1.0+)
        await processExamClasses(data, newExamId, idMappings, tx)

        // 10f. OMR設定（CropRegionOmrConfig/ChoiceOption/DigitBox） (v1.7.0+/v1.11.0+)
        await processOmrConfigs(data, idMappings, tx)

        // 10g. 複合解答（CompoundAnswer/Member） (v1.11.0+)
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

        // 12a. 削除記録の処理（tombstone伝搬）
        await processDeletedRecords(data, tx)

        // 13. DrawingAnnotation（tombstoneチェック付き）
        await processDrawingAnnotations(
          data,
          currentUserId,
          idMappings,
          counts,
          tx
        )

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

    return {
      success: true,
      examId: newExamId,
      summary: counts,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error("Error executing ID integration import:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "インポートに失敗しました",
    }
  }
}

// =============================================================================
// 内部処理関数
// =============================================================================

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function processSubtotals(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  warnings: string[],
  tx: Tx,
  subtotalMappings?: Record<string, string>
): Promise<void> {
  // スキップされた小計をグループ別に集計
  const skippedByGroup: Record<string, string[]> = {}

  for (const subtotal of data.subtotalsData.subtotals) {
    const newGroupId = idMappings.subtotalGroup[subtotal.subtotalGroupId]
    if (!newGroupId) {
      // グループがスキップされた → 配下の小計もスキップ
      const groupName =
        data.subtotalsData.subtotalGroups.find(
          (subtotalGroup) => subtotalGroup.id === subtotal.subtotalGroupId
        )?.name ?? subtotal.subtotalGroupId
      if (!skippedByGroup[groupName]) skippedByGroup[groupName] = []
      skippedByGroup[groupName].push(subtotal.name)
      continue
    }

    // 1. 明示的なマッピングがあれば使う
    const explicitTarget = subtotalMappings?.[subtotal.id]
    if (explicitTarget && explicitTarget !== "__new__") {
      // 既存の小計項目に直接結びつけ
      idMappings.subtotal[subtotal.id] = explicitTarget
      continue
    }

    // 2. "__new__" の場合は新規作成を強制
    if (explicitTarget === "__new__") {
      await createNewSubtotal(subtotal, newGroupId, idMappings, tx)
      continue
    }

    // 3. マッピング未設定（デフォルト動作: 従来の名前ベース自動マッチ）
    const existing = await tx.subtotal.findFirst({
      where: { subtotalGroupId: newGroupId, name: subtotal.name },
    })

    if (!existing) {
      const existingById = await tx.subtotal.findUnique({
        where: { id: subtotal.id },
      })
      if (existingById) {
        idMappings.subtotal[subtotal.id] = subtotal.id
      } else {
        await tx.subtotal.create({
          data: {
            id: subtotal.id,
            name: subtotal.name,
            subtotalGroupId: newGroupId,
            order: subtotal.order,
          },
        })
        idMappings.subtotal[subtotal.id] = subtotal.id
      }
    } else {
      idMappings.subtotal[subtotal.id] = existing.id
    }
  }

  // スキップされた小計の警告を出力
  for (const [groupName, subtotalNames] of Object.entries(skippedByGroup)) {
    warnings.push(
      `小計グループ「${groupName}」がスキップされたため、配下の小計項目（${subtotalNames.join("、")}）もスキップされました`
    )
  }
}

/**
 * 小計項目を新規作成（名前重複時はサフィックス付き）
 */
async function createNewSubtotal(
  subtotal: ExtractedArchiveData["subtotalsData"]["subtotals"][0],
  newGroupId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  // 同名の小計が既にあるかチェック
  const existingWithName = await tx.subtotal.findFirst({
    where: { subtotalGroupId: newGroupId, name: subtotal.name },
  })

  let finalName = subtotal.name
  if (existingWithName) {
    // サフィックス付きで新規作成
    for (let i = 2; i <= 100; i++) {
      const candidate = `${subtotal.name} (${i})`
      const dup = await tx.subtotal.findFirst({
        where: { subtotalGroupId: newGroupId, name: candidate },
      })
      if (!dup) {
        finalName = candidate
        break
      }
    }
  }

  const existingById = await tx.subtotal.findUnique({
    where: { id: subtotal.id },
  })
  const newId = existingById ? randomUUID() : subtotal.id

  await tx.subtotal.create({
    data: {
      id: newId,
      name: finalName,
      subtotalGroupId: newGroupId,
      order: subtotal.order,
    },
  })
  idMappings.subtotal[subtotal.id] = newId
}

async function processExam(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  idMappings: IdMappings,
  counts: ImportCounts,
  warnings: string[],
  tx: Tx
): Promise<string> {
  const exam = data.examData.exam
  const isExamIdMatch = preMatchResult.exam?.isIdMatch ?? false

  if (isExamIdMatch && preMatchResult.exam?.existingExamId) {
    // 試験ID一致 → 既存試験を使用（マージ）
    const newExamId = preMatchResult.exam.existingExamId
    idMappings.exam[exam.id] = newExamId

    // 既存のExamPageとCropRegionをID一致でマッピング
    await mapExistingExamPages(data, newExamId, idMappings, counts, tx)
    await mapExistingCropRegions(data, newExamId, idMappings, counts, tx)

    return newExamId
  }

  // 試験ID不一致 → 新規作成
  const existingById = await tx.exam.findUnique({
    where: { id: exam.id },
  })
  if (existingById) {
    idMappings.exam[exam.id] = exam.id
    warnings.push(
      `試験ID「${exam.id}」は既に使用されています。既存試験にデータがマージされます。`
    )
    return exam.id
  }
  await tx.exam.create({
    data: {
      id: exam.id,
      examName: exam.examName,
      examDate: exam.examDate ? new Date(exam.examDate) : null,
      description: exam.description,
    },
  })
  idMappings.exam[exam.id] = exam.id
  return exam.id
}

async function mapExistingExamPages(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  const existingExamPages = await tx.examPage.findMany({
    where: { examId: newExamId },
  })
  const existingPageIds = new Set(existingExamPages.map((page) => page.id))

  for (const page of data.examData.examPages) {
    if (existingPageIds.has(page.id)) {
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
    } else {
      const existingById = await tx.examPage.findUnique({
        where: { id: page.id },
      })
      if (existingById) {
        idMappings.examPage[page.id] = page.id
        counts.unchanged.pages++
      } else {
        await tx.examPage.create({
          data: {
            id: page.id,
            examId: newExamId,
            pageNumber: page.pageNumber,
          },
        })
        idMappings.examPage[page.id] = page.id
        counts.created.pages++
      }
    }
  }
}

async function mapExistingCropRegions(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  const existingCropRegions = await tx.cropRegion.findMany({
    where: {
      examPage: { examId: newExamId },
    },
  })
  const existingRegionIds = new Set(
    existingCropRegions.map((cropRegion) => cropRegion.id)
  )

  for (const region of data.examData.cropRegions) {
    const mappedPageId = idMappings.examPage[region.examPageId]
    if (!mappedPageId) continue

    if (existingRegionIds.has(region.id)) {
      idMappings.cropRegion[region.id] = region.id
      counts.unchanged.regions++
    } else {
      const existingById = await tx.cropRegion.findUnique({
        where: { id: region.id },
      })
      if (existingById) {
        idMappings.cropRegion[region.id] = region.id
        counts.unchanged.regions++
      } else {
        await tx.cropRegion.create({
          data: {
            id: region.id,
            examPageId: mappedPageId,
            label: region.label,
            type: region.type,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            points: region.points,
            orderIndex: region.orderIndex,
          },
        })
        idMappings.cropRegion[region.id] = region.id
        counts.created.regions++
      }
    }
  }
}

async function processUserExam(
  isExamIdMatch: boolean,
  newExamId: string,
  currentUserId: string,
  tx: Tx
): Promise<void> {
  if (isExamIdMatch) {
    const existingUserExam = await tx.userExam.findUnique({
      where: {
        userId_examId: {
          userId: currentUserId,
          examId: newExamId,
        },
      },
    })
    if (!existingUserExam) {
      await tx.userExam.create({
        data: {
          id: randomUUID(),
          userId: currentUserId,
          examId: newExamId,
          role: "MEMBER",
          invitedAt: new Date(),
          invitedBy: null,
        },
      })
    }
  } else {
    await tx.userExam.create({
      data: {
        id: randomUUID(),
        userId: currentUserId,
        examId: newExamId,
        role: "OWNER",
        invitedAt: new Date(),
        invitedBy: null,
      },
    })
  }
}

async function processExamSubtotalGroups(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const examSubtotalGroup of data.examData.examSubtotalGroups) {
    const newGroupId =
      idMappings.subtotalGroup[examSubtotalGroup.subtotalGroupId]
    if (newGroupId) {
      const existing = await tx.examSubtotalGroup.findFirst({
        where: { examId: newExamId, subtotalGroupId: newGroupId },
      })
      if (existing) {
        idMappings.examSubtotalGroup[examSubtotalGroup.id] = existing.id
      } else {
        const existingById = await tx.examSubtotalGroup.findUnique({
          where: { id: examSubtotalGroup.id },
        })
        if (existingById) {
          idMappings.examSubtotalGroup[examSubtotalGroup.id] =
            examSubtotalGroup.id
        } else {
          await tx.examSubtotalGroup.create({
            data: {
              id: examSubtotalGroup.id,
              examId: newExamId,
              subtotalGroupId: newGroupId,
              selectedForTable: examSubtotalGroup.selectedForTable ?? false,
              selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
            },
          })
          idMappings.examSubtotalGroup[examSubtotalGroup.id] =
            examSubtotalGroup.id
        }
      }
    }
  }
}

async function processExamStudents(
  data: ExtractedArchiveData,
  isExamIdMatch: boolean,
  newExamId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const examStudent of data.examData.examStudents) {
    const newStudentId = idMappings.student[examStudent.studentId]
    if (newStudentId) {
      if (isExamIdMatch) {
        const existing = await tx.examStudent.findFirst({
          where: { examId: newExamId, studentId: newStudentId },
        })
        if (existing) {
          idMappings.examStudent[examStudent.id] = existing.id
          continue
        }
      }

      const existingById = await tx.examStudent.findUnique({
        where: { id: examStudent.id },
      })
      if (existingById) {
        idMappings.examStudent[examStudent.id] = examStudent.id
      } else {
        await tx.examStudent.create({
          data: {
            id: examStudent.id,
            examId: newExamId,
            studentId: newStudentId,
            status: examStudent.status,
            customOrder: examStudent.customOrder,
          },
        })
        idMappings.examStudent[examStudent.id] = examStudent.id
      }
    }
  }
}

async function processExamPages(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const page of data.examData.examPages) {
    const existingById = await tx.examPage.findUnique({
      where: { id: page.id },
    })
    if (existingById) {
      idMappings.examPage[page.id] = page.id
      counts.unchanged.pages++
    } else {
      await tx.examPage.create({
        data: {
          id: page.id,
          examId: newExamId,
          pageNumber: page.pageNumber,
        },
      })
      idMappings.examPage[page.id] = page.id
      counts.created.pages++
    }
  }
}

async function processCropRegions(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const region of data.examData.cropRegions) {
    const newPageId = idMappings.examPage[region.examPageId]
    if (newPageId) {
      const existingById = await tx.cropRegion.findUnique({
        where: { id: region.id },
      })
      if (existingById) {
        idMappings.cropRegion[region.id] = region.id
        counts.unchanged.regions++
      } else {
        await tx.cropRegion.create({
          data: {
            id: region.id,
            examPageId: newPageId,
            label: region.label,
            type: region.type,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            points: region.points,
            orderIndex: region.orderIndex,
          },
        })
        idMappings.cropRegion[region.id] = region.id
        counts.created.regions++
      }
    }
  }
}

async function processCropSubtotals(
  data: ExtractedArchiveData,
  isExamIdMatch: boolean,
  idMappings: IdMappings,
  warnings: string[],
  tx: Tx
): Promise<void> {
  let skippedCount = 0

  for (const cropSubtotal of data.subtotalsData.cropSubtotals) {
    const newRegionId = idMappings.cropRegion[cropSubtotal.cropRegionId]
    const newSubtotalId = idMappings.subtotal[cropSubtotal.subtotalId]
    if (newRegionId && newSubtotalId) {
      if (isExamIdMatch) {
        const existing = await tx.cropSubtotal.findFirst({
          where: { cropRegionId: newRegionId, subtotalId: newSubtotalId },
        })
        if (existing) {
          idMappings.cropSubtotal[cropSubtotal.id] = existing.id
          continue
        }
      }

      const existingById = await tx.cropSubtotal.findUnique({
        where: { id: cropSubtotal.id },
      })
      if (existingById) {
        idMappings.cropSubtotal[cropSubtotal.id] = cropSubtotal.id
      } else {
        await tx.cropSubtotal.create({
          data: {
            id: cropSubtotal.id,
            cropRegionId: newRegionId,
            subtotalId: newSubtotalId,
            assignmentType: cropSubtotal.assignmentType,
          },
        })
        idMappings.cropSubtotal[cropSubtotal.id] = cropSubtotal.id
      }
    } else {
      skippedCount++
    }
  }

  if (skippedCount > 0) {
    warnings.push(
      `${skippedCount}件の設問-小計の紐づけがスキップされました（関連データがインポートされなかったため）`
    )
  }
}

async function processQuestionScores(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  scoringConflictConfig: ScoringConflictConfig | undefined,
  tx: Tx
): Promise<void> {
  const scoringConflicts = preMatchResult.scoringConflicts?.conflicts ?? []
  const conflictMap = new Map(scoringConflicts.map((c) => [c.importScoreId, c]))

  for (const qs of data.scoresData.questionScores) {
    const newRegionId = idMappings.cropRegion[qs.cropRegionId]
    const newStudentId = qs.studentId ? idMappings.student[qs.studentId] : null

    if (newRegionId && newStudentId) {
      const conflict = conflictMap.get(qs.id)

      if (conflict) {
        // データが同一なら何もしない
        const isIdentical =
          conflict.importScore.status === conflict.existingScore.status &&
          conflict.importScore.partialScore ===
            conflict.existingScore.partialScore

        if (isIdentical) {
          idMappings.questionScore[qs.id] = conflict.existingScoreId
          counts.unchanged.scores++
          continue
        }

        const resolution = resolveScoringConflict(
          conflict,
          scoringConflictConfig
        )

        if (resolution === "existing") {
          idMappings.questionScore[qs.id] = conflict.existingScoreId
          counts.skipped.scores++
          continue
        }

        await tx.questionScore.update({
          where: { id: conflict.existingScoreId },
          data: {
            partialScore: qs.partialScore ? parseFloat(qs.partialScore) : null,
            status: qs.status,
            userId: currentUserId,
          },
        })
        idMappings.questionScore[qs.id] = conflict.existingScoreId
        counts.updated.scores++
      } else {
        // B11 fix: Check for existing score with same cropRegion+student
        const existingByComposite = await tx.questionScore.findFirst({
          where: {
            cropRegionId: newRegionId,
            studentId: newStudentId,
          },
        })
        if (existingByComposite) {
          idMappings.questionScore[qs.id] = existingByComposite.id
          counts.unchanged.scores++
        } else {
          const existingById = await tx.questionScore.findUnique({
            where: { id: qs.id },
          })
          if (existingById) {
            idMappings.questionScore[qs.id] = qs.id
            counts.unchanged.scores++
          } else {
            await tx.questionScore.create({
              data: {
                id: qs.id,
                cropRegionId: newRegionId,
                studentId: newStudentId,
                partialScore: qs.partialScore
                  ? parseFloat(qs.partialScore)
                  : null,
                status: qs.status,
                userId: currentUserId,
              },
            })
            idMappings.questionScore[qs.id] = qs.id
            counts.created.scores++
          }
        }
      }
    }
  }
}

async function processDeletedRecords(
  data: ExtractedArchiveData,
  tx: Tx
): Promise<void> {
  const deletedRecords = data.deletedRecordsData?.deletedRecords ?? []
  if (deletedRecords.length === 0) return

  for (const dr of deletedRecords) {
    // tombstoneをローカルDBにupsert
    await tx.deletedRecord.upsert({
      where: {
        tableName_recordId: {
          tableName: dr.tableName,
          recordId: dr.recordId,
        },
      },
      update: {},
      create: {
        tableName: dr.tableName,
        recordId: dr.recordId,
        deletedAt: new Date(dr.deletedAt),
        userId: dr.userId,
        examId: dr.examId,
      },
    })

    // ローカルに該当レコードが残っていれば削除（削除の伝搬）
    if (dr.tableName === "DrawingAnnotation") {
      await tx.drawingAnnotation.deleteMany({
        where: { id: dr.recordId },
      })
    }
  }
}

async function processDrawingAnnotations(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  // tombstoneを一括取得してSetに格納
  const localTombstones = await tx.deletedRecord.findMany({
    where: { tableName: "DrawingAnnotation" },
    select: { recordId: true },
  })
  const deletedIds = new Set(localTombstones.map((t) => t.recordId))

  for (const da of data.scoresData.drawingAnnotations) {
    const newScoreId = idMappings.questionScore[da.questionScoreId]

    if (newScoreId) {
      // tombstoneチェック: 削除済みならスキップ
      if (deletedIds.has(da.id)) {
        counts.skipped.annotations++
        continue
      }

      const existingById = await tx.drawingAnnotation.findUnique({
        where: { id: da.id },
      })
      if (existingById) {
        idMappings.drawingAnnotation[da.id] = da.id
        counts.unchanged.annotations++
      } else {
        await tx.drawingAnnotation.create({
          data: {
            id: da.id,
            questionScoreId: newScoreId,
            type: da.type,
            x: da.x,
            y: da.y,
            color: da.color,
            strokeWidth: da.strokeWidth,
            width: da.width,
            height: da.height,
            endX: da.endX,
            endY: da.endY,
            lineStyle: da.lineStyle,
            text: da.text,
            fontSize: da.fontSize,
            textBoxWidth: da.textBoxWidth,
            textBoxHeight: da.textBoxHeight,
            horizontalAlign: da.horizontalAlign,
            verticalAlign: da.verticalAlign,
            anchorDirection: da.anchorDirection,
            displayX: da.displayX,
            displayY: da.displayY,
            isFavorite: da.isFavorite,
            userId: currentUserId,
          },
        })
        idMappings.drawingAnnotation[da.id] = da.id
        counts.created.annotations++
      }
    }
  }
}

/**
 * 学級所属データを処理
 *
 * @param memberships - 所属データ配列
 * @param idMappings - IDマッピング（student, class, membership を使用）
 * @param tx - Prismaトランザクション
 */
export async function processMemberships(
  memberships: ArchiveClassesData["memberships"],
  idMappings: Pick<IdMappings, "student" | "classroom" | "membership">,
  tx: Tx
): Promise<void> {
  for (const m of memberships) {
    const newStudentId = idMappings.student[m.studentId]
    const newClassId = idMappings.classroom[m.classroomId]

    if (newStudentId && newClassId) {
      const existing = await tx.studentClassMembership.findFirst({
        where: { studentId: newStudentId, classroomId: newClassId },
      })

      if (!existing) {
        const existingById = await tx.studentClassMembership.findUnique({
          where: { id: m.id },
        })
        if (existingById) {
          idMappings.membership[m.id] = m.id
        } else {
          await tx.studentClassMembership.create({
            data: {
              id: m.id,
              studentId: newStudentId,
              classroomId: newClassId,
              startDate: new Date(m.startDate),
              endDate: m.endDate ? new Date(m.endDate) : null,
              attendanceNumber: m.attendanceNumber,
              notes: m.notes,
            },
          })
          idMappings.membership[m.id] = m.id
        }
      } else {
        idMappings.membership[m.id] = existing.id
      }
    }
  }
}

async function processExamMarkingFormats(
  data: ExtractedArchiveData,
  newExamId: string,
  tx: Tx
): Promise<void> {
  const formats = data.examData.examMarkingFormats ?? []
  for (const fmt of formats) {
    const existing = await tx.examMarkingFormat.findFirst({
      where: { examId: newExamId, markType: fmt.markType },
    })
    if (existing) continue

    const existingById = await tx.examMarkingFormat.findUnique({
      where: { id: fmt.id },
    })
    if (!existingById) {
      await tx.examMarkingFormat.create({
        data: {
          id: fmt.id,
          examId: newExamId,
          markType: fmt.markType,
          symbol: fmt.symbol,
          color: fmt.color,
          fontSize: fmt.fontSize,
          strokeWidth: fmt.strokeWidth,
        },
      })
    }
  }
}

async function processExamExportSettings(
  data: ExtractedArchiveData,
  newExamId: string,
  tx: Tx
): Promise<void> {
  const settings = data.examData.examExportSettings
  if (!settings) return

  const existing = await tx.examExportSettings.findUnique({
    where: { examId: newExamId },
  })
  if (existing) return

  const existingById = await tx.examExportSettings.findUnique({
    where: { id: settings.id },
  })
  if (!existingById) {
    await tx.examExportSettings.create({
      data: {
        id: settings.id,
        examId: newExamId,
        settingsJson: settings.settingsJson,
      },
    })
  }
}

async function processCropRegionMarkingOverrides(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  const overrides = data.examData.cropRegionMarkingOverrides ?? []
  for (const ovr of overrides) {
    const newCropRegionId = idMappings.cropRegion[ovr.cropRegionId]
    if (!newCropRegionId) continue

    const existing = await tx.cropRegionMarkingOverride.findFirst({
      where: { cropRegionId: newCropRegionId, markType: ovr.markType },
    })
    if (existing) continue

    const existingById = await tx.cropRegionMarkingOverride.findUnique({
      where: { id: ovr.id },
    })
    if (!existingById) {
      await tx.cropRegionMarkingOverride.create({
        data: {
          id: ovr.id,
          cropRegionId: newCropRegionId,
          markType: ovr.markType,
          symbol: ovr.symbol,
          color: ovr.color,
          visible: ovr.visible,
        },
      })
    }
  }
}

async function processTags(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  if (!data.tagsData) return
  const tagIdMapping: Record<string, string> = {}

  for (const tag of data.tagsData.tags) {
    const existingByName = await tx.tag.findUnique({
      where: { name: tag.name },
    })
    if (existingByName) {
      tagIdMapping[tag.id] = existingByName.id
      continue
    }

    const existingById = await tx.tag.findUnique({
      where: { id: tag.id },
    })
    if (existingById) {
      tagIdMapping[tag.id] = tag.id
    } else {
      await tx.tag.create({
        data: { id: tag.id, name: tag.name },
      })
      tagIdMapping[tag.id] = tag.id
    }
  }

  for (const tsg of data.tagsData.tagSubtotalGroups) {
    const newTagId = tagIdMapping[tsg.tagId]
    const newGroupId = idMappings.subtotalGroup[tsg.subtotalGroupId]
    if (!newTagId || !newGroupId) continue

    const existing = await tx.tagSubtotalGroup.findFirst({
      where: { tagId: newTagId, subtotalGroupId: newGroupId },
    })
    if (existing) continue

    const existingById = await tx.tagSubtotalGroup.findUnique({
      where: { id: tsg.id },
    })
    if (!existingById) {
      await tx.tagSubtotalGroup.create({
        data: {
          id: tsg.id,
          tagId: newTagId,
          subtotalGroupId: newGroupId,
        },
      })
    }
  }

  // ExamTag処理
  const newExamId = idMappings.exam[data.examData.exam.id]
  if (newExamId) {
    for (const et of data.tagsData.examTags) {
      const newTagId = tagIdMapping[et.tagId]
      if (!newTagId) continue

      const existing = await tx.examTag.findFirst({
        where: { examId: newExamId, tagId: newTagId },
      })
      if (existing) continue

      const existingById = await tx.examTag.findUnique({
        where: { id: et.id },
      })
      if (!existingById) {
        await tx.examTag.create({
          data: {
            id: et.id,
            examId: newExamId,
            tagId: newTagId,
          },
        })
      }
    }
  }
}

async function processExamClasses(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const pc of data.examData.examClasses) {
    const newClassId = idMappings.classroom[pc.classroomId]
    if (!newClassId) continue

    const existing = await tx.examClass.findFirst({
      where: { examId: newExamId, classroomId: newClassId },
    })
    if (existing) continue

    const existingById = await tx.examClass.findUnique({
      where: { id: pc.id },
    })
    if (!existingById) {
      await tx.examClass.create({
        data: {
          id: pc.id,
          examId: newExamId,
          classroomId: newClassId,
          administered: pc.administered,
          // v1.15.0+。旧アーカイブは旧フラグ(statistics/administered)から補完
          ...resolveExamClassOutputFlags(pc),
          order: pc.order,
        },
      })
    }
  }
}

/**
 * OMR設定（CropRegionOmrConfig＋ChoiceOption＋DigitBox）を処理
 *
 * CropRegionが新規作成された場合のみ作成する。既存リージョンにマッチした場合は
 * 対象側に既にOMR設定が存在するため作成しない（重複防止）。
 * 子（ChoiceOption/DigitBox）は親configを新規作成したときだけ併せて作成する。
 */
async function processOmrConfigs(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const cfg of data.examData.omrConfigs ?? []) {
    const newCropRegionId = idMappings.cropRegion[cfg.cropRegionId]
    if (!newCropRegionId) continue

    // 対象リージョンに既にOMR設定があればスキップ（リージョンは1:1）
    const existingForRegion = await tx.cropRegionOmrConfig.findFirst({
      where: { cropRegionId: newCropRegionId },
    })
    if (existingForRegion) {
      idMappings.cropRegionOmrConfig[cfg.id] = existingForRegion.id
      continue
    }

    const existingById = await tx.cropRegionOmrConfig.findUnique({
      where: { id: cfg.id },
    })
    if (existingById) {
      idMappings.cropRegionOmrConfig[cfg.id] = cfg.id
      continue
    }

    await tx.cropRegionOmrConfig.create({
      data: {
        id: cfg.id,
        cropRegionId: newCropRegionId,
        type: cfg.type,
        numChoices: cfg.numChoices,
        choiceLayout: cfg.choiceLayout,
        numDigits: cfg.numDigits,
        correctAnswer: cfg.correctAnswer,
        colorThreshold: cfg.colorThreshold,
        areaThreshold: cfg.areaThreshold,
      },
    })
    idMappings.cropRegionOmrConfig[cfg.id] = cfg.id

    // 新規作成したconfig配下のChoiceOptionを作成
    for (const opt of data.examData.omrChoiceOptions ?? []) {
      if (opt.omrConfigId !== cfg.id) continue
      await tx.cropRegionOmrChoiceOption.create({
        data: {
          id: opt.id,
          omrConfigId: cfg.id,
          choiceIndex: opt.choiceIndex,
          label: opt.label,
          isCorrect: opt.isCorrect,
          shape: opt.shape ?? null,
          normalizedCx: opt.normalizedCx ?? null,
          normalizedCy: opt.normalizedCy ?? null,
          normalizedWidth: opt.normalizedWidth ?? null,
          normalizedHeight: opt.normalizedHeight ?? null,
        },
      })
      idMappings.cropRegionOmrChoiceOption[opt.id] = opt.id
    }

    // 新規作成したconfig配下のDigitBoxを作成
    for (const box of data.examData.omrDigitBoxes ?? []) {
      if (box.omrConfigId !== cfg.id) continue
      await tx.cropRegionOmrDigitBox.create({
        data: {
          id: box.id,
          omrConfigId: cfg.id,
          digitIndex: box.digitIndex,
          normalizedX: box.normalizedX,
          normalizedY: box.normalizedY,
          normalizedW: box.normalizedW,
          normalizedH: box.normalizedH,
        },
      })
    }
  }
}

/**
 * 複合解答（CompoundAnswer＋Member）を処理
 *
 * ExamPageが新規作成された場合のみ作成する。既存（同一ID）があればスキップ。
 * Memberは親CompoundAnswerを新規作成したときだけ併せて作成する。
 */
async function processCompoundAnswers(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const ca of data.examData.compoundAnswers ?? []) {
    const newExamPageId = idMappings.examPage[ca.examPageId]
    if (!newExamPageId) continue

    const existingById = await tx.compoundAnswer.findUnique({
      where: { id: ca.id },
    })
    if (existingById) {
      idMappings.compoundAnswer[ca.id] = ca.id
      continue
    }

    await tx.compoundAnswer.create({
      data: {
        id: ca.id,
        examPageId: newExamPageId,
        label: ca.label,
        answerFormat: ca.answerFormat,
        correctAnswer: ca.correctAnswer,
        points: ca.points,
        orderIndex: ca.orderIndex,
        alternativeAnswers: ca.alternativeAnswers,
        requireReduced: ca.requireReduced,
      },
    })
    idMappings.compoundAnswer[ca.id] = ca.id

    // 新規作成したCompoundAnswer配下のMemberを作成
    for (const cam of data.examData.compoundAnswerMembers ?? []) {
      if (cam.compoundAnswerId !== ca.id) continue
      const newCropRegionId = idMappings.cropRegion[cam.cropRegionId]
      if (!newCropRegionId) continue
      await tx.compoundAnswerMember.create({
        data: {
          id: cam.id,
          compoundAnswerId: ca.id,
          cropRegionId: newCropRegionId,
          order: cam.order,
          roleLabel: cam.roleLabel,
          separator: cam.separator,
        },
      })
      idMappings.compoundAnswerMember[cam.id] = cam.id
    }
  }
}

/**
 * ScoreDecision（OWNER確定スコア）を処理
 *
 * 設問×生徒で高々1件（@@unique）。同一キーがローカルに既存の場合は
 * decidedAt の新しい方を採用（LWW）。userIdは現在のユーザーで上書き。
 */
async function processScoreDecisions(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const sd of data.scoresData.scoreDecisions ?? []) {
    const newRegionId = idMappings.cropRegion[sd.cropRegionId]
    const newStudentId = idMappings.student[sd.studentId]
    if (!newRegionId || !newStudentId) continue

    const newSourceQsId = sd.sourceQuestionScoreId
      ? (idMappings.questionScore[sd.sourceQuestionScoreId] ?? null)
      : null
    const incomingDecidedAt = new Date(sd.decidedAt)

    const existing = await tx.scoreDecision.findUnique({
      where: {
        cropRegionId_studentId: {
          cropRegionId: newRegionId,
          studentId: newStudentId,
        },
      },
    })

    if (existing) {
      // 確定レイヤーの競合解決はLWW（decisionMergePolicy参照）
      if (isNewerByLww(incomingDecidedAt, existing.decidedAt)) {
        await tx.scoreDecision.update({
          where: { id: existing.id },
          data: {
            verdict: sd.verdict,
            score: sd.score ? parseFloat(sd.score) : null,
            comment: sd.comment,
            decidedByUserId: currentUserId,
            decidedAt: incomingDecidedAt,
            sourceQuestionScoreId: newSourceQsId,
          },
        })
        counts.updated.scores++
      } else {
        counts.skipped.scores++
      }
      idMappings.scoreDecision[sd.id] = existing.id
      continue
    }

    const existingById = await tx.scoreDecision.findUnique({
      where: { id: sd.id },
    })
    if (existingById) {
      idMappings.scoreDecision[sd.id] = sd.id
      counts.unchanged.scores++
      continue
    }

    await tx.scoreDecision.create({
      data: {
        id: sd.id,
        cropRegionId: newRegionId,
        studentId: newStudentId,
        verdict: sd.verdict,
        score: sd.score ? parseFloat(sd.score) : null,
        comment: sd.comment,
        decidedByUserId: currentUserId,
        decidedAt: incomingDecidedAt,
        sourceQuestionScoreId: newSourceQsId,
      },
    })
    idMappings.scoreDecision[sd.id] = sd.id
    counts.created.scores++
  }
}

/**
 * CompoundAnswerScore（複合解答スコア）を処理
 *
 * 複合解答×生徒で高々1件（@@unique）。同一キーがローカルに既存の場合は
 * updatedAt の新しい方を採用（LWW）。userIdは現在のユーザーで上書き。
 */
async function processCompoundAnswerScores(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const cas of data.examData.compoundAnswerScores ?? []) {
    const newCompoundAnswerId = idMappings.compoundAnswer[cas.compoundAnswerId]
    const newStudentId = idMappings.student[cas.studentId]
    if (!newCompoundAnswerId || !newStudentId) continue

    const incomingUpdatedAt = new Date(cas.updatedAt)

    const existing = await tx.compoundAnswerScore.findUnique({
      where: {
        compoundAnswerId_studentId: {
          compoundAnswerId: newCompoundAnswerId,
          studentId: newStudentId,
        },
      },
    })

    if (existing) {
      // 確定レイヤーの競合解決はLWW（decisionMergePolicy参照）
      if (isNewerByLww(incomingUpdatedAt, existing.updatedAt)) {
        await tx.compoundAnswerScore.update({
          where: { id: existing.id },
          data: {
            userId: currentUserId,
            recognizedAnswer: cas.recognizedAnswer,
            status: cas.status,
            partialScore: cas.partialScore
              ? parseFloat(cas.partialScore)
              : null,
          },
        })
        counts.updated.scores++
      } else {
        counts.skipped.scores++
      }
      idMappings.compoundAnswerScore[cas.id] = existing.id
      continue
    }

    const existingById = await tx.compoundAnswerScore.findUnique({
      where: { id: cas.id },
    })
    if (existingById) {
      idMappings.compoundAnswerScore[cas.id] = cas.id
      counts.unchanged.scores++
      continue
    }

    await tx.compoundAnswerScore.create({
      data: {
        id: cas.id,
        compoundAnswerId: newCompoundAnswerId,
        studentId: newStudentId,
        userId: currentUserId,
        recognizedAnswer: cas.recognizedAnswer,
        status: cas.status,
        partialScore: cas.partialScore ? parseFloat(cas.partialScore) : null,
      },
    })
    idMappings.compoundAnswerScore[cas.id] = cas.id
    counts.created.scores++
  }
}
