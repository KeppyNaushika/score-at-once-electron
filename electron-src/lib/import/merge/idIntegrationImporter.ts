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
} from "../../../../types/examArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
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
    class: {},
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
          integrationConfig.class,
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

        // 10d. Subject & SubjectSubtotalGroup (v1.4.0+)
        await processSubjects(data, idMappings, tx)

        // 10e. ExamClass (v1.1.0+)
        await processExamClasses(data, newExamId, idMappings, tx)

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

        // 13. DrawingAnnotation
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

  for (const s of data.subtotalsData.subtotals) {
    const newGroupId = idMappings.subtotalGroup[s.subtotalGroupId]
    if (!newGroupId) {
      // グループがスキップされた → 配下の小計もスキップ
      const groupName =
        data.subtotalsData.subtotalGroups.find(
          (g) => g.id === s.subtotalGroupId
        )?.name ?? s.subtotalGroupId
      if (!skippedByGroup[groupName]) skippedByGroup[groupName] = []
      skippedByGroup[groupName].push(s.name)
      continue
    }

    // 1. 明示的なマッピングがあれば使う
    const explicitTarget = subtotalMappings?.[s.id]
    if (explicitTarget && explicitTarget !== "__new__") {
      // 既存の小計項目に直接結びつけ
      idMappings.subtotal[s.id] = explicitTarget
      continue
    }

    // 2. "__new__" の場合は新規作成を強制
    if (explicitTarget === "__new__") {
      await createNewSubtotal(s, newGroupId, idMappings, tx)
      continue
    }

    // 3. マッピング未設定（デフォルト動作: 従来の名前ベース自動マッチ）
    const existing = await tx.subtotal.findFirst({
      where: { subtotalGroupId: newGroupId, name: s.name },
    })

    if (!existing) {
      const existingById = await tx.subtotal.findUnique({ where: { id: s.id } })
      if (existingById) {
        idMappings.subtotal[s.id] = s.id
      } else {
        await tx.subtotal.create({
          data: {
            id: s.id,
            name: s.name,
            subtotalGroupId: newGroupId,
            order: s.order,
          },
        })
        idMappings.subtotal[s.id] = s.id
      }
    } else {
      idMappings.subtotal[s.id] = existing.id
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
  s: ExtractedArchiveData["subtotalsData"]["subtotals"][0],
  newGroupId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  // 同名の小計が既にあるかチェック
  const existingWithName = await tx.subtotal.findFirst({
    where: { subtotalGroupId: newGroupId, name: s.name },
  })

  let finalName = s.name
  if (existingWithName) {
    // サフィックス付きで新規作成
    for (let i = 2; i <= 100; i++) {
      const candidate = `${s.name} (${i})`
      const dup = await tx.subtotal.findFirst({
        where: { subtotalGroupId: newGroupId, name: candidate },
      })
      if (!dup) {
        finalName = candidate
        break
      }
    }
  }

  const existingById = await tx.subtotal.findUnique({ where: { id: s.id } })
  const newId = existingById ? randomUUID() : s.id

  await tx.subtotal.create({
    data: {
      id: newId,
      name: finalName,
      subtotalGroupId: newGroupId,
      order: s.order,
    },
  })
  idMappings.subtotal[s.id] = newId
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
      subject: exam.subject,
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
  const existingPageIds = new Set(existingExamPages.map((p) => p.id))

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
  const existingRegionIds = new Set(existingCropRegions.map((r) => r.id))

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
  for (const psg of data.examData.examSubtotalGroups) {
    const newGroupId = idMappings.subtotalGroup[psg.subtotalGroupId]
    if (newGroupId) {
      const existing = await tx.examSubtotalGroup.findFirst({
        where: { examId: newExamId, subtotalGroupId: newGroupId },
      })
      if (existing) {
        idMappings.examSubtotalGroup[psg.id] = existing.id
      } else {
        const existingById = await tx.examSubtotalGroup.findUnique({
          where: { id: psg.id },
        })
        if (existingById) {
          idMappings.examSubtotalGroup[psg.id] = psg.id
        } else {
          await tx.examSubtotalGroup.create({
            data: {
              id: psg.id,
              examId: newExamId,
              subtotalGroupId: newGroupId,
            },
          })
          idMappings.examSubtotalGroup[psg.id] = psg.id
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
  for (const ps of data.examData.examStudents) {
    const newStudentId = idMappings.student[ps.studentId]
    if (newStudentId) {
      if (isExamIdMatch) {
        const existing = await tx.examStudent.findFirst({
          where: { examId: newExamId, studentId: newStudentId },
        })
        if (existing) {
          idMappings.examStudent[ps.id] = existing.id
          continue
        }
      }

      const existingById = await tx.examStudent.findUnique({
        where: { id: ps.id },
      })
      if (existingById) {
        idMappings.examStudent[ps.id] = ps.id
      } else {
        await tx.examStudent.create({
          data: {
            id: ps.id,
            examId: newExamId,
            studentId: newStudentId,
            status: ps.status,
            customOrder: ps.customOrder,
          },
        })
        idMappings.examStudent[ps.id] = ps.id
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

  for (const cs of data.subtotalsData.cropSubtotals) {
    const newRegionId = idMappings.cropRegion[cs.cropRegionId]
    const newSubtotalId = idMappings.subtotal[cs.subtotalId]
    if (newRegionId && newSubtotalId) {
      if (isExamIdMatch) {
        const existing = await tx.cropSubtotal.findFirst({
          where: { cropRegionId: newRegionId, subtotalId: newSubtotalId },
        })
        if (existing) {
          idMappings.cropSubtotal[cs.id] = existing.id
          continue
        }
      }

      const existingById = await tx.cropSubtotal.findUnique({
        where: { id: cs.id },
      })
      if (existingById) {
        idMappings.cropSubtotal[cs.id] = cs.id
      } else {
        await tx.cropSubtotal.create({
          data: {
            id: cs.id,
            cropRegionId: newRegionId,
            subtotalId: newSubtotalId,
            assignmentType: cs.assignmentType,
          },
        })
        idMappings.cropSubtotal[cs.id] = cs.id
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

async function processDrawingAnnotations(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const da of data.scoresData.drawingAnnotations) {
    const newScoreId = idMappings.questionScore[da.questionScoreId]

    if (newScoreId) {
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
  idMappings: Pick<IdMappings, "student" | "class" | "membership">,
  tx: Tx
): Promise<void> {
  for (const m of memberships) {
    const newStudentId = idMappings.student[m.studentId]
    const newClassId = idMappings.class[m.classId]

    if (newStudentId && newClassId) {
      const existing = await tx.studentClassMembership.findFirst({
        where: { studentId: newStudentId, classId: newClassId },
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
              classId: newClassId,
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

async function processSubjects(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  if (!data.subjectsData) return
  const subjectIdMapping: Record<string, string> = {}

  for (const subj of data.subjectsData.subjects) {
    const existingByName = await tx.subject.findUnique({
      where: { name: subj.name },
    })
    if (existingByName) {
      subjectIdMapping[subj.id] = existingByName.id
      continue
    }

    const existingById = await tx.subject.findUnique({
      where: { id: subj.id },
    })
    if (existingById) {
      subjectIdMapping[subj.id] = subj.id
    } else {
      await tx.subject.create({
        data: { id: subj.id, name: subj.name },
      })
      subjectIdMapping[subj.id] = subj.id
    }
  }

  for (const ssg of data.subjectsData.subjectSubtotalGroups) {
    const newSubjectId = subjectIdMapping[ssg.subjectId]
    const newGroupId = idMappings.subtotalGroup[ssg.subtotalGroupId]
    if (!newSubjectId || !newGroupId) continue

    const existing = await tx.subjectSubtotalGroup.findFirst({
      where: { subjectId: newSubjectId, subtotalGroupId: newGroupId },
    })
    if (existing) continue

    const existingById = await tx.subjectSubtotalGroup.findUnique({
      where: { id: ssg.id },
    })
    if (!existingById) {
      await tx.subjectSubtotalGroup.create({
        data: {
          id: ssg.id,
          subjectId: newSubjectId,
          subtotalGroupId: newGroupId,
        },
      })
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
    const newClassId = idMappings.class[pc.classId]
    if (!newClassId) continue

    const existing = await tx.examClass.findFirst({
      where: { examId: newExamId, classId: newClassId },
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
          classId: newClassId,
          administered: pc.administered,
          statistics: pc.statistics,
          order: pc.order,
        },
      })
    }
  }
}
