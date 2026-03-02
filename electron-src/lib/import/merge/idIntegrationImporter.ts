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

        // 5. プロジェクト処理
        const isProjectIdMatch = preMatchResult.project?.isIdMatch ?? false
        const newProjectId = await processProject(
          data,
          preMatchResult,
          idMappings,
          counts,
          warnings,
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

        // 10a. ProjectMarkingFormat (v1.4.0+)
        await processProjectMarkingFormats(data, newProjectId, tx)

        // 10b. ProjectExportSettings (v1.4.0+)
        await processProjectExportSettings(data, newProjectId, tx)

        // 10c. CropRegionMarkingOverride (v1.4.0+)
        await processCropRegionMarkingOverrides(data, idMappings, tx)

        // 10d. Subject & SubjectSubtotalGroup (v1.4.0+)
        await processSubjects(data, idMappings, tx)

        // 10e. ProjectClass (v1.1.0+)
        await processProjectClasses(data, newProjectId, idMappings, tx)

        // 11. CropSubtotal
        await processCropSubtotals(
          data,
          isProjectIdMatch,
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
        await processMemberships(data, idMappings, tx)

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
    const newProjectId = idMappings.project[data.projectData.project.id]
    try {
      await copyImportImages(data, newProjectId)
    } catch (copyError) {
      warnings.push(
        "画像ファイルのコピーに一部失敗しました。再インポートで修復可能です。"
      )
      console.error("Image copy failed:", copyError)
    }

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

async function processProject(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  idMappings: IdMappings,
  counts: ImportCounts,
  warnings: string[],
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
    warnings.push(
      `プロジェクトID「${project.id}」は既に使用されています。既存プロジェクトにデータがマージされます。`
    )
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
      counts.unchanged.pages++
    } else {
      const existingById = await tx.projectPage.findUnique({
        where: { id: page.id },
      })
      if (existingById) {
        idMappings.projectPage[page.id] = page.id
        counts.unchanged.pages++
      } else {
        await tx.projectPage.create({
          data: {
            id: page.id,
            projectId: newProjectId,
            pageNumber: page.pageNumber,
          },
        })
        idMappings.projectPage[page.id] = page.id
        counts.created.pages++
      }
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
        counts.created.regions++
      }
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
      counts.unchanged.pages++
    } else {
      await tx.projectPage.create({
        data: {
          id: page.id,
          projectId: newProjectId,
          pageNumber: page.pageNumber,
        },
      })
      idMappings.projectPage[page.id] = page.id
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
  for (const region of data.projectData.cropRegions) {
    const newPageId = idMappings.projectPage[region.projectPageId]
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
        counts.created.regions++
      }
    }
  }
}

async function processCropSubtotals(
  data: ExtractedArchiveData,
  isProjectIdMatch: boolean,
  idMappings: IdMappings,
  warnings: string[],
  tx: Tx
): Promise<void> {
  let skippedCount = 0

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
            userId: currentUserId,
          },
        })
        idMappings.drawingAnnotation[da.id] = da.id
        counts.created.annotations++
      }
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

async function processProjectMarkingFormats(
  data: ExtractedArchiveData,
  newProjectId: string,
  tx: Tx
): Promise<void> {
  const formats = data.projectData.projectMarkingFormats ?? []
  for (const fmt of formats) {
    const existing = await tx.projectMarkingFormat.findFirst({
      where: { projectId: newProjectId, markType: fmt.markType },
    })
    if (existing) continue

    const existingById = await tx.projectMarkingFormat.findUnique({
      where: { id: fmt.id },
    })
    if (!existingById) {
      await tx.projectMarkingFormat.create({
        data: {
          id: fmt.id,
          projectId: newProjectId,
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

async function processProjectExportSettings(
  data: ExtractedArchiveData,
  newProjectId: string,
  tx: Tx
): Promise<void> {
  const settings = data.projectData.projectExportSettings
  if (!settings) return

  const existing = await tx.projectExportSettings.findUnique({
    where: { projectId: newProjectId },
  })
  if (existing) return

  const existingById = await tx.projectExportSettings.findUnique({
    where: { id: settings.id },
  })
  if (!existingById) {
    await tx.projectExportSettings.create({
      data: {
        id: settings.id,
        projectId: newProjectId,
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
  const overrides = data.projectData.cropRegionMarkingOverrides ?? []
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

async function processProjectClasses(
  data: ExtractedArchiveData,
  newProjectId: string,
  idMappings: IdMappings,
  tx: Tx
): Promise<void> {
  for (const pc of data.projectData.projectClasses) {
    const newClassId = idMappings.class[pc.classId]
    if (!newClassId) continue

    const existing = await tx.projectClass.findFirst({
      where: { projectId: newProjectId, classId: newClassId },
    })
    if (existing) continue

    const existingById = await tx.projectClass.findUnique({
      where: { id: pc.id },
    })
    if (!existingById) {
      await tx.projectClass.create({
        data: {
          id: pc.id,
          projectId: newProjectId,
          classId: newClassId,
          administered: pc.administered,
          statistics: pc.statistics,
          order: pc.order,
        },
      })
    }
  }
}
