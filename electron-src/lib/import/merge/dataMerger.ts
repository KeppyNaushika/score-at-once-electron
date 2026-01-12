/**
 * データマージモジュール
 *
 * 競合解決結果に基づいてデータをマージ
 */

import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"
import type {
  ArchiveDataCounts,
  ConflictResolutions,
  MatchingConfig,
  MergeImportResult,
} from "../../../../types/projectArchive.types"
import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"
import { detectAllConflicts } from "./conflictDetector"
import { resolveConflict } from "./conflictResolver"
import { performAllMatching } from "./matcher"

/** マージ操作のカウンター */
interface MergeCounts {
  created: ArchiveDataCounts
  updated: ArchiveDataCounts
  skipped: ArchiveDataCounts
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
 * マージインポートを実行
 *
 * 既存データとのマッチングを行い、競合解決設定に基づいてデータをマージする。
 * ユニーク制約のあるフィールド（studentNumber, name, username）は
 * マッチング方法に関わらず既存チェックを行い、重複を回避する。
 *
 * @param data - 展開されたアーカイブデータ
 * @param config - マッチング設定
 * @param resolutions - 競合解決設定
 * @param currentUserId - 現在ログインしているユーザーID
 * @returns マージインポート結果
 */
export async function executeMergeImport(
  data: ExtractedArchiveData,
  config: MatchingConfig,
  resolutions: ConflictResolutions,
  currentUserId: string
): Promise<MergeImportResult> {
  const warnings: string[] = []
  const counts: MergeCounts = {
    created: createEmptyCounts(),
    updated: createEmptyCounts(),
    skipped: createEmptyCounts(),
  }

  // IDマッピング（インポートID -> 既存/新規ID）
  const idMappings = {
    student: {} as Record<string, string>,
    class: {} as Record<string, string>,
    user: {} as Record<string, string>,
    subtotalGroup: {} as Record<string, string>,
    subtotal: {} as Record<string, string>,
    project: {} as Record<string, string>,
    projectPage: {} as Record<string, string>,
    cropRegion: {} as Record<string, string>,
    masterImage: {} as Record<string, string>,
    studentAnswerImage: {} as Record<string, string>,
    projectStudent: {} as Record<string, string>,
    userProject: {} as Record<string, string>,
    projectSubtotalGroup: {} as Record<string, string>,
    cropSubtotal: {} as Record<string, string>,
    questionScore: {} as Record<string, string>,
    drawingAnnotation: {} as Record<string, string>,
    membership: {} as Record<string, string>,
  }

  try {
    // 競合検出
    const conflictResult = await detectAllConflicts(data, config)
    if (!conflictResult.success) {
      return { success: false, error: conflictResult.error }
    }

    // マッチング結果を取得
    const matchResults = await performAllMatching(data, config)

    // トランザクションで実行
    await prisma.$transaction(async (tx) => {
      // 1. 生徒のマージ
      for (const result of matchResults.students) {
        const importStudent = result.importData

        if (!result.existingData) {
          // マッチングで見つからなかった場合でも、studentNumberで既存チェック
          const existingByStudentNumber = await tx.student.findUnique({
            where: { studentNumber: importStudent.studentNumber },
          })

          if (existingByStudentNumber) {
            // studentNumberで既存データが見つかった場合は再利用
            idMappings.student[importStudent.id] = existingByStudentNumber.id
            warnings.push(
              `生徒「${importStudent.lastName} ${importStudent.firstName}」(出席番号: ${importStudent.studentNumber}) は既存データを使用します`
            )
          } else {
            // 新規作成
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
            idMappings.student[importStudent.id] = newId
            counts.created.students++
          }
        } else {
          // 既存データとの競合チェック
          const conflictItem = conflictResult.results
            .find((r) => r.category === "Student")
            ?.conflictItems.find((c) => c.importData.id === importStudent.id)

          if (conflictItem) {
            const resolution = resolveConflict(
              conflictItem,
              resolutions.Student
            )

            if (resolution === "import") {
              await tx.student.update({
                where: { id: result.existingData.id },
                data: {
                  studentNumber: importStudent.studentNumber,
                  lastName: importStudent.lastName,
                  firstName: importStudent.firstName,
                  lastNameKana: importStudent.lastNameKana,
                  firstNameKana: importStudent.firstNameKana,
                  enrollmentYear: importStudent.enrollmentYear,
                },
              })
              counts.updated.students++
            } else if (resolution === "skip") {
              counts.skipped.students++
            }
            // existing_winsの場合は何もしない
          }

          idMappings.student[importStudent.id] = result.existingData.id
        }
      }

      // 2. 学級のマージ
      for (const result of matchResults.classes) {
        const importClass = result.importData

        if (!result.existingData) {
          // マッチングで見つからなかった場合でも、nameで既存チェック
          const existingByName = await tx.class.findUnique({
            where: { name: importClass.name },
          })

          if (existingByName) {
            // nameで既存データが見つかった場合は再利用
            idMappings.class[importClass.id] = existingByName.id
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
            idMappings.class[importClass.id] = newId
            counts.created.classes++
          }
        } else {
          const conflictItem = conflictResult.results
            .find((r) => r.category === "Class")
            ?.conflictItems.find((c) => c.importData.id === importClass.id)

          if (conflictItem) {
            const resolution = resolveConflict(conflictItem, resolutions.Class)

            if (resolution === "import") {
              await tx.class.update({
                where: { id: result.existingData.id },
                data: {
                  name: importClass.name,
                  classCode: importClass.classCode,
                  grade: importClass.grade,
                  description: importClass.description,
                },
              })
              counts.updated.classes++
            } else if (resolution === "skip") {
              counts.skipped.classes++
            }
          }

          idMappings.class[importClass.id] = result.existingData.id
        }
      }

      // 3. ユーザーのマージ（パスコードは更新しない）
      for (const result of matchResults.users) {
        const importUser = result.importData

        if (!result.existingData) {
          // マッチングで見つからなかった場合でも、usernameで既存チェック
          const existingByUsername = await tx.user.findUnique({
            where: { username: importUser.username },
          })

          if (existingByUsername) {
            // usernameで既存データが見つかった場合は再利用
            idMappings.user[importUser.id] = existingByUsername.id
            warnings.push(
              `ユーザー "${importUser.name}" は既存データを使用します`
            )
          } else {
            const newId = randomUUID()
            await tx.user.create({
              data: {
                id: newId,
                username: importUser.username,
                name: importUser.name,
                role: importUser.role,
                passcode: "",
              },
            })
            idMappings.user[importUser.id] = newId
            counts.created.users++
            warnings.push(
              `新規ユーザー "${importUser.name}" のパスコードは空です`
            )
          }
        } else {
          // ユーザーは基本的に既存を維持
          idMappings.user[importUser.id] = result.existingData.id
        }
      }

      // 4. 小計グループのマージ
      for (const result of matchResults.subtotalGroups) {
        const importGroup = result.importData

        if (!result.existingData) {
          const newId = randomUUID()
          await tx.subtotalGroup.create({
            data: {
              id: newId,
              name: importGroup.name,
            },
          })
          idMappings.subtotalGroup[importGroup.id] = newId
          counts.created.subtotalGroups++
        } else {
          idMappings.subtotalGroup[importGroup.id] = result.existingData.id
        }
      }

      // 5. 小計のマージ
      for (const s of data.subtotalsData.subtotals) {
        const newGroupId = idMappings.subtotalGroup[s.subtotalGroupId]
        if (!newGroupId) continue

        // 既存の小計を検索
        const existing = await tx.subtotal.findFirst({
          where: {
            subtotalGroupId: newGroupId,
            name: s.name,
          },
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

      // 6. プロジェクトは常に新規作成
      const newProjectId = randomUUID()
      const project = data.projectData.project
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

      // 7. UserProject - 現在のログインユーザーをOWNERとして追加
      // アーカイブ内のUserProjectは無視し、現在のユーザーのみを追加
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

      // 8. ProjectSubtotalGroup
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

      // 9. ProjectStudent
      for (const ps of data.projectData.projectStudents) {
        const newStudentId = idMappings.student[ps.studentId]
        if (newStudentId) {
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

      // 10. ProjectPage
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

      // 11. CropRegion
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

      // 12. CropSubtotal
      for (const cs of data.subtotalsData.cropSubtotals) {
        const newRegionId = idMappings.cropRegion[cs.cropRegionId]
        const newSubtotalId = idMappings.subtotal[cs.subtotalId]
        if (newRegionId && newSubtotalId) {
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

      // 13. QuestionScore
      // userIdは現在のログインユーザーで上書き
      for (const qs of data.scoresData.questionScores) {
        const newRegionId = idMappings.cropRegion[qs.cropRegionId]
        const newStudentId = qs.studentId
          ? idMappings.student[qs.studentId]
          : null

        // studentIdは必須フィールド
        if (newRegionId && newStudentId) {
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

      // 14. DrawingAnnotation
      // userIdは現在のログインユーザーで上書き
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

      // 15. 学級所属
      for (const m of data.classesData.memberships) {
        const newStudentId = idMappings.student[m.studentId]
        const newClassId = idMappings.class[m.classId]

        if (newStudentId && newClassId) {
          // 既存の所属をチェック
          const existing = await tx.studentClassMembership.findFirst({
            where: {
              studentId: newStudentId,
              classId: newClassId,
            },
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

    // 16. 画像ファイルをコピー
    await copyMergeImages(data, idMappings.project[data.projectData.project.id])

    // 17. 画像レコードを作成（MasterImage / StudentAnswerImage）
    await createMergeImageRecords(data, idMappings)

    return {
      success: true,
      projectId: idMappings.project[data.projectData.project.id],
      summary: counts,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error("Error executing merge import:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "マージインポートに失敗しました",
    }
  }
}

/**
 * 画像ファイルをプロジェクトディレクトリにコピー
 *
 * @param data - 展開されたアーカイブデータ
 * @param newProjectId - 新規プロジェクトID
 */
async function copyMergeImages(
  data: ExtractedArchiveData,
  newProjectId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const projectDir = path.join(dataDir, "projects", newProjectId)

  const masterImagesDir = path.join(projectDir, "master-images")
  const answerSheetsDir = path.join(projectDir, "answer-sheets")
  fs.mkdirSync(masterImagesDir, { recursive: true })
  fs.mkdirSync(answerSheetsDir, { recursive: true })

  // マスター画像
  for (const srcPath of data.masterImagePaths) {
    const filename = path.basename(srcPath)
    const destPath = path.join(masterImagesDir, filename)
    fs.copyFileSync(srcPath, destPath)
  }

  // 答案画像
  for (const srcPath of data.answerSheetPaths) {
    const relativePath = srcPath.substring(
      srcPath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const destPath = path.join(answerSheetsDir, relativePath)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.copyFileSync(srcPath, destPath)
  }
}

/**
 * 画像レコードを作成（MasterImage / StudentAnswerImage）
 *
 * - v1.2.0+: masterImages と studentAnswerImages を使用
 * - v1.1.0以前: pageImages から変換（後方互換性）
 *
 * @param data - 展開されたアーカイブデータ
 * @param idMappings - IDマッピング
 */
async function createMergeImageRecords(
  data: ExtractedArchiveData,
  idMappings: Record<string, Record<string, string>>
): Promise<void> {
  const newProjectId = Object.values(idMappings.project)[0]

  // v1.2.0+ 形式: masterImages と studentAnswerImages が存在する場合
  if (
    data.projectData.masterImages &&
    data.projectData.masterImages.length > 0
  ) {
    for (const img of data.projectData.masterImages) {
      const newProjectPageId = idMappings.projectPage[img.projectPageId]
      if (!newProjectPageId) continue

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

  // v1.1.0以前: pageImages から変換（後方互換性）
  for (const img of data.projectData.pageImages) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    if (!newProjectPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
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
