/**
 * プロジェクトアーカイブ用データ収集
 *
 * プロジェクトに関連する全データをエクスポート用に収集する
 */

import type {
  ArchiveClassesData,
  ArchiveDataCounts,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubjectsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
  ExportMode,
} from "../../../../types/projectArchive.types"
import prisma from "../../prisma/client"

/**
 * 収集結果
 */
export interface CollectedData {
  projectData: ArchiveProjectData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  subjectsData: ArchiveSubjectsData
  counts: ArchiveDataCounts
  /** マスター画像の相対パス一覧 */
  masterImagePaths: string[]
  /** 答案画像の相対パス一覧 */
  answerSheetPaths: string[]
}

/**
 * プロジェクトの全関連データを収集
 *
 * @param projectId - 対象プロジェクトID
 * @param userId - ログインユーザーID（このユーザーのデータのみ収集）
 * @param exportMode - エクスポートモード（デフォルト: full）
 * @returns 収集されたデータ
 */
export async function collectProjectData(
  projectId: string,
  userId: string,
  exportMode: ExportMode = "full"
): Promise<{ success: boolean; data?: CollectedData; error?: string }> {
  try {
    const isTemplate =
      exportMode === "template" || exportMode === "template_with_subtotals"

    // 1. プロジェクト基本データを取得
    // クエリは常にフルで取得し、データ整形段階でモードに応じてフィルタリングする
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        projectPages: {
          include: {
            masterImages: true,
            studentAnswerImages: true,
            cropRegions: {
              include: {
                cropSubtotals: true,
                questionScores: {
                  include: {
                    drawingAnnotations: true,
                  },
                },
              },
            },
          },
          orderBy: { pageNumber: "asc" },
        },
        projectStudents: true,
        userProjects: true,
        projectSubtotalGroups: true,
        projectClasses: true,
      },
    })

    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    // 2. 関連する生徒IDを収集（templateモードではスキップ）
    const studentIds = new Set<string>()
    if (!isTemplate) {
      for (const ps of project.projectStudents) {
        studentIds.add(ps.studentId)
      }
      for (const page of project.projectPages) {
        for (const img of page.studentAnswerImages) {
          studentIds.add(img.studentId)
        }
        for (const region of page.cropRegions) {
          for (const score of region.questionScores) {
            studentIds.add(score.studentId)
          }
        }
      }
    }

    // 3. 生徒データを取得（templateモードでは空）
    const students = isTemplate
      ? []
      : await prisma.student.findMany({
          where: { id: { in: Array.from(studentIds) } },
        })

    // 4. 関連する学級と所属を取得（templateモードでは空）
    const memberships = isTemplate
      ? []
      : await prisma.studentClassMembership.findMany({
          where: { studentId: { in: Array.from(studentIds) } },
        })

    const classIds = new Set(memberships.map((m) => m.classId))
    const classes = isTemplate
      ? []
      : await prisma.class.findMany({
          where: { id: { in: Array.from(classIds) } },
        })

    // 5. 現在のユーザーのみを取得（パスコードは除外）
    // v0.3.0以降: ログインユーザーのデータのみをエクスポート
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!currentUser) {
      return { success: false, error: "ユーザーが見つかりません" }
    }

    const users = [currentUser]

    // 7. 小計グループと小計を取得（templateモードでは空）
    const includeSubtotals = exportMode !== "template"
    const subtotalGroupIds = new Set(
      includeSubtotals
        ? project.projectSubtotalGroups.map((psg) => psg.subtotalGroupId)
        : []
    )
    const subtotalGroups = includeSubtotals
      ? await prisma.subtotalGroup.findMany({
          where: { id: { in: Array.from(subtotalGroupIds) } },
          include: { subtotals: true },
        })
      : []

    // 7.5. ProjectMarkingFormatを取得
    const projectMarkingFormats = await prisma.projectMarkingFormat.findMany({
      where: { projectId },
    })

    // 7.6. ProjectExportSettingsを取得
    const projectExportSettings = await prisma.projectExportSettings.findUnique(
      {
        where: { projectId },
      }
    )

    // 7.7. CropRegionMarkingOverrideを取得
    const cropRegionIds = project.projectPages.flatMap((page) =>
      page.cropRegions.map((r) => r.id)
    )
    const cropRegionMarkingOverrides =
      await prisma.cropRegionMarkingOverride.findMany({
        where: { cropRegionId: { in: cropRegionIds } },
      })

    // 7.8. Subject/SubjectSubtotalGroupを取得（subtotalGroup経由、templateモードでは空）
    const subtotalGroupIdArray = Array.from(subtotalGroupIds)
    const subjectSubtotalGroups = includeSubtotals
      ? await prisma.subjectSubtotalGroup.findMany({
          where: { subtotalGroupId: { in: subtotalGroupIdArray } },
        })
      : []
    const subjectIds = [
      ...new Set(subjectSubtotalGroups.map((ssg) => ssg.subjectId)),
    ]
    const subjects = includeSubtotals
      ? await prisma.subject.findMany({
          where: { id: { in: subjectIds } },
        })
      : []

    // CropSubtotalを収集（templateモードでは空）
    const cropSubtotals: Array<{
      id: string
      cropRegionId: string
      subtotalId: string
      assignmentType: string
      createdAt: Date
      updatedAt: Date
    }> = []
    if (includeSubtotals) {
      for (const page of project.projectPages) {
        for (const region of page.cropRegions) {
          for (const cs of region.cropSubtotals) {
            cropSubtotals.push(cs)
          }
        }
      }
    }

    // 8. 画像パスを収集（templateモードでは答案画像は空）
    const masterImagePaths: string[] = []
    const answerSheetPaths: string[] = []

    for (const page of project.projectPages) {
      for (const img of page.masterImages) {
        masterImagePaths.push(img.imagePath)
      }
      if (!isTemplate) {
        for (const img of page.studentAnswerImages) {
          answerSheetPaths.push(img.imagePath)
        }
      }
    }

    // 9. QuestionScoreとDrawingAnnotationを収集（templateモードでは空）
    // v0.3.0以降: ログインユーザーのデータのみをエクスポート
    const questionScores: ArchiveScoresData["questionScores"] = []
    const drawingAnnotations: ArchiveScoresData["drawingAnnotations"] = []

    if (!isTemplate) {
      for (const page of project.projectPages) {
        for (const region of page.cropRegions) {
          for (const score of region.questionScores) {
            // ログインユーザーの採点データのみを収集
            if (score.userId !== userId) {
              continue
            }

            questionScores.push({
              id: score.id,
              cropRegionId: score.cropRegionId,
              studentId: score.studentId,
              partialScore: score.partialScore?.toString() ?? null,
              status: score.status,
              userId: score.userId,
              createdAt: score.createdAt.toISOString(),
              updatedAt: score.updatedAt.toISOString(),
            })

            for (const ann of score.drawingAnnotations) {
              // ログインユーザーのアノテーションのみを収集
              if (ann.userId !== userId) {
                continue
              }

              drawingAnnotations.push({
                id: ann.id,
                questionScoreId: ann.questionScoreId,
                type: ann.type,
                x: ann.x,
                y: ann.y,
                color: ann.color,
                strokeWidth: ann.strokeWidth,
                width: ann.width,
                height: ann.height,
                endX: ann.endX,
                endY: ann.endY,
                lineStyle: ann.lineStyle,
                text: ann.text,
                fontSize: ann.fontSize,
                textBoxWidth: ann.textBoxWidth,
                textBoxHeight: ann.textBoxHeight,
                horizontalAlign: ann.horizontalAlign,
                verticalAlign: ann.verticalAlign,
                anchorDirection: ann.anchorDirection,
                displayX: ann.displayX,
                displayY: ann.displayY,
                userId: ann.userId,
                createdAt: ann.createdAt.toISOString(),
                updatedAt: ann.updatedAt.toISOString(),
              })
            }
          }
        }
      }
    }

    // 10. データを整形
    const projectData: ArchiveProjectData = {
      project: {
        id: project.id,
        examName: project.examName,
        examDate: project.examDate?.toISOString() ?? null,
        subject: project.subject,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      projectPages: project.projectPages.map((page) => ({
        id: page.id,
        projectId: page.projectId,
        pageNumber: page.pageNumber,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      })),
      cropRegions: project.projectPages.flatMap((page) =>
        page.cropRegions.map((region) => ({
          id: region.id,
          projectPageId: region.projectPageId,
          label: region.label,
          type: region.type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          points: region.points,
          orderIndex: region.orderIndex,
          createdAt: region.createdAt.toISOString(),
          updatedAt: region.updatedAt.toISOString(),
        }))
      ),
      // v1.2.0+: pageImagesは空配列（後方互換性のため維持）
      pageImages: [],
      // v1.2.0+: 新形式
      masterImages: project.projectPages.flatMap((page) =>
        page.masterImages.map((img) => ({
          id: img.id,
          projectPageId: img.projectPageId,
          imagePath: img.imagePath,
          createdAt: img.createdAt.toISOString(),
          updatedAt: img.updatedAt.toISOString(),
        }))
      ),
      studentAnswerImages: isTemplate
        ? []
        : project.projectPages.flatMap((page) =>
            page.studentAnswerImages.map((img) => ({
              id: img.id,
              projectPageId: img.projectPageId,
              studentId: img.studentId,
              imagePath: img.imagePath,
              createdAt: img.createdAt.toISOString(),
              updatedAt: img.updatedAt.toISOString(),
            }))
          ),
      projectStudents: isTemplate
        ? []
        : project.projectStudents.map((ps) => ({
            id: ps.id,
            projectId: ps.projectId,
            studentId: ps.studentId,
            status: ps.status,
            customOrder: ps.customOrder,
            createdAt: ps.createdAt.toISOString(),
            updatedAt: ps.updatedAt.toISOString(),
          })),
      // v0.3.0以降: UserProjectは無視（インポート時に現在のユーザーで作成）
      userProjects: [],
      projectSubtotalGroups: includeSubtotals
        ? project.projectSubtotalGroups.map((psg) => ({
            id: psg.id,
            projectId: psg.projectId,
            subtotalGroupId: psg.subtotalGroupId,
            createdAt: psg.createdAt.toISOString(),
            updatedAt: psg.updatedAt.toISOString(),
          }))
        : [],
      projectClasses: isTemplate
        ? []
        : project.projectClasses.map((pc) => ({
            id: pc.id,
            projectId: pc.projectId,
            classId: pc.classId,
            administered: pc.administered,
            statistics: pc.statistics,
            order: pc.order,
            createdAt: pc.createdAt.toISOString(),
            updatedAt: pc.updatedAt.toISOString(),
          })),
      // v1.4.0+
      projectMarkingFormats: projectMarkingFormats.map((pmf) => ({
        id: pmf.id,
        projectId: pmf.projectId,
        markType: pmf.markType,
        symbol: pmf.symbol,
        color: pmf.color,
        fontSize: pmf.fontSize,
        strokeWidth: pmf.strokeWidth,
        createdAt: pmf.createdAt.toISOString(),
        updatedAt: pmf.updatedAt.toISOString(),
      })),
      projectExportSettings: projectExportSettings
        ? {
            id: projectExportSettings.id,
            projectId: projectExportSettings.projectId,
            settingsJson: projectExportSettings.settingsJson,
            createdAt: projectExportSettings.createdAt.toISOString(),
            updatedAt: projectExportSettings.updatedAt.toISOString(),
          }
        : null,
      cropRegionMarkingOverrides: cropRegionMarkingOverrides.map((crmo) => ({
        id: crmo.id,
        cropRegionId: crmo.cropRegionId,
        markType: crmo.markType,
        symbol: crmo.symbol,
        color: crmo.color,
        visible: crmo.visible,
        createdAt: crmo.createdAt.toISOString(),
        updatedAt: crmo.updatedAt.toISOString(),
      })),
    }

    const studentsData: ArchiveStudentsData = {
      students: students.map((s) => ({
        id: s.id,
        studentNumber: s.studentNumber,
        lastName: s.lastName,
        firstName: s.firstName,
        lastNameKana: s.lastNameKana,
        firstNameKana: s.firstNameKana,
        enrollmentYear: s.enrollmentYear,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    }

    const classesData: ArchiveClassesData = {
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        classCode: c.classCode,
        grade: c.grade,
        description: c.description,
        isVisible: c.isVisible,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      memberships: memberships.map((m) => ({
        id: m.id,
        studentId: m.studentId,
        classId: m.classId,
        startDate: m.startDate.toISOString(),
        endDate: m.endDate?.toISOString() ?? null,
        attendanceNumber: m.attendanceNumber,
        notes: m.notes,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    }

    const usersData: ArchiveUsersData = {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
    }

    const subtotalsData: ArchiveSubtotalsData = {
      subtotalGroups: subtotalGroups.map((sg) => ({
        id: sg.id,
        name: sg.name,
        createdAt: sg.createdAt.toISOString(),
        updatedAt: sg.updatedAt.toISOString(),
      })),
      subtotals: subtotalGroups.flatMap((sg) =>
        sg.subtotals.map((s) => ({
          id: s.id,
          name: s.name,
          subtotalGroupId: s.subtotalGroupId,
          order: s.order,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }))
      ),
      cropSubtotals: cropSubtotals.map((cs) => ({
        id: cs.id,
        cropRegionId: cs.cropRegionId,
        subtotalId: cs.subtotalId,
        assignmentType: cs.assignmentType,
        createdAt: cs.createdAt.toISOString(),
        updatedAt: cs.updatedAt.toISOString(),
      })),
    }

    const scoresData: ArchiveScoresData = {
      questionScores,
      drawingAnnotations,
    }

    const subjectsData: ArchiveSubjectsData = {
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      subjectSubtotalGroups: subjectSubtotalGroups.map((ssg) => ({
        id: ssg.id,
        subjectId: ssg.subjectId,
        subtotalGroupId: ssg.subtotalGroupId,
        createdAt: ssg.createdAt.toISOString(),
        updatedAt: ssg.updatedAt.toISOString(),
      })),
    }

    // 11. 件数を集計
    const counts: ArchiveDataCounts = {
      students: students.length,
      classes: classes.length,
      users: users.length,
      pages: project.projectPages.length,
      regions: projectData.cropRegions.length,
      scores: questionScores.length,
      annotations: drawingAnnotations.length,
      subtotalGroups: subtotalGroups.length,
      masterImages: masterImagePaths.length,
      answerSheetImages: answerSheetPaths.length,
    }

    return {
      success: true,
      data: {
        projectData,
        studentsData,
        classesData,
        usersData,
        subtotalsData,
        scoresData,
        subjectsData,
        counts,
        masterImagePaths,
        answerSheetPaths,
      },
    }
  } catch (error) {
    console.error("Error collecting project data:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "データ収集に失敗しました",
    }
  }
}
