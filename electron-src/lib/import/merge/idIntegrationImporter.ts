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
  ArchiveDataCounts,
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../../../types/projectArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"
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
  projectId?: string
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
    project: {},
    projectPage: {},
    cropRegion: {},
    masterImage: {},
    studentAnswerImage: {},
    projectStudent: {},
    userProject: {},
    projectSubtotalGroup: {},
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
    await prisma.$transaction(async (tx) => {
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
      await processSubtotals(data, idMappings, tx)

      // 5. プロジェクト処理
      const isProjectIdMatch = preMatchResult.project?.isIdMatch ?? false
      const newProjectId = await processProject(
        data,
        preMatchResult,
        idMappings,
        counts,
        tx
      )

      // 6. UserProject
      await processUserProject(
        isProjectIdMatch,
        newProjectId,
        currentUserId,
        tx
      )

      // 7. ProjectSubtotalGroup
      await processProjectSubtotalGroups(data, newProjectId, idMappings, tx)

      // 8. ProjectStudent
      await processProjectStudents(
        data,
        isProjectIdMatch,
        newProjectId,
        idMappings,
        tx
      )

      // 9. ProjectPage（不一致時のみ）
      if (!isProjectIdMatch) {
        await processProjectPages(data, newProjectId, idMappings, counts, tx)
      }

      // 10. CropRegion（不一致時のみ）
      if (!isProjectIdMatch) {
        await processCropRegions(data, idMappings, counts, tx)
      }

      // 11. CropSubtotal
      await processCropSubtotals(data, isProjectIdMatch, idMappings, tx)

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
      await processMemberships(data, idMappings, tx)
    })

    // ========================================================================
    // Stage 2: ID変更処理（「書き出したPCに合わせる」を選んだ場合）
    // ========================================================================
    if (idChangeTargets.length > 0) {
      await executeIdChanges(idChangeTargets, idMappings, warnings)
    }

    // ========================================================================
    // 画像ファイルのコピー
    // ========================================================================
    const newProjectId = idMappings.project[data.projectData.project.id]
    await copyImportImages(data, newProjectId)
    await createImportImageRecords(data, idMappings)

    return {
      success: true,
      projectId: newProjectId,
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
  tx: Tx
): Promise<void> {
  for (const s of data.subtotalsData.subtotals) {
    const newGroupId = idMappings.subtotalGroup[s.subtotalGroupId]
    if (!newGroupId) continue

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
}

async function processProject(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<string> {
  const project = data.projectData.project
  const isProjectIdMatch = preMatchResult.project?.isIdMatch ?? false

  if (isProjectIdMatch && preMatchResult.project?.existingProjectId) {
    // プロジェクトID一致 → 既存プロジェクトを使用（マージ）
    const newProjectId = preMatchResult.project.existingProjectId
    idMappings.project[project.id] = newProjectId

    // 既存のProjectPageとCropRegionをID一致でマッピング
    await mapExistingProjectPages(data, newProjectId, idMappings, counts, tx)
    await mapExistingCropRegions(data, newProjectId, idMappings, counts, tx)

    return newProjectId
  }

  // プロジェクトID不一致 → 新規作成
  const existingById = await tx.project.findUnique({
    where: { id: project.id },
  })
  if (existingById) {
    idMappings.project[project.id] = project.id
    return project.id
  }
  await tx.project.create({
    data: {
      id: project.id,
      examName: project.examName,
      examDate: project.examDate ? new Date(project.examDate) : null,
      subject: project.subject,
      description: project.description,
    },
  })
  idMappings.project[project.id] = project.id
  return project.id
}

async function mapExistingProjectPages(
  data: ExtractedArchiveData,
  newProjectId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  const existingProjectPages = await tx.projectPage.findMany({
    where: { projectId: newProjectId },
  })
  const existingPageIds = new Set(existingProjectPages.map((p) => p.id))

  for (const page of data.projectData.projectPages) {
    if (existingPageIds.has(page.id)) {
      idMappings.projectPage[page.id] = page.id
    } else {
      const existingById = await tx.projectPage.findUnique({
        where: { id: page.id },
      })
      if (existingById) {
        idMappings.projectPage[page.id] = page.id
      } else {
        await tx.projectPage.create({
          data: {
            id: page.id,
            projectId: newProjectId,
            pageNumber: page.pageNumber,
          },
        })
        idMappings.projectPage[page.id] = page.id
      }
      counts.created.pages++
    }
  }
}

async function mapExistingCropRegions(
  data: ExtractedArchiveData,
  newProjectId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  const existingCropRegions = await tx.cropRegion.findMany({
    where: {
      projectPage: { projectId: newProjectId },
    },
  })
  const existingRegionIds = new Set(existingCropRegions.map((r) => r.id))

  for (const region of data.projectData.cropRegions) {
    const mappedPageId = idMappings.projectPage[region.projectPageId]
    if (!mappedPageId) continue

    if (existingRegionIds.has(region.id)) {
      idMappings.cropRegion[region.id] = region.id
    } else {
      const existingById = await tx.cropRegion.findUnique({
        where: { id: region.id },
      })
      if (existingById) {
        idMappings.cropRegion[region.id] = region.id
      } else {
        await tx.cropRegion.create({
          data: {
            id: region.id,
            projectPageId: mappedPageId,
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
      }
      counts.created.regions++
    }
  }
}

async function processUserProject(
  isProjectIdMatch: boolean,
  newProjectId: string,
  currentUserId: string,
  tx: Tx
): Promise<void> {
  if (isProjectIdMatch) {
    const existingUserProject = await tx.userProject.findUnique({
      where: {
        userId_projectId: {
          userId: currentUserId,
          projectId: newProjectId,
        },
      },
    })
    if (!existingUserProject) {
      await tx.userProject.create({
        data: {
          id: randomUUID(),
          userId: currentUserId,
          projectId: newProjectId,
          role: "MEMBER",
          invitedAt: new Date(),
          invitedBy: null,
        },
      })
    }
  } else {
    await tx.userProject.create({
      data: {
        id: randomUUID(),
        userId: currentUserId,
        projectId: newProjectId,
        role: "OWNER",
        invitedAt: new Date(),
        invitedBy: null,
      },
    })
  }
}

async function processProjectSubtotalGroups(
  data: ExtractedArchiveData,
  newProjectId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const psg of data.projectData.projectSubtotalGroups) {
    const newGroupId = idMappings.subtotalGroup[psg.subtotalGroupId]
    if (newGroupId) {
      const existing = await tx.projectSubtotalGroup.findFirst({
        where: { projectId: newProjectId, subtotalGroupId: newGroupId },
      })
      if (existing) {
        idMappings.projectSubtotalGroup[psg.id] = existing.id
      } else {
        const existingById = await tx.projectSubtotalGroup.findUnique({
          where: { id: psg.id },
        })
        if (existingById) {
          idMappings.projectSubtotalGroup[psg.id] = psg.id
        } else {
          await tx.projectSubtotalGroup.create({
            data: {
              id: psg.id,
              projectId: newProjectId,
              subtotalGroupId: newGroupId,
            },
          })
          idMappings.projectSubtotalGroup[psg.id] = psg.id
        }
      }
    }
  }
}

async function processProjectStudents(
  data: ExtractedArchiveData,
  isProjectIdMatch: boolean,
  newProjectId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const ps of data.projectData.projectStudents) {
    const newStudentId = idMappings.student[ps.studentId]
    if (newStudentId) {
      if (isProjectIdMatch) {
        const existing = await tx.projectStudent.findFirst({
          where: { projectId: newProjectId, studentId: newStudentId },
        })
        if (existing) {
          idMappings.projectStudent[ps.id] = existing.id
          continue
        }
      }

      const existingById = await tx.projectStudent.findUnique({
        where: { id: ps.id },
      })
      if (existingById) {
        idMappings.projectStudent[ps.id] = ps.id
      } else {
        await tx.projectStudent.create({
          data: {
            id: ps.id,
            projectId: newProjectId,
            studentId: newStudentId,
            status: ps.status,
            customOrder: ps.customOrder,
          },
        })
        idMappings.projectStudent[ps.id] = ps.id
      }
    }
  }
}

async function processProjectPages(
  data: ExtractedArchiveData,
  newProjectId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const page of data.projectData.projectPages) {
    const existingById = await tx.projectPage.findUnique({
      where: { id: page.id },
    })
    if (existingById) {
      idMappings.projectPage[page.id] = page.id
    } else {
      await tx.projectPage.create({
        data: {
          id: page.id,
          projectId: newProjectId,
          pageNumber: page.pageNumber,
        },
      })
      idMappings.projectPage[page.id] = page.id
    }
    counts.created.pages++
  }
}

async function processCropRegions(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: Tx
): Promise<void> {
  for (const region of data.projectData.cropRegions) {
    const newPageId = idMappings.projectPage[region.projectPageId]
    if (newPageId) {
      const existingById = await tx.cropRegion.findUnique({
        where: { id: region.id },
      })
      if (existingById) {
        idMappings.cropRegion[region.id] = region.id
      } else {
        await tx.cropRegion.create({
          data: {
            id: region.id,
            projectPageId: newPageId,
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
      }
      counts.created.regions++
    }
  }
}

async function processCropSubtotals(
  data: ExtractedArchiveData,
  isProjectIdMatch: boolean,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const cs of data.subtotalsData.cropSubtotals) {
    const newRegionId = idMappings.cropRegion[cs.cropRegionId]
    const newSubtotalId = idMappings.subtotal[cs.subtotalId]
    if (newRegionId && newSubtotalId) {
      if (isProjectIdMatch) {
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
    }
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
        const existingById = await tx.questionScore.findUnique({
          where: { id: qs.id },
        })
        if (existingById) {
          idMappings.questionScore[qs.id] = qs.id
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
        }
        counts.created.scores++
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
            userId: currentUserId,
          },
        })
        idMappings.drawingAnnotation[da.id] = da.id
      }
      counts.created.annotations++
    }
  }
}

async function processMemberships(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const m of data.classesData.memberships) {
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
