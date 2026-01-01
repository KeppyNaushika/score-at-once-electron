/**
 * データ作成モジュール
 *
 * インポートデータをデータベースに作成
 */

import * as fs from "fs"
import * as path from "path"
import type { ArchiveDataCounts } from "../../../../types/projectArchive.types"
import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "./archiveExtractor"
import type { IdMappings } from "./idRemapper"
import { remapId, remapIdRequired } from "./idRemapper"

/**
 * データ作成結果
 */
export interface DataCreationResult {
  success: boolean
  projectId?: string
  counts?: ArchiveDataCounts
  warnings?: string[]
  error?: string
}

/**
 * 新規作成モードでデータをインポート
 *
 * 全てのデータを新規UUIDで作成し、参照関係を維持
 *
 * @param data - 展開されたアーカイブデータ
 * @param mappings - IDマッピング
 * @returns 作成結果
 */
export async function createImportedData(
  data: ExtractedArchiveData,
  mappings: IdMappings
): Promise<DataCreationResult> {
  const warnings: string[] = []
  const newProjectId = remapIdRequired(
    data.projectData.project.id,
    mappings.project
  )

  try {
    // トランザクションで全データを作成
    await prisma.$transaction(async (tx) => {
      // 1. 生徒を作成
      for (const student of data.studentsData.students) {
        await tx.student.create({
          data: {
            id: remapIdRequired(student.id, mappings.student),
            studentId: student.studentId,
            lastName: student.lastName,
            firstName: student.firstName,
            lastNameKana: student.lastNameKana,
            firstNameKana: student.firstNameKana,
            enrollmentYear: student.enrollmentYear,
          },
        })
      }

      // 2. 学級を作成
      for (const cls of data.classesData.classes) {
        await tx.class.create({
          data: {
            id: remapIdRequired(cls.id, mappings.class),
            name: cls.name,
            classCode: cls.classCode,
            grade: cls.grade,
            description: cls.description,
            isVisible: cls.isVisible,
          },
        })
      }

      // 3. 学級所属を作成
      for (const membership of data.classesData.memberships) {
        const newStudentId = remapId(membership.studentId, mappings.student)
        const newClassId = remapId(membership.classId, mappings.class)

        if (newStudentId && newClassId) {
          await tx.studentClassMembership.create({
            data: {
              id: remapIdRequired(membership.id, mappings.membership),
              studentId: newStudentId,
              classId: newClassId,
              startDate: new Date(membership.startDate),
              endDate: membership.endDate ? new Date(membership.endDate) : null,
              attendanceNumber: membership.attendanceNumber,
              notes: membership.notes,
            },
          })
        }
      }

      // 4. ユーザーを作成（パスコードなしで作成）
      for (const user of data.usersData.users) {
        await tx.user.create({
          data: {
            id: remapIdRequired(user.id, mappings.user),
            username: user.username,
            name: user.name,
            role: user.role,
            passcode: "", // パスコードは空で作成
          },
        })
      }
      if (data.usersData.users.length > 0) {
        warnings.push(
          "インポートされたユーザーのパスコードは空に設定されています。必要に応じて再設定してください。"
        )
      }

      // 5. 小計グループを作成
      for (const sg of data.subtotalsData.subtotalGroups) {
        await tx.subtotalGroup.create({
          data: {
            id: remapIdRequired(sg.id, mappings.subtotalGroup),
            name: sg.name,
          },
        })
      }

      // 6. 小計を作成
      for (const s of data.subtotalsData.subtotals) {
        await tx.subtotal.create({
          data: {
            id: remapIdRequired(s.id, mappings.subtotal),
            name: s.name,
            subtotalGroupId: remapIdRequired(
              s.subtotalGroupId,
              mappings.subtotalGroup
            ),
            order: s.order,
          },
        })
      }

      // 7. プロジェクトを作成
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

      // 8. UserProjectを作成
      for (const up of data.projectData.userProjects) {
        const newUserId = remapId(up.userId, mappings.user)
        const newInvitedBy = up.invitedBy
          ? remapId(up.invitedBy, mappings.user)
          : null
        if (newUserId) {
          await tx.userProject.create({
            data: {
              id: remapIdRequired(up.id, mappings.userProject),
              userId: newUserId,
              projectId: newProjectId,
              role: up.role,
              invitedAt: up.invitedAt ? new Date(up.invitedAt) : new Date(),
              invitedBy: newInvitedBy,
            },
          })
        }
      }

      // 9. ProjectSubtotalGroupを作成
      for (const psg of data.projectData.projectSubtotalGroups) {
        const newSubtotalGroupId = remapId(
          psg.subtotalGroupId,
          mappings.subtotalGroup
        )
        if (newSubtotalGroupId) {
          await tx.projectSubtotalGroup.create({
            data: {
              id: remapIdRequired(psg.id, mappings.projectSubtotalGroup),
              projectId: newProjectId,
              subtotalGroupId: newSubtotalGroupId,
            },
          })
        }
      }

      // 10. ProjectStudentを作成
      for (const ps of data.projectData.projectStudents) {
        const newStudentId = remapId(ps.studentId, mappings.student)
        if (newStudentId) {
          await tx.projectStudent.create({
            data: {
              id: remapIdRequired(ps.id, mappings.projectStudent),
              projectId: newProjectId,
              studentId: newStudentId,
              status: ps.status,
              customOrder: ps.customOrder,
            },
          })
        }
      }

      // 11. ProjectPageを作成
      for (const page of data.projectData.projectPages) {
        await tx.projectPage.create({
          data: {
            id: remapIdRequired(page.id, mappings.projectPage),
            projectId: newProjectId,
            pageNumber: page.pageNumber,
          },
        })
      }

      // 12. CropRegionを作成
      for (const region of data.projectData.cropRegions) {
        await tx.cropRegion.create({
          data: {
            id: remapIdRequired(region.id, mappings.cropRegion),
            projectPageId: remapIdRequired(
              region.projectPageId,
              mappings.projectPage
            ),
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
      }

      // 13. CropSubtotalを作成
      for (const cs of data.subtotalsData.cropSubtotals) {
        const newCropRegionId = remapId(cs.cropRegionId, mappings.cropRegion)
        const newSubtotalId = remapId(cs.subtotalId, mappings.subtotal)
        if (newCropRegionId && newSubtotalId) {
          await tx.cropSubtotal.create({
            data: {
              id: remapIdRequired(cs.id, mappings.cropSubtotal),
              cropRegionId: newCropRegionId,
              subtotalId: newSubtotalId,
              assignmentType: cs.assignmentType,
            },
          })
        }
      }

      // 14. QuestionScoreを作成
      for (const qs of data.scoresData.questionScores) {
        const newCropRegionId = remapId(qs.cropRegionId, mappings.cropRegion)
        const newStudentId = remapId(qs.studentId, mappings.student)
        const newScoredByUserId = remapId(qs.scoredByUserId, mappings.user)

        if (newCropRegionId) {
          await tx.questionScore.create({
            data: {
              id: remapIdRequired(qs.id, mappings.questionScore),
              cropRegionId: newCropRegionId,
              studentId: newStudentId,
              partialScore: qs.partialScore
                ? parseFloat(qs.partialScore)
                : null,
              status: qs.status,
              scoredByUserId: newScoredByUserId,
            },
          })
        }
      }

      // 15. DrawingAnnotationを作成
      for (const da of data.scoresData.drawingAnnotations) {
        const newQuestionScoreId = remapId(
          da.questionScoreId,
          mappings.questionScore
        )
        const newCreatedByUserId = remapId(da.createdByUserId, mappings.user)

        if (newQuestionScoreId) {
          await tx.drawingAnnotation.create({
            data: {
              id: remapIdRequired(da.id, mappings.drawingAnnotation),
              questionScoreId: newQuestionScoreId,
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
              createdByUserId: newCreatedByUserId,
            },
          })
        }
      }
    })

    // 16. 画像ファイルをコピー
    await copyImages(data, newProjectId)

    // 17. PageImageレコードを作成（画像コピー後）
    await createPageImageRecords(data, mappings)

    return {
      success: true,
      projectId: newProjectId,
      counts: {
        students: data.studentsData.students.length,
        classes: data.classesData.classes.length,
        users: data.usersData.users.length,
        pages: data.projectData.projectPages.length,
        regions: data.projectData.cropRegions.length,
        scores: data.scoresData.questionScores.length,
        annotations: data.scoresData.drawingAnnotations.length,
        subtotalGroups: data.subtotalsData.subtotalGroups.length,
        masterImages: data.masterImagePaths.length,
        answerSheetImages: data.answerSheetPaths.length,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error("Error creating imported data:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "データの作成に失敗しました",
    }
  }
}

/**
 * 画像ファイルをプロジェクトディレクトリにコピー
 */
async function copyImages(
  data: ExtractedArchiveData,
  newProjectId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const projectDir = path.join(dataDir, "projects", newProjectId)

  // プロジェクトディレクトリを作成
  const masterImagesDir = path.join(projectDir, "master-images")
  const answerSheetsDir = path.join(projectDir, "answer-sheets")
  fs.mkdirSync(masterImagesDir, { recursive: true })
  fs.mkdirSync(answerSheetsDir, { recursive: true })

  // マスター画像をコピー
  for (const srcPath of data.masterImagePaths) {
    const filename = path.basename(srcPath)
    const destPath = path.join(masterImagesDir, filename)
    fs.copyFileSync(srcPath, destPath)
  }

  // 答案画像をコピー（生徒IDでサブディレクトリを分ける場合がある）
  for (const srcPath of data.answerSheetPaths) {
    // 相対パス構造を維持
    const relativePath = srcPath.substring(
      srcPath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const destPath = path.join(answerSheetsDir, relativePath)

    // ディレクトリを作成
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.copyFileSync(srcPath, destPath)
  }
}

/**
 * PageImageレコードを作成
 */
async function createPageImageRecords(
  data: ExtractedArchiveData,
  mappings: IdMappings
): Promise<void> {
  for (const img of data.projectData.pageImages) {
    const newProjectPageId = remapId(img.projectPageId, mappings.projectPage)
    const newStudentId = remapId(img.studentId, mappings.student)
    const newProjectId = Object.values(mappings.project)[0]

    if (!newProjectPageId) continue

    // 新しいパスを計算（相対パスで保存）
    const filename = path.basename(img.imagePath)
    let newImagePath: string

    if (img.imageType === "MODEL_ANSWER") {
      newImagePath = `projects/${newProjectId}/master-images/${filename}`
    } else {
      // STUDENT_ANSWERの場合、元のパス構造を維持
      const relativePath = img.imagePath.substring(
        img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
      )
      newImagePath =
        `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
          /\\/g,
          "/"
        )
    }

    await prisma.pageImage.create({
      data: {
        id: remapIdRequired(img.id, mappings.pageImage),
        projectPageId: newProjectPageId,
        studentId: newStudentId,
        imagePath: newImagePath,
        imageType: img.imageType,
      },
    })
  }
}
