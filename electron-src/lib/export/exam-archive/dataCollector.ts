/**
 * 試験アーカイブ用データ収集
 *
 * 試験に関連する全データをエクスポート用に収集する
 */

import type {
  ArchiveClassesData,
  ArchiveDataCounts,
  ArchiveDeletedRecordsData,
  ArchiveExamData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveTagsData,
  ArchiveUsersData,
  ExportMode,
} from "../../../../src/types/examArchive.types"
import prisma from "../../prisma/client"

/**
 * 収集結果
 */
export interface CollectedData {
  examData: ArchiveExamData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  tagsData: ArchiveTagsData
  deletedRecordsData: ArchiveDeletedRecordsData
  counts: ArchiveDataCounts
  /** マスター画像の相対パス一覧 */
  masterImagePaths: string[]
  /** 答案画像の相対パス一覧 */
  answerSheetPaths: string[]
}

/**
 * 試験の全関連データを収集
 *
 * @param examId - 対象試験ID
 * @param userId - ログインユーザーID（このユーザーのデータのみ収集）
 * @param exportMode - エクスポートモード（デフォルト: full）
 * @returns 収集されたデータ
 */
export async function collectExamData(
  examId: string,
  userId: string,
  exportMode: ExportMode = "full"
): Promise<{ success: boolean; data?: CollectedData; error?: string }> {
  try {
    const isTemplate =
      exportMode === "template" || exportMode === "template_with_subtotals"

    // 1. 試験基本データを取得
    // クエリは常にフルで取得し、データ整形段階でモードに応じてフィルタリングする
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examPages: {
          include: {
            masterImages: true,
            studentAnswerImages: true,
            cropRegions: {
              include: {
                cropSubtotals: true,
                omrConfig: {
                  include: {
                    choiceOptions: true,
                  },
                },
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
        examStudents: true,
        userExams: true,
        examSubtotalGroups: true,
        examClasses: true,
      },
    })

    if (!exam) {
      return { success: false, error: "試験が見つかりません" }
    }

    // 2. 関連する生徒IDを収集（templateモードではスキップ）
    const studentIds = new Set<string>()
    if (!isTemplate) {
      for (const ps of exam.examStudents) {
        studentIds.add(ps.studentId)
      }
      for (const page of exam.examPages) {
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
        ? exam.examSubtotalGroups.map((psg) => psg.subtotalGroupId)
        : []
    )
    const subtotalGroups = includeSubtotals
      ? await prisma.subtotalGroup.findMany({
          where: { id: { in: Array.from(subtotalGroupIds) } },
          include: { subtotals: true },
        })
      : []

    // 7.5. ExamMarkingFormatを取得
    const examMarkingFormats = await prisma.examMarkingFormat.findMany({
      where: { examId },
    })

    // 7.6. ExamExportSettingsを取得
    const examExportSettings = await prisma.examExportSettings.findUnique({
      where: { examId },
    })

    // 7.7. CropRegionMarkingOverrideを取得
    const cropRegionIds = exam.examPages.flatMap((page) =>
      page.cropRegions.map((r) => r.id)
    )
    const cropRegionMarkingOverrides =
      await prisma.cropRegionMarkingOverride.findMany({
        where: { cropRegionId: { in: cropRegionIds } },
      })

    // 7.8. Tag/TagSubtotalGroup/ExamTagを取得（subtotalGroup経由、templateモードでは空）
    const subtotalGroupIdArray = Array.from(subtotalGroupIds)
    const tagSubtotalGroups = includeSubtotals
      ? await prisma.tagSubtotalGroup.findMany({
          where: { subtotalGroupId: { in: subtotalGroupIdArray } },
        })
      : []
    const tagIds = [...new Set(tagSubtotalGroups.map((tsg) => tsg.tagId))]
    const tags = includeSubtotals
      ? await prisma.tag.findMany({
          where: { id: { in: tagIds } },
        })
      : []
    const examTags = await prisma.examTag.findMany({
      where: { examId },
    })

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
      for (const page of exam.examPages) {
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

    for (const page of exam.examPages) {
      for (const img of page.masterImages) {
        // projects/ → exams/ パス正規化（v0.6.x リネーム対応）
        const normalized = img.imagePath.replace(/^projects\//, "exams/")
        masterImagePaths.push(normalized)
      }
      if (!isTemplate) {
        for (const img of page.studentAnswerImages) {
          const normalized = img.imagePath.replace(/^projects\//, "exams/")
          answerSheetPaths.push(normalized)
        }
      }
    }

    // 9. QuestionScoreとDrawingAnnotationを収集（templateモードでは空）
    // v0.3.0以降: ログインユーザーのデータのみをエクスポート
    const questionScores: ArchiveScoresData["questionScores"] = []
    const drawingAnnotations: ArchiveScoresData["drawingAnnotations"] = []

    if (!isTemplate) {
      for (const page of exam.examPages) {
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
                isFavorite: ann.isFavorite,
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
    const examData: ArchiveExamData = {
      exam: {
        id: exam.id,
        examName: exam.examName,
        examDate: exam.examDate?.toISOString() ?? null,
        description: exam.description,
        createdAt: exam.createdAt.toISOString(),
        updatedAt: exam.updatedAt.toISOString(),
      },
      examPages: exam.examPages.map((page) => ({
        id: page.id,
        examId: page.examId,
        pageNumber: page.pageNumber,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      })),
      cropRegions: exam.examPages.flatMap((page) =>
        page.cropRegions.map((region) => ({
          id: region.id,
          examPageId: region.examPageId,
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
      // v1.7.0+: CropRegionOmrConfig
      omrConfigs: exam.examPages.flatMap((page) =>
        page.cropRegions
          .filter((region) => region.omrConfig)
          .map((region) => ({
            id: region.omrConfig!.id,
            cropRegionId: region.omrConfig!.cropRegionId,
            type: region.omrConfig!.type,
            numChoices: region.omrConfig!.numChoices,
            choiceLayout: region.omrConfig!.choiceLayout,
            numDigits: region.omrConfig!.numDigits,
            correctAnswer: region.omrConfig!.correctAnswer,
            cellGeometryJson: region.omrConfig!.cellGeometryJson,
            colorThreshold: region.omrConfig!.colorThreshold,
            areaThreshold: region.omrConfig!.areaThreshold,
            createdAt: region.omrConfig!.createdAt.toISOString(),
            updatedAt: region.omrConfig!.updatedAt.toISOString(),
          }))
      ),
      // v1.7.0+: CropRegionOmrChoiceOption
      omrChoiceOptions: exam.examPages.flatMap((page) =>
        page.cropRegions.flatMap((region) =>
          (region.omrConfig?.choiceOptions ?? []).map((opt) => ({
            id: opt.id,
            omrConfigId: opt.omrConfigId,
            choiceIndex: opt.choiceIndex,
            label: opt.label,
            isCorrect: opt.isCorrect,
            createdAt: opt.createdAt.toISOString(),
            updatedAt: opt.updatedAt.toISOString(),
          }))
        )
      ),
      // v1.2.0+: pageImagesは空配列（後方互換性のため維持）
      pageImages: [],
      // v1.2.0+: 新形式
      masterImages: exam.examPages.flatMap((page) =>
        page.masterImages.map((img) => ({
          id: img.id,
          examPageId: img.examPageId,
          imagePath: img.imagePath,
          pageSize: img.pageSize,
          createdAt: img.createdAt.toISOString(),
          updatedAt: img.updatedAt.toISOString(),
        }))
      ),
      studentAnswerImages: isTemplate
        ? []
        : exam.examPages.flatMap((page) =>
            page.studentAnswerImages.map((img) => ({
              id: img.id,
              examPageId: img.examPageId,
              studentId: img.studentId,
              imagePath: img.imagePath,
              createdAt: img.createdAt.toISOString(),
              updatedAt: img.updatedAt.toISOString(),
            }))
          ),
      examStudents: isTemplate
        ? []
        : exam.examStudents.map((ps) => ({
            id: ps.id,
            examId: ps.examId,
            studentId: ps.studentId,
            status: ps.status,
            customOrder: ps.customOrder,
            createdAt: ps.createdAt.toISOString(),
            updatedAt: ps.updatedAt.toISOString(),
          })),
      // v0.3.0以降: UserExamは無視（インポート時に現在のユーザーで作成）
      userExams: [],
      examSubtotalGroups: includeSubtotals
        ? exam.examSubtotalGroups.map((psg) => ({
            id: psg.id,
            examId: psg.examId,
            subtotalGroupId: psg.subtotalGroupId,
            createdAt: psg.createdAt.toISOString(),
            updatedAt: psg.updatedAt.toISOString(),
          }))
        : [],
      examClasses: isTemplate
        ? []
        : exam.examClasses.map((pc) => ({
            id: pc.id,
            examId: pc.examId,
            classId: pc.classId,
            administered: pc.administered,
            statistics: pc.statistics,
            order: pc.order,
            createdAt: pc.createdAt.toISOString(),
            updatedAt: pc.updatedAt.toISOString(),
          })),
      // v1.4.0+
      examMarkingFormats: examMarkingFormats.map((pmf) => ({
        id: pmf.id,
        examId: pmf.examId,
        markType: pmf.markType,
        symbol: pmf.symbol,
        color: pmf.color,
        fontSize: pmf.fontSize,
        strokeWidth: pmf.strokeWidth,
        createdAt: pmf.createdAt.toISOString(),
        updatedAt: pmf.updatedAt.toISOString(),
      })),
      examExportSettings: examExportSettings
        ? {
            id: examExportSettings.id,
            examId: examExportSettings.examId,
            settingsJson: examExportSettings.settingsJson,
            createdAt: examExportSettings.createdAt.toISOString(),
            updatedAt: examExportSettings.updatedAt.toISOString(),
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

    const tagsData: ArchiveTagsData = {
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      tagSubtotalGroups: tagSubtotalGroups.map((tsg) => ({
        id: tsg.id,
        tagId: tsg.tagId,
        subtotalGroupId: tsg.subtotalGroupId,
        createdAt: tsg.createdAt.toISOString(),
        updatedAt: tsg.updatedAt.toISOString(),
      })),
      examTags: examTags.map((et) => ({
        id: et.id,
        examId: et.examId,
        tagId: et.tagId,
        createdAt: et.createdAt.toISOString(),
        updatedAt: et.updatedAt.toISOString(),
      })),
    }

    // 11. 削除記録を取得
    const deletedRecords = await prisma.deletedRecord.findMany({
      where: { examId },
    })
    const deletedRecordsData: ArchiveDeletedRecordsData = {
      deletedRecords: deletedRecords.map((dr) => ({
        id: dr.id,
        tableName: dr.tableName,
        recordId: dr.recordId,
        deletedAt: dr.deletedAt.toISOString(),
        userId: dr.userId,
        examId: dr.examId,
      })),
    }

    // 12. 件数を集計
    const counts: ArchiveDataCounts = {
      students: students.length,
      classes: classes.length,
      users: users.length,
      pages: exam.examPages.length,
      regions: examData.cropRegions.length,
      scores: questionScores.length,
      annotations: drawingAnnotations.length,
      subtotalGroups: subtotalGroups.length,
      masterImages: masterImagePaths.length,
      answerSheetImages: answerSheetPaths.length,
    }

    return {
      success: true,
      data: {
        examData,
        studentsData,
        classesData,
        usersData,
        subtotalsData,
        scoresData,
        tagsData,
        deletedRecordsData,
        counts,
        masterImagePaths,
        answerSheetPaths,
      },
    }
  } catch (error) {
    console.error("Error collecting exam data:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "データ収集に失敗しました",
    }
  }
}
