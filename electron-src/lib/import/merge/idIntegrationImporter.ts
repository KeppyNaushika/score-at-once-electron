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
import * as fs from "fs"
import * as path from "path"
import type {
  ArchiveDataCounts,
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  ScoringConflict,
  ScoringConflictConfig,
  ScoringConflictResolutionStrategy,
} from "../../../../types/projectArchive.types"
import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"

/** インポート結果 */
export interface IdIntegrationImportResult {
  success: boolean
  projectId?: string
  summary?: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
  }
  warnings?: string[]
  error?: string
}

/** IDマッピング */
interface IdMappings {
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
interface IdChangeTarget {
  category: "student" | "class" | "subtotalGroup"
  existingId: string
  newId: string
}

function createEmptyCounts(): ArchiveDataCounts {
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

/**
 * ID統合インポートを実行
 *
 * @param data - 展開されたアーカイブデータ
 * @param preMatchResult - 事前照合結果
 * @param integrationConfig - ID統合設定（ユーザーの選択）
 * @param currentUserId - 現在ログインしているユーザーID
 * @param scoringConflictConfig - 採点結果の競合解決設定
 * @returns インポート結果
 */
export async function executeIdIntegrationImport(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  integrationConfig: IdIntegrationConfig,
  currentUserId: string,
  scoringConflictConfig?: ScoringConflictConfig
): Promise<IdIntegrationImportResult> {
  const warnings: string[] = []
  const counts = {
    created: createEmptyCounts(),
    updated: createEmptyCounts(),
    skipped: createEmptyCounts(),
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
      // --------------------------------------------------------------------
      // 1. 生徒のID統合処理
      // --------------------------------------------------------------------
      await processStudentIdIntegration(
        data,
        preMatchResult,
        integrationConfig.student,
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )

      // --------------------------------------------------------------------
      // 2. 学級のID統合処理
      // --------------------------------------------------------------------
      await processClassIdIntegration(
        data,
        preMatchResult,
        integrationConfig.class,
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )

      // --------------------------------------------------------------------
      // 3. 小計グループのID統合処理
      // --------------------------------------------------------------------
      await processSubtotalGroupIdIntegration(
        data,
        preMatchResult,
        integrationConfig.subtotalGroup,
        idMappings,
        idChangeTargets,
        counts,
        warnings,
        tx
      )

      // --------------------------------------------------------------------
      // 4. 小計のマージ
      // --------------------------------------------------------------------
      for (const s of data.subtotalsData.subtotals) {
        const newGroupId = idMappings.subtotalGroup[s.subtotalGroupId]
        if (!newGroupId) continue

        const existing = await tx.subtotal.findFirst({
          where: { subtotalGroupId: newGroupId, name: s.name },
        })

        if (!existing) {
          const newId = randomUUID()
          await tx.subtotal.create({
            data: {
              id: newId,
              name: s.name,
              subtotalGroupId: newGroupId,
              order: s.order,
            },
          })
          idMappings.subtotal[s.id] = newId
        } else {
          idMappings.subtotal[s.id] = existing.id
        }
      }

      // --------------------------------------------------------------------
      // 5. プロジェクト処理（ID一致時はマージ、不一致時は新規作成）
      // --------------------------------------------------------------------
      const project = data.projectData.project
      const isProjectIdMatch = preMatchResult.project?.isIdMatch ?? false
      let newProjectId: string

      if (isProjectIdMatch && preMatchResult.project?.existingProjectId) {
        // プロジェクトID一致 → 既存プロジェクトを使用（マージ）
        newProjectId = preMatchResult.project.existingProjectId
        idMappings.project[project.id] = newProjectId

        // 既存のProjectPageとCropRegionをID一致でマッピング
        const existingProjectPages = await tx.projectPage.findMany({
          where: { projectId: newProjectId },
        })
        const existingPageIds = new Set(existingProjectPages.map((p) => p.id))

        for (const page of data.projectData.projectPages) {
          if (existingPageIds.has(page.id)) {
            // ID一致 → 既存をマッピング
            idMappings.projectPage[page.id] = page.id
          } else {
            // ID不一致 → 新規作成
            const newPageId = randomUUID()
            await tx.projectPage.create({
              data: {
                id: newPageId,
                projectId: newProjectId,
                pageNumber: page.pageNumber,
              },
            })
            idMappings.projectPage[page.id] = newPageId
            counts.created.pages++
          }
        }

        // CropRegionのID一致マッピング
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
            // ID一致 → 既存をマッピング
            idMappings.cropRegion[region.id] = region.id
          } else {
            // ID不一致 → 新規作成
            const newRegionId = randomUUID()
            await tx.cropRegion.create({
              data: {
                id: newRegionId,
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
            idMappings.cropRegion[region.id] = newRegionId
            counts.created.regions++
          }
        }
      } else {
        // プロジェクトID不一致 → 新規作成
        newProjectId = randomUUID()
        await tx.project.create({
          data: {
            id: newProjectId,
            examName: project.examName,
            examDate: project.examDate ? new Date(project.examDate) : null,
            subject: project.subject,
            description: project.description,
          },
        })
        idMappings.project[project.id] = newProjectId
      }

      // --------------------------------------------------------------------
      // 6. UserProject - 現在のログインユーザーをOWNERとして追加（既存にない場合のみ）
      // --------------------------------------------------------------------
      if (isProjectIdMatch) {
        // プロジェクトID一致の場合、既存のUserProjectをチェック
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

      // --------------------------------------------------------------------
      // 7. ProjectSubtotalGroup
      // --------------------------------------------------------------------
      for (const psg of data.projectData.projectSubtotalGroups) {
        const newGroupId = idMappings.subtotalGroup[psg.subtotalGroupId]
        if (newGroupId) {
          const newId = randomUUID()
          await tx.projectSubtotalGroup.create({
            data: {
              id: newId,
              projectId: newProjectId,
              subtotalGroupId: newGroupId,
            },
          })
          idMappings.projectSubtotalGroup[psg.id] = newId
        }
      }

      // --------------------------------------------------------------------
      // 8. ProjectStudent（既存にない場合のみ作成）
      // --------------------------------------------------------------------
      for (const ps of data.projectData.projectStudents) {
        const newStudentId = idMappings.student[ps.studentId]
        if (newStudentId) {
          // プロジェクトID一致時は既存のProjectStudentをチェック
          if (isProjectIdMatch) {
            const existing = await tx.projectStudent.findFirst({
              where: { projectId: newProjectId, studentId: newStudentId },
            })
            if (existing) {
              idMappings.projectStudent[ps.id] = existing.id
              continue
            }
          }

          const newId = randomUUID()
          await tx.projectStudent.create({
            data: {
              id: newId,
              projectId: newProjectId,
              studentId: newStudentId,
              status: ps.status,
              customOrder: ps.customOrder,
            },
          })
          idMappings.projectStudent[ps.id] = newId
        }
      }

      // --------------------------------------------------------------------
      // 9. ProjectPage（プロジェクトID不一致時のみ作成、一致時は既にマッピング済み）
      // --------------------------------------------------------------------
      if (!isProjectIdMatch) {
        for (const page of data.projectData.projectPages) {
          const newId = randomUUID()
          await tx.projectPage.create({
            data: {
              id: newId,
              projectId: newProjectId,
              pageNumber: page.pageNumber,
            },
          })
          idMappings.projectPage[page.id] = newId
          counts.created.pages++
        }
      }

      // --------------------------------------------------------------------
      // 10. CropRegion（プロジェクトID不一致時のみ作成、一致時は既にマッピング済み）
      // --------------------------------------------------------------------
      if (!isProjectIdMatch) {
        for (const region of data.projectData.cropRegions) {
          const newPageId = idMappings.projectPage[region.projectPageId]
          if (newPageId) {
            const newId = randomUUID()
            await tx.cropRegion.create({
              data: {
                id: newId,
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
            idMappings.cropRegion[region.id] = newId
            counts.created.regions++
          }
        }
      }

      // --------------------------------------------------------------------
      // 11. CropSubtotal（既存にない場合のみ作成）
      // --------------------------------------------------------------------
      for (const cs of data.subtotalsData.cropSubtotals) {
        const newRegionId = idMappings.cropRegion[cs.cropRegionId]
        const newSubtotalId = idMappings.subtotal[cs.subtotalId]
        if (newRegionId && newSubtotalId) {
          // プロジェクトID一致時は既存のCropSubtotalをチェック
          if (isProjectIdMatch) {
            const existing = await tx.cropSubtotal.findFirst({
              where: { cropRegionId: newRegionId, subtotalId: newSubtotalId },
            })
            if (existing) {
              idMappings.cropSubtotal[cs.id] = existing.id
              continue
            }
          }

          const newId = randomUUID()
          await tx.cropSubtotal.create({
            data: {
              id: newId,
              cropRegionId: newRegionId,
              subtotalId: newSubtotalId,
              assignmentType: cs.assignmentType,
            },
          })
          idMappings.cropSubtotal[cs.id] = newId
        }
      }

      // --------------------------------------------------------------------
      // 12. QuestionScore（userIdは現在のログインユーザーで上書き、競合解決対応）
      // --------------------------------------------------------------------
      const scoringConflicts = preMatchResult.scoringConflicts?.conflicts ?? []
      const conflictMap = new Map(
        scoringConflicts.map((c) => [c.importScoreId, c])
      )

      for (const qs of data.scoresData.questionScores) {
        const newRegionId = idMappings.cropRegion[qs.cropRegionId]
        const newStudentId = qs.studentId
          ? idMappings.student[qs.studentId]
          : null

        if (newRegionId && newStudentId) {
          // 競合があるかチェック
          const conflict = conflictMap.get(qs.id)

          if (conflict) {
            // 競合がある場合、解決方針に従って処理
            const resolution = resolveScoringConflict(
              conflict,
              scoringConflictConfig
            )

            if (resolution === "existing") {
              // 既存データを維持 → インポートデータをスキップ
              // 既存のQuestionScoreのIDをマッピングに登録
              idMappings.questionScore[qs.id] = conflict.existingScoreId
              counts.skipped.scores++
              continue
            }

            // resolution === "import" の場合
            // 既存レコードを更新
            await tx.questionScore.update({
              where: { id: conflict.existingScoreId },
              data: {
                partialScore: qs.partialScore
                  ? parseFloat(qs.partialScore)
                  : null,
                status: qs.status,
                userId: currentUserId,
              },
            })
            idMappings.questionScore[qs.id] = conflict.existingScoreId
            counts.updated.scores++
          } else {
            // 競合なし → 新規作成
            const newId = randomUUID()
            await tx.questionScore.create({
              data: {
                id: newId,
                cropRegionId: newRegionId,
                studentId: newStudentId,
                partialScore: qs.partialScore
                  ? parseFloat(qs.partialScore)
                  : null,
                status: qs.status,
                userId: currentUserId,
              },
            })
            idMappings.questionScore[qs.id] = newId
            counts.created.scores++
          }
        }
      }

      // --------------------------------------------------------------------
      // 13. DrawingAnnotation（userIdは現在のログインユーザーで上書き）
      // --------------------------------------------------------------------
      for (const da of data.scoresData.drawingAnnotations) {
        const newScoreId = idMappings.questionScore[da.questionScoreId]

        if (newScoreId) {
          const newId = randomUUID()
          await tx.drawingAnnotation.create({
            data: {
              id: newId,
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
          idMappings.drawingAnnotation[da.id] = newId
          counts.created.annotations++
        }
      }

      // --------------------------------------------------------------------
      // 14. 学級所属
      // --------------------------------------------------------------------
      for (const m of data.classesData.memberships) {
        const newStudentId = idMappings.student[m.studentId]
        const newClassId = idMappings.class[m.classId]

        if (newStudentId && newClassId) {
          const existing = await tx.studentClassMembership.findFirst({
            where: { studentId: newStudentId, classId: newClassId },
          })

          if (!existing) {
            const newId = randomUUID()
            await tx.studentClassMembership.create({
              data: {
                id: newId,
                studentId: newStudentId,
                classId: newClassId,
                startDate: new Date(m.startDate),
                endDate: m.endDate ? new Date(m.endDate) : null,
                attendanceNumber: m.attendanceNumber,
                notes: m.notes,
              },
            })
            idMappings.membership[m.id] = newId
          } else {
            idMappings.membership[m.id] = existing.id
          }
        }
      }
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

/**
 * 生徒のID統合処理
 */
async function processStudentIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["student"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
  },
  warnings: string[],
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const studentPreMatch = preMatchResult.student

  // ID一致したもの（自動で紐づく）
  for (const match of studentPreMatch.byId) {
    idMappings.student[match.importId] = match.existingId
  }

  // ID不一致のものを処理
  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importStudent = data.studentsData.students.find(
      (s) => s.id === importId
    )
    if (!importStudent) return

    if (!decision || decision.decisionType === "create_new") {
      // 新規作成
      const existingByStudentNumber = await tx.student.findUnique({
        where: { studentNumber: importStudent.studentNumber },
      })

      if (existingByStudentNumber) {
        idMappings.student[importId] = existingByStudentNumber.id
        warnings.push(
          `生徒「${importStudent.lastName} ${importStudent.firstName}」は既存データを使用します`
        )
      } else {
        const newId = randomUUID()
        await tx.student.create({
          data: {
            id: newId,
            studentNumber: importStudent.studentNumber,
            lastName: importStudent.lastName,
            firstName: importStudent.firstName,
            lastNameKana: importStudent.lastNameKana,
            firstNameKana: importStudent.firstNameKana,
            enrollmentYear: importStudent.enrollmentYear,
          },
        })
        idMappings.student[importId] = newId
        counts.created.students++
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(
          `生徒「${importStudent.lastName} ${importStudent.firstName}」の既存IDが見つかりません`
        )
        return
      }

      idMappings.student[importId] = existingId

      if (decision.idChoice === "use_import_id") {
        // Stage 2でID変更を行う
        idChangeTargets.push({
          category: "student",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.students++
    }
  }

  // 学籍番号一致
  if (studentPreMatch.byStudentNumber) {
    for (const match of studentPreMatch.byStudentNumber) {
      const decision = config.decisions.find(
        (d) => d.importId === match.importId
      )

      // strategyに応じたデフォルト処理
      if (config.strategy === "by_student_number") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // 氏名一致
  if (studentPreMatch.byName) {
    for (const match of studentPreMatch.byName) {
      // byStudentNumberで既に処理済みの場合はスキップ
      if (idMappings.student[match.importId]) continue

      const decision = config.decisions.find(
        (d) => d.importId === match.importId
      )

      if (config.strategy === "by_name") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // どれにも一致しない
  for (const item of studentPreMatch.noMatch) {
    if (idMappings.student[item.importId]) continue

    const decision = config.decisions.find((d) => d.importId === item.importId)
    await processDecision(
      item.importId,
      decision || {
        importId: item.importId,
        decisionType: "create_new",
      },
      undefined
    )
  }
}

/**
 * 学級のID統合処理
 */
async function processClassIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["class"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
  },
  warnings: string[],
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const classPreMatch = preMatchResult.class

  // ID一致したもの
  for (const match of classPreMatch.byId) {
    idMappings.class[match.importId] = match.existingId
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importClass = data.classesData.classes.find((c) => c.id === importId)
    if (!importClass) return

    if (!decision || decision.decisionType === "create_new") {
      const existingByName = await tx.class.findUnique({
        where: { name: importClass.name },
      })

      if (existingByName) {
        idMappings.class[importId] = existingByName.id
        warnings.push(`学級「${importClass.name}」は既存データを使用します`)
      } else {
        const newId = randomUUID()
        await tx.class.create({
          data: {
            id: newId,
            name: importClass.name,
            classCode: importClass.classCode,
            grade: importClass.grade,
            description: importClass.description,
          },
        })
        idMappings.class[importId] = newId
        counts.created.classes++
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(`学級「${importClass.name}」の既存IDが見つかりません`)
        return
      }

      idMappings.class[importId] = existingId

      if (decision.idChoice === "use_import_id") {
        idChangeTargets.push({
          category: "class",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.classes++
    }
  }

  // 名前一致
  if (classPreMatch.byName) {
    for (const match of classPreMatch.byName) {
      const decision = config.decisions.find(
        (d) => d.importId === match.importId
      )

      if (config.strategy === "by_name") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // どれにも一致しない
  for (const item of classPreMatch.noMatch) {
    if (idMappings.class[item.importId]) continue

    const decision = config.decisions.find((d) => d.importId === item.importId)
    await processDecision(
      item.importId,
      decision || {
        importId: item.importId,
        decisionType: "create_new",
      },
      undefined
    )
  }
}

/**
 * 小計グループのID統合処理
 */
async function processSubtotalGroupIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["subtotalGroup"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
  },
  warnings: string[],
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const groupPreMatch = preMatchResult.subtotalGroup

  // ID一致したもの
  for (const match of groupPreMatch.byId) {
    idMappings.subtotalGroup[match.importId] = match.existingId
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importGroup = data.subtotalsData.subtotalGroups.find(
      (g) => g.id === importId
    )
    if (!importGroup) return

    if (!decision || decision.decisionType === "create_new") {
      const existingByName = await tx.subtotalGroup.findFirst({
        where: { name: importGroup.name },
      })

      if (existingByName) {
        idMappings.subtotalGroup[importId] = existingByName.id
        warnings.push(
          `小計グループ「${importGroup.name}」は既存データを使用します`
        )
      } else {
        const newId = randomUUID()
        await tx.subtotalGroup.create({
          data: {
            id: newId,
            name: importGroup.name,
          },
        })
        idMappings.subtotalGroup[importId] = newId
        counts.created.subtotalGroups++
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(
          `小計グループ「${importGroup.name}」の既存IDが見つかりません`
        )
        return
      }

      idMappings.subtotalGroup[importId] = existingId

      if (decision.idChoice === "use_import_id") {
        idChangeTargets.push({
          category: "subtotalGroup",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.subtotalGroups++
    }
  }

  // 名前一致
  if (groupPreMatch.byName) {
    for (const match of groupPreMatch.byName) {
      const decision = config.decisions.find(
        (d) => d.importId === match.importId
      )

      if (config.strategy === "by_name") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // どれにも一致しない
  for (const item of groupPreMatch.noMatch) {
    if (idMappings.subtotalGroup[item.importId]) continue

    const decision = config.decisions.find((d) => d.importId === item.importId)
    await processDecision(
      item.importId,
      decision || {
        importId: item.importId,
        decisionType: "create_new",
      },
      undefined
    )
  }
}

/**
 * Stage 2: ID変更処理
 *
 * 「書き出したPCに合わせる」を選んだ場合、既存IDを.scoreのIDに変更する。
 * FK制約があるため、関連テーブルも連鎖的に更新する。
 *
 * @param targets - ID変更対象のリスト
 * @param idMappings - IDマッピング
 * @param warnings - 警告メッセージ
 */
async function executeIdChanges(
  targets: IdChangeTarget[],
  idMappings: IdMappings,
  warnings: string[]
): Promise<void> {
  for (const target of targets) {
    try {
      await prisma.$transaction(async (tx) => {
        if (target.category === "student") {
          // Student IDの変更
          // FK: StudentClassMembership.studentId, ProjectStudent.studentId,
          //     StudentAnswerImage.studentId, QuestionScore.studentId

          // 新しいIDで一時的なレコードを作成し、FKを更新してから古いレコードを削除
          const existingStudent = await tx.student.findUnique({
            where: { id: target.existingId },
          })

          if (!existingStudent) return

          // 新しいIDで同じデータを作成
          await tx.student.create({
            data: {
              id: target.newId,
              studentNumber: existingStudent.studentNumber,
              lastName: existingStudent.lastName,
              firstName: existingStudent.firstName,
              lastNameKana: existingStudent.lastNameKana,
              firstNameKana: existingStudent.firstNameKana,
              enrollmentYear: existingStudent.enrollmentYear,
              createdAt: existingStudent.createdAt,
              updatedAt: existingStudent.updatedAt,
            },
          })

          // FK参照を更新
          await tx.studentClassMembership.updateMany({
            where: { studentId: target.existingId },
            data: { studentId: target.newId },
          })

          await tx.projectStudent.updateMany({
            where: { studentId: target.existingId },
            data: { studentId: target.newId },
          })

          await tx.studentAnswerImage.updateMany({
            where: { studentId: target.existingId },
            data: { studentId: target.newId },
          })

          await tx.questionScore.updateMany({
            where: { studentId: target.existingId },
            data: { studentId: target.newId },
          })

          // 古いレコードを削除
          await tx.student.delete({
            where: { id: target.existingId },
          })

          // マッピングを更新
          for (const [importId, mappedId] of Object.entries(
            idMappings.student
          )) {
            if (mappedId === target.existingId) {
              idMappings.student[importId] = target.newId
            }
          }
        } else if (target.category === "class") {
          // Class IDの変更
          // FK: StudentClassMembership.classId, ProjectClass.classId

          const existingClass = await tx.class.findUnique({
            where: { id: target.existingId },
          })

          if (!existingClass) return

          await tx.class.create({
            data: {
              id: target.newId,
              name: existingClass.name,
              classCode: existingClass.classCode,
              grade: existingClass.grade,
              description: existingClass.description,
              createdAt: existingClass.createdAt,
              updatedAt: existingClass.updatedAt,
            },
          })

          await tx.studentClassMembership.updateMany({
            where: { classId: target.existingId },
            data: { classId: target.newId },
          })

          await tx.projectClass.updateMany({
            where: { classId: target.existingId },
            data: { classId: target.newId },
          })

          await tx.class.delete({
            where: { id: target.existingId },
          })

          for (const [importId, mappedId] of Object.entries(idMappings.class)) {
            if (mappedId === target.existingId) {
              idMappings.class[importId] = target.newId
            }
          }
        } else if (target.category === "subtotalGroup") {
          // SubtotalGroup IDの変更
          // FK: ProjectSubtotalGroup.subtotalGroupId, Subtotal.subtotalGroupId

          const existingGroup = await tx.subtotalGroup.findUnique({
            where: { id: target.existingId },
          })

          if (!existingGroup) return

          await tx.subtotalGroup.create({
            data: {
              id: target.newId,
              name: existingGroup.name,
              createdAt: existingGroup.createdAt,
              updatedAt: existingGroup.updatedAt,
            },
          })

          await tx.projectSubtotalGroup.updateMany({
            where: { subtotalGroupId: target.existingId },
            data: { subtotalGroupId: target.newId },
          })

          await tx.subtotal.updateMany({
            where: { subtotalGroupId: target.existingId },
            data: { subtotalGroupId: target.newId },
          })

          await tx.subtotalGroup.delete({
            where: { id: target.existingId },
          })

          for (const [importId, mappedId] of Object.entries(
            idMappings.subtotalGroup
          )) {
            if (mappedId === target.existingId) {
              idMappings.subtotalGroup[importId] = target.newId
            }
          }
        }
      })
    } catch (error) {
      console.error(`Error changing ID for ${target.category}:`, error)
      warnings.push(
        `${target.category}のID変更に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    }
  }
}

/**
 * 画像ファイルをプロジェクトディレクトリにコピー
 * 既存のファイルがある場合はスキップ（プロジェクトID一致時のマージ対応）
 */
async function copyImportImages(
  data: ExtractedArchiveData,
  newProjectId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const projectDir = path.join(dataDir, "projects", newProjectId)

  const masterImagesDir = path.join(projectDir, "master-images")
  const answerSheetsDir = path.join(projectDir, "answer-sheets")
  fs.mkdirSync(masterImagesDir, { recursive: true })
  fs.mkdirSync(answerSheetsDir, { recursive: true })

  for (const srcPath of data.masterImagePaths) {
    const filename = path.basename(srcPath)
    const destPath = path.join(masterImagesDir, filename)
    // 既存ファイルがない場合のみコピー
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath)
    }
  }

  for (const srcPath of data.answerSheetPaths) {
    const relativePath = srcPath.substring(
      srcPath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const destPath = path.join(answerSheetsDir, relativePath)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    // 既存ファイルがない場合のみコピー
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * 画像レコードを作成（既存レコードがある場合はスキップ）
 */
async function createImportImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings
): Promise<void> {
  const newProjectId = Object.values(idMappings.project)[0]

  if (
    data.projectData.masterImages &&
    data.projectData.masterImages.length > 0
  ) {
    for (const img of data.projectData.masterImages) {
      const newProjectPageId = idMappings.projectPage[img.projectPageId]
      if (!newProjectPageId) continue

      // 既存のMasterImageレコードをチェック
      const existing = await prisma.masterImage.findFirst({
        where: { projectPageId: newProjectPageId },
      })
      if (existing) continue

      const filename = path.basename(img.imagePath)
      const newImagePath = `projects/${newProjectId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: randomUUID(),
          projectPageId: newProjectPageId,
          imagePath: newImagePath,
        },
      })
    }
  }

  if (
    data.projectData.studentAnswerImages &&
    data.projectData.studentAnswerImages.length > 0
  ) {
    for (const img of data.projectData.studentAnswerImages) {
      const newProjectPageId = idMappings.projectPage[img.projectPageId]
      const newStudentId = idMappings.student[img.studentId]
      if (!newProjectPageId || !newStudentId) continue

      // 既存のStudentAnswerImageレコードをチェック
      const existing = await prisma.studentAnswerImage.findFirst({
        where: {
          projectPageId: newProjectPageId,
          studentId: newStudentId,
        },
      })
      if (existing) continue

      const relativePath = img.imagePath.substring(
        img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
      )
      const newImagePath =
        `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
          /\\/g,
          "/"
        )

      await prisma.studentAnswerImage.create({
        data: {
          id: randomUUID(),
          projectPageId: newProjectPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }

    return
  }

  // v1.1.0以前との後方互換性
  for (const img of data.projectData.pageImages) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    if (!newProjectPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      // 既存のMasterImageレコードをチェック
      const existingMaster = await prisma.masterImage.findFirst({
        where: { projectPageId: newProjectPageId },
      })
      if (existingMaster) continue

      const newImagePath = `projects/${newProjectId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: randomUUID(),
          projectPageId: newProjectPageId,
          imagePath: newImagePath,
        },
      })
    } else if (img.imageType === "STUDENT_ANSWER" && img.studentId) {
      const newStudentId = idMappings.student[img.studentId]
      if (!newStudentId) continue

      // 既存のStudentAnswerImageレコードをチェック
      const existingAnswer = await prisma.studentAnswerImage.findFirst({
        where: {
          projectPageId: newProjectPageId,
          studentId: newStudentId,
        },
      })
      if (existingAnswer) continue

      const relativePath = img.imagePath.substring(
        img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
      )
      const newImagePath =
        `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
          /\\/g,
          "/"
        )

      await prisma.studentAnswerImage.create({
        data: {
          id: randomUUID(),
          projectPageId: newProjectPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }
  }
}

// =============================================================================
// 採点結果の競合解決
// =============================================================================

/**
 * 採点結果の競合を解決
 *
 * @param conflict - 競合データ
 * @param config - 競合解決設定
 * @returns "import"（インポートデータを使用）または "existing"（既存データを維持）
 */
function resolveScoringConflict(
  conflict: ScoringConflict,
  config?: ScoringConflictConfig
): "import" | "existing" {
  // デフォルト: newer_wins
  const strategy: ScoringConflictResolutionStrategy =
    config?.strategy ?? "newer_wins"

  switch (strategy) {
    case "import_wins":
      // すべてファイルの採点を使う
      return "import"

    case "existing_wins":
      // すべてこのPCの採点を使う
      return "existing"

    case "newer_wins": {
      // 新しい方（最終更新日時）を使う
      const importDate = new Date(conflict.importScore.updatedAt)
      const existingDate = new Date(conflict.existingScore.updatedAt)
      return importDate > existingDate ? "import" : "existing"
    }

    case "manual": {
      // 競合している採点を1つずつ確認する
      // manualResolutionsから個別の解決を取得
      const manualResolution = config?.manualResolutions?.[conflict.importScoreId]
      if (manualResolution) {
        return manualResolution
      }
      // 未設定の場合はデフォルトでnewer_winsと同じ動作
      const importDate = new Date(conflict.importScore.updatedAt)
      const existingDate = new Date(conflict.existingScore.updatedAt)
      return importDate > existingDate ? "import" : "existing"
    }

    default:
      // デフォルト: newer_wins
      const importDate = new Date(conflict.importScore.updatedAt)
      const existingDate = new Date(conflict.existingScore.updatedAt)
      return importDate > existingDate ? "import" : "existing"
  }
}
