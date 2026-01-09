/**
 * データ作成モジュール
 *
 * インポートデータをデータベースに作成
 */

import * as fs from "fs"
import * as path from "path"
import type { PrismaClient } from "@prisma/client"
import type { ArchiveDataCounts } from "../../../../types/projectArchive.types"
import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "./archiveExtractor"
import type { IdMappings } from "./idRemapper"
import { remapId, remapIdRequired } from "./idRemapper"

/** Prismaトランザクションクライアント型 */
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * 重複しないstudentIdを生成
 *
 * 既存のstudentIdがある場合は `_1`, `_2` のようなサフィックスを付与して
 * 一意性を保証する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalStudentId - 元のstudentId
 * @returns 一意なstudentId
 */
async function generateUniqueStudentId(
  tx: TransactionClient,
  originalStudentId: string
): Promise<string> {
  const existing = await tx.student.findUnique({
    where: { studentId: originalStudentId },
  })

  if (!existing) {
    return originalStudentId
  }

  // サフィックスを付けて重複を回避
  let suffix = 1
  let newStudentId = `${originalStudentId}_${suffix}`

  while (await tx.student.findUnique({ where: { studentId: newStudentId } })) {
    suffix++
    newStudentId = `${originalStudentId}_${suffix}`
  }

  return newStudentId
}

/**
 * 重複しない学級名を生成
 *
 * 既存の名前がある場合は `(2)`, `(3)` のようなサフィックスを付与して
 * 一意性を保証する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalName - 元の学級名
 * @returns 一意な学級名
 */
async function generateUniqueClassName(
  tx: TransactionClient,
  originalName: string
): Promise<string> {
  const existing = await tx.class.findUnique({
    where: { name: originalName },
  })

  if (!existing) {
    return originalName
  }

  // サフィックスを付けて重複を回避
  let suffix = 2
  let newName = `${originalName} (${suffix})`

  while (await tx.class.findUnique({ where: { name: newName } })) {
    suffix++
    newName = `${originalName} (${suffix})`
  }

  return newName
}

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
 * v0.3.0以降: userIdは現在ログインしているユーザーで上書き
 *
 * @param data - 展開されたアーカイブデータ
 * @param mappings - IDマッピング
 * @param currentUserId - 現在ログインしているユーザーID
 * @returns 作成結果
 */
export async function createImportedData(
  data: ExtractedArchiveData,
  mappings: IdMappings,
  currentUserId: string
): Promise<DataCreationResult> {
  const warnings: string[] = []
  const newProjectId = remapIdRequired(
    data.projectData.project.id,
    mappings.project
  )

  try {
    // トランザクションで全データを作成
    await prisma.$transaction(async (tx) => {
      // 1. 生徒を作成（重複するstudentIdはサフィックスを付与）
      for (const student of data.studentsData.students) {
        const uniqueStudentId = await generateUniqueStudentId(
          tx,
          student.studentId
        )

        if (uniqueStudentId !== student.studentId) {
          warnings.push(
            `生徒「${student.lastName} ${student.firstName}」のstudentIdを「${student.studentId}」から「${uniqueStudentId}」に変更しました`
          )
        }

        await tx.student.create({
          data: {
            id: remapIdRequired(student.id, mappings.student),
            studentId: uniqueStudentId,
            lastName: student.lastName,
            firstName: student.firstName,
            lastNameKana: student.lastNameKana,
            firstNameKana: student.firstNameKana,
            enrollmentYear: student.enrollmentYear,
          },
        })
      }

      // 2. 学級を作成（重複する名前はサフィックスを付与）
      for (const cls of data.classesData.classes) {
        const uniqueName = await generateUniqueClassName(tx, cls.name)

        if (uniqueName !== cls.name) {
          warnings.push(
            `学級名を「${cls.name}」から「${uniqueName}」に変更しました`
          )
        }

        await tx.class.create({
          data: {
            id: remapIdRequired(cls.id, mappings.class),
            name: uniqueName,
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

      // 4. ユーザー作成をスキップ
      // v0.3.0以降: アーカイブ内のユーザーは作成せず、現在のログインユーザーを使用

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

      // 8. UserProjectを作成（現在のログインユーザーのみ）
      // v0.3.0以降: アーカイブ内のUserProjectは無視し、現在のユーザーをOWNERとして作成
      await tx.userProject.create({
        data: {
          userId: currentUserId,
          projectId: newProjectId,
          role: "OWNER",
          invitedAt: new Date(),
          invitedBy: null,
        },
      })

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

      // 9.5. ProjectClassを作成 (v1.1.0+)
      for (const pc of data.projectData.projectClasses || []) {
        const newClassId = remapId(pc.classId, mappings.class)
        if (newClassId) {
          await tx.projectClass.create({
            data: {
              id: remapIdRequired(pc.id, mappings.projectClass),
              projectId: newProjectId,
              classId: newClassId,
              administered: pc.administered,
              statistics: pc.statistics,
              order: pc.order,
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
      // v0.3.0以降: userIdを現在のログインユーザーで上書き
      // v0.4.0以降: studentIdは必須フィールド
      for (const qs of data.scoresData.questionScores) {
        const newCropRegionId = remapId(qs.cropRegionId, mappings.cropRegion)
        const newStudentId = remapId(qs.studentId, mappings.student)

        // studentIdは必須フィールド
        if (newCropRegionId && newStudentId) {
          await tx.questionScore.create({
            data: {
              id: remapIdRequired(qs.id, mappings.questionScore),
              cropRegionId: newCropRegionId,
              studentId: newStudentId,
              partialScore: qs.partialScore
                ? parseFloat(qs.partialScore)
                : null,
              status: qs.status,
              userId: currentUserId,
            },
          })
        }
      }

      // 15. DrawingAnnotationを作成
      // v0.3.0以降: userIdを現在のログインユーザーで上書き
      for (const da of data.scoresData.drawingAnnotations) {
        const newQuestionScoreId = remapId(
          da.questionScoreId,
          mappings.questionScore
        )

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
              userId: currentUserId,
            },
          })
        }
      }
    })

    // 16. 画像ファイルをコピー
    await copyImages(data, newProjectId)

    // 17. 画像レコードを作成（画像コピー後）
    await createImageRecords(data, mappings, newProjectId)

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
 *
 * @param data - 展開されたアーカイブデータ
 * @param newProjectId - 新規プロジェクトID
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
 * 画像レコードを作成（MasterImage / StudentAnswerImage）
 *
 * - v1.2.0+: masterImages と studentAnswerImages を使用
 * - v1.1.0以前: pageImages から変換（後方互換性）
 *
 * @param data - 展開されたアーカイブデータ
 * @param mappings - IDマッピング
 * @param newProjectId - 新規プロジェクトID
 */
async function createImageRecords(
  data: ExtractedArchiveData,
  mappings: IdMappings,
  newProjectId: string
): Promise<void> {
  // v1.2.0+ 形式: masterImages と studentAnswerImages が存在する場合
  if (
    data.projectData.masterImages &&
    data.projectData.masterImages.length > 0
  ) {
    for (const img of data.projectData.masterImages) {
      const newProjectPageId = remapId(img.projectPageId, mappings.projectPage)
      if (!newProjectPageId) continue

      const filename = path.basename(img.imagePath)
      const newImagePath = `projects/${newProjectId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: remapIdRequired(img.id, mappings.masterImage),
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
      const newProjectPageId = remapId(img.projectPageId, mappings.projectPage)
      const newStudentId = remapId(img.studentId, mappings.student)
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
          id: remapIdRequired(img.id, mappings.studentAnswerImage),
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
    const newProjectPageId = remapId(img.projectPageId, mappings.projectPage)
    if (!newProjectPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      const newImagePath = `projects/${newProjectId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: remapIdRequired(img.id, mappings.pageImage),
          projectPageId: newProjectPageId,
          imagePath: newImagePath,
        },
      })
    } else if (img.imageType === "STUDENT_ANSWER" && img.studentId) {
      const newStudentId = remapId(img.studentId, mappings.student)
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
          id: remapIdRequired(img.id, mappings.pageImage),
          projectPageId: newProjectPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }
  }
}
