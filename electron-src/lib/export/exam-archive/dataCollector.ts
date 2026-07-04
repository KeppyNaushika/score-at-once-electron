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
                    digitBoxes: true,
                  },
                },
                questionScores: {
                  include: {
                    drawingAnnotations: true,
                  },
                },
                compoundMembership: true,
              },
            },
            compoundAnswers: {
              include: {
                members: true,
                scores: true,
              },
            },
          },
          orderBy: { pageNumber: "asc" },
        },
        examStudents: true,
        userExams: true,
        examSubtotalGroups: true,
        examClassrooms: true,
      },
    })

    if (!exam) {
      return { success: false, error: "試験が見つかりません" }
    }

    // 2. 関連する生徒IDを収集（templateモードではスキップ）
    const studentIds = new Set<string>()
    if (!isTemplate) {
      for (const examStudent of exam.examStudents) {
        studentIds.add(examStudent.studentId)
      }
      for (const page of exam.examPages) {
        for (const studentAnswerImage of page.studentAnswerImages) {
          studentIds.add(studentAnswerImage.studentId)
        }
        for (const region of page.cropRegions) {
          for (const questionScore of region.questionScores) {
            studentIds.add(questionScore.studentId)
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
      : await prisma.studentClassroomMembership.findMany({
          where: { studentId: { in: Array.from(studentIds) } },
        })

    const classIds = new Set(
      memberships.map((membership) => membership.classroomId)
    )
    const classes = isTemplate
      ? []
      : await prisma.classroom.findMany({
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
        ? exam.examSubtotalGroups.map(
            (examSubtotalGroup) => examSubtotalGroup.subtotalGroupId
          )
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
      page.cropRegions.map((cropRegion) => cropRegion.id)
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
    const tagIds = [
      ...new Set(
        tagSubtotalGroups.map((tagSubtotalGroup) => tagSubtotalGroup.tagId)
      ),
    ]
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
          for (const cropSubtotal of region.cropSubtotals) {
            cropSubtotals.push(cropSubtotal)
          }
        }
      }
    }

    // 8. 画像パスを収集（templateモードでは答案画像は空）
    const masterImagePaths: string[] = []
    const answerSheetPaths: string[] = []

    for (const page of exam.examPages) {
      for (const masterImage of page.masterImages) {
        // projects/ → exams/ パス正規化（v0.6.x リネーム対応）
        const normalized = masterImage.imagePath.replace(
          /^projects\//,
          "exams/"
        )
        masterImagePaths.push(normalized)
      }
      if (!isTemplate) {
        for (const studentAnswerImage of page.studentAnswerImages) {
          const normalized = studentAnswerImage.imagePath.replace(
            /^projects\//,
            "exams/"
          )
          answerSheetPaths.push(normalized)
        }
      }
    }

    // 9. QuestionScoreとDrawingAnnotationを収集（templateモードでは空）
    // v0.3.0以降: ログインユーザーのデータのみをエクスポート
    const questionScores: ArchiveScoresData["questionScores"] = []
    const drawingAnnotations: ArchiveScoresData["drawingAnnotations"] = []
    const scoreDecisions: ArchiveScoresData["scoreDecisions"] = []
    const returnSnapshots: ArchiveScoresData["returnSnapshots"] = []

    if (!isTemplate) {
      for (const page of exam.examPages) {
        for (const region of page.cropRegions) {
          for (const questionScore of region.questionScores) {
            // ログインユーザーの採点データのみを収集
            if (questionScore.userId !== userId) {
              continue
            }

            questionScores.push({
              id: questionScore.id,
              cropRegionId: questionScore.cropRegionId,
              studentId: questionScore.studentId,
              partialScore: questionScore.partialScore?.toString() ?? null,
              status: questionScore.status,
              userId: questionScore.userId,
              createdAt: questionScore.createdAt.toISOString(),
              updatedAt: questionScore.updatedAt.toISOString(),
            })

            for (const drawingAnnotation of questionScore.drawingAnnotations) {
              // ログインユーザーのアノテーションのみを収集
              if (drawingAnnotation.userId !== userId) {
                continue
              }

              drawingAnnotations.push({
                id: drawingAnnotation.id,
                questionScoreId: drawingAnnotation.questionScoreId,
                type: drawingAnnotation.type,
                x: drawingAnnotation.x,
                y: drawingAnnotation.y,
                color: drawingAnnotation.color,
                strokeWidth: drawingAnnotation.strokeWidth,
                width: drawingAnnotation.width,
                height: drawingAnnotation.height,
                endX: drawingAnnotation.endX,
                endY: drawingAnnotation.endY,
                lineStyle: drawingAnnotation.lineStyle,
                text: drawingAnnotation.text,
                fontSize: drawingAnnotation.fontSize,
                textBoxWidth: drawingAnnotation.textBoxWidth,
                textBoxHeight: drawingAnnotation.textBoxHeight,
                horizontalAlign: drawingAnnotation.horizontalAlign,
                verticalAlign: drawingAnnotation.verticalAlign,
                anchorDirection: drawingAnnotation.anchorDirection,
                displayX: drawingAnnotation.displayX,
                displayY: drawingAnnotation.displayY,
                isFavorite: drawingAnnotation.isFavorite,
                userId: drawingAnnotation.userId,
                createdAt: drawingAnnotation.createdAt.toISOString(),
                updatedAt: drawingAnnotation.updatedAt.toISOString(),
              })
            }
          }
        }
      }

      // 9.5. ScoreDecisionを収集 (v1.13.0+)
      // 確定は試験ごとに1セットなので採点者によるフィルタはしない
      const decisions = await prisma.scoreDecision.findMany({
        where: { cropRegion: { examPage: { examId } } },
      })
      for (const decision of decisions) {
        scoreDecisions.push({
          id: decision.id,
          cropRegionId: decision.cropRegionId,
          studentId: decision.studentId,
          verdict: decision.verdict,
          score: decision.score?.toString() ?? null,
          comment: decision.comment,
          decidedByUserId: decision.decidedByUserId,
          decidedAt: decision.decidedAt.toISOString(),
          sourceQuestionScoreId: decision.sourceQuestionScoreId,
          createdAt: decision.createdAt.toISOString(),
          updatedAt: decision.updatedAt.toISOString(),
        })
      }

      // 9.6. ReturnSnapshot（返却版スナップショット）を収集 (v1.14.0+)
      // 返却版は試験ごとに1セット（生徒×試験で1行）なので採点者フィルタはしない
      const snapshots = await prisma.returnSnapshot.findMany({
        where: { examId },
      })
      for (const snapshot of snapshots) {
        returnSnapshots.push({
          id: snapshot.id,
          examId: snapshot.examId,
          studentId: snapshot.studentId,
          scoresJson: snapshot.scoresJson,
          totalScore: snapshot.totalScore?.toString() ?? null,
          capturedByUserId: snapshot.capturedByUserId,
          capturedAt: snapshot.capturedAt.toISOString(),
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString(),
        })
      }
    }

    // 10. データを整形
    const examData: ArchiveExamData = {
      exam: {
        id: exam.id,
        examName: exam.examName,
        examDate: exam.examDate?.toISOString() ?? null,
        description: exam.description,
        markerCorrectionEnabled: exam.markerCorrectionEnabled,
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
            colorThreshold: region.omrConfig!.colorThreshold,
            areaThreshold: region.omrConfig!.areaThreshold,
            createdAt: region.omrConfig!.createdAt.toISOString(),
            updatedAt: region.omrConfig!.updatedAt.toISOString(),
          }))
      ),
      // v1.7.0+: CropRegionOmrChoiceOption
      omrChoiceOptions: exam.examPages.flatMap((page) =>
        page.cropRegions.flatMap((region) =>
          (region.omrConfig?.choiceOptions ?? []).map((choiceOption) => ({
            id: choiceOption.id,
            omrConfigId: choiceOption.omrConfigId,
            choiceIndex: choiceOption.choiceIndex,
            label: choiceOption.label,
            isCorrect: choiceOption.isCorrect,
            shape: choiceOption.shape,
            normalizedCx: choiceOption.normalizedCx,
            normalizedCy: choiceOption.normalizedCy,
            normalizedWidth: choiceOption.normalizedWidth,
            normalizedHeight: choiceOption.normalizedHeight,
            createdAt: choiceOption.createdAt.toISOString(),
            updatedAt: choiceOption.updatedAt.toISOString(),
          }))
        )
      ),
      // v1.11.0+: CropRegionOmrDigitBox
      omrDigitBoxes: exam.examPages.flatMap((page) =>
        page.cropRegions.flatMap((region) =>
          (region.omrConfig?.digitBoxes ?? []).map((box) => ({
            id: box.id,
            omrConfigId: box.omrConfigId,
            digitIndex: box.digitIndex,
            normalizedX: box.normalizedX,
            normalizedY: box.normalizedY,
            normalizedW: box.normalizedW,
            normalizedH: box.normalizedH,
            createdAt: box.createdAt.toISOString(),
            updatedAt: box.updatedAt.toISOString(),
          }))
        )
      ),
      // v1.11.0+: CompoundAnswer
      compoundAnswers: exam.examPages.flatMap((page) =>
        page.compoundAnswers.map((compoundAnswer) => ({
          id: compoundAnswer.id,
          examPageId: compoundAnswer.examPageId,
          label: compoundAnswer.label,
          answerFormat: compoundAnswer.answerFormat,
          correctAnswer: compoundAnswer.correctAnswer,
          points: compoundAnswer.points,
          orderIndex: compoundAnswer.orderIndex,
          alternativeAnswers: compoundAnswer.alternativeAnswers,
          requireReduced: compoundAnswer.requireReduced,
          createdAt: compoundAnswer.createdAt.toISOString(),
          updatedAt: compoundAnswer.updatedAt.toISOString(),
        }))
      ),
      // v1.11.0+: CompoundAnswerMember
      compoundAnswerMembers: exam.examPages.flatMap((page) =>
        page.compoundAnswers.flatMap((compoundAnswer) =>
          compoundAnswer.members.map((member) => ({
            id: member.id,
            compoundAnswerId: member.compoundAnswerId,
            cropRegionId: member.cropRegionId,
            order: member.order,
            roleLabel: member.roleLabel,
            separator: member.separator,
            createdAt: member.createdAt.toISOString(),
            updatedAt: member.updatedAt.toISOString(),
          }))
        )
      ),
      // v1.11.0+: CompoundAnswerScore (ログインユーザーのみ)
      compoundAnswerScores: isTemplate
        ? []
        : exam.examPages.flatMap((page) =>
            page.compoundAnswers.flatMap((compoundAnswer) =>
              compoundAnswer.scores
                .filter((score) => score.userId === userId)
                .map((score) => ({
                  id: score.id,
                  compoundAnswerId: score.compoundAnswerId,
                  studentId: score.studentId,
                  userId: score.userId,
                  recognizedAnswer: score.recognizedAnswer,
                  status: score.status,
                  partialScore: score.partialScore?.toString() ?? null,
                  createdAt: score.createdAt.toISOString(),
                  updatedAt: score.updatedAt.toISOString(),
                }))
            )
          ),
      // v1.2.0+: pageImagesは空配列（後方互換性のため維持）
      pageImages: [],
      // v1.2.0+: 新形式
      masterImages: exam.examPages.flatMap((page) =>
        page.masterImages.map((masterImage) => ({
          id: masterImage.id,
          examPageId: masterImage.examPageId,
          imagePath: masterImage.imagePath,
          pageSize: masterImage.pageSize,
          createdAt: masterImage.createdAt.toISOString(),
          updatedAt: masterImage.updatedAt.toISOString(),
        }))
      ),
      studentAnswerImages: isTemplate
        ? []
        : exam.examPages.flatMap((page) =>
            page.studentAnswerImages.map((studentAnswerImage) => ({
              id: studentAnswerImage.id,
              examPageId: studentAnswerImage.examPageId,
              studentId: studentAnswerImage.studentId,
              imagePath: studentAnswerImage.imagePath,
              createdAt: studentAnswerImage.createdAt.toISOString(),
              updatedAt: studentAnswerImage.updatedAt.toISOString(),
            }))
          ),
      examStudents: isTemplate
        ? []
        : exam.examStudents.map((examStudent) => ({
            id: examStudent.id,
            examId: examStudent.examId,
            studentId: examStudent.studentId,
            status: examStudent.status,
            customOrder: examStudent.customOrder,
            createdAt: examStudent.createdAt.toISOString(),
            updatedAt: examStudent.updatedAt.toISOString(),
          })),
      // v0.3.0以降: UserExamは無視（インポート時に現在のユーザーで作成）
      userExams: [],
      examSubtotalGroups: includeSubtotals
        ? exam.examSubtotalGroups.map((examSubtotalGroup) => ({
            id: examSubtotalGroup.id,
            examId: examSubtotalGroup.examId,
            subtotalGroupId: examSubtotalGroup.subtotalGroupId,
            selectedForTable: examSubtotalGroup.selectedForTable,
            selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot,
            createdAt: examSubtotalGroup.createdAt.toISOString(),
            updatedAt: examSubtotalGroup.updatedAt.toISOString(),
          }))
        : [],
      examClassrooms: isTemplate
        ? []
        : exam.examClassrooms.map((examClass) => ({
            id: examClass.id,
            examId: examClass.examId,
            classroomId: examClass.classroomId,
            administered: examClass.administered,
            teacherStatistics: examClass.teacherStatistics,
            studentReport: examClass.studentReport,
            order: examClass.order,
            createdAt: examClass.createdAt.toISOString(),
            updatedAt: examClass.updatedAt.toISOString(),
          })),
      // v1.4.0+
      examMarkingFormats: examMarkingFormats.map((examMarkingFormat) => ({
        id: examMarkingFormat.id,
        examId: examMarkingFormat.examId,
        markType: examMarkingFormat.markType,
        symbol: examMarkingFormat.symbol,
        color: examMarkingFormat.color,
        fontSize: examMarkingFormat.fontSize,
        strokeWidth: examMarkingFormat.strokeWidth,
        createdAt: examMarkingFormat.createdAt.toISOString(),
        updatedAt: examMarkingFormat.updatedAt.toISOString(),
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
      cropRegionMarkingOverrides: cropRegionMarkingOverrides.map(
        (cropRegionMarkingOverride) => ({
          id: cropRegionMarkingOverride.id,
          cropRegionId: cropRegionMarkingOverride.cropRegionId,
          markType: cropRegionMarkingOverride.markType,
          symbol: cropRegionMarkingOverride.symbol,
          color: cropRegionMarkingOverride.color,
          visible: cropRegionMarkingOverride.visible,
          createdAt: cropRegionMarkingOverride.createdAt.toISOString(),
          updatedAt: cropRegionMarkingOverride.updatedAt.toISOString(),
        })
      ),
    }

    const studentsData: ArchiveStudentsData = {
      students: students.map((student) => ({
        id: student.id,
        studentNumber: student.studentNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        lastNameKana: student.lastNameKana,
        firstNameKana: student.firstNameKana,
        enrollmentYear: student.enrollmentYear,
        createdAt: student.createdAt.toISOString(),
        updatedAt: student.updatedAt.toISOString(),
      })),
    }

    const classesData: ArchiveClassesData = {
      classrooms: classes.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
        classCode: classroom.classCode,
        grade: classroom.grade,
        description: classroom.description,
        isVisible: classroom.isVisible,
        createdAt: classroom.createdAt.toISOString(),
        updatedAt: classroom.updatedAt.toISOString(),
      })),
      memberships: memberships.map((membership) => ({
        id: membership.id,
        studentId: membership.studentId,
        classroomId: membership.classroomId,
        startDate: membership.startDate.toISOString(),
        endDate: membership.endDate?.toISOString() ?? null,
        attendanceNumber: membership.attendanceNumber,
        notes: membership.notes,
        createdAt: membership.createdAt.toISOString(),
        updatedAt: membership.updatedAt.toISOString(),
      })),
    }

    const usersData: ArchiveUsersData = {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
    }

    const subtotalsData: ArchiveSubtotalsData = {
      subtotalGroups: subtotalGroups.map((subtotalGroup) => ({
        id: subtotalGroup.id,
        name: subtotalGroup.name,
        createdAt: subtotalGroup.createdAt.toISOString(),
        updatedAt: subtotalGroup.updatedAt.toISOString(),
      })),
      subtotals: subtotalGroups.flatMap((subtotalGroup) =>
        subtotalGroup.subtotals.map((subtotal) => ({
          id: subtotal.id,
          name: subtotal.name,
          subtotalGroupId: subtotal.subtotalGroupId,
          order: subtotal.order,
          createdAt: subtotal.createdAt.toISOString(),
          updatedAt: subtotal.updatedAt.toISOString(),
        }))
      ),
      cropSubtotals: cropSubtotals.map((cropSubtotal) => ({
        id: cropSubtotal.id,
        cropRegionId: cropSubtotal.cropRegionId,
        subtotalId: cropSubtotal.subtotalId,
        assignmentType: cropSubtotal.assignmentType,
        createdAt: cropSubtotal.createdAt.toISOString(),
        updatedAt: cropSubtotal.updatedAt.toISOString(),
      })),
    }

    const scoresData: ArchiveScoresData = {
      questionScores,
      drawingAnnotations,
      scoreDecisions,
      returnSnapshots,
    }

    const tagsData: ArchiveTagsData = {
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        order: tag.order,
        color: tag.color,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      })),
      tagSubtotalGroups: tagSubtotalGroups.map((tagSubtotalGroup) => ({
        id: tagSubtotalGroup.id,
        tagId: tagSubtotalGroup.tagId,
        subtotalGroupId: tagSubtotalGroup.subtotalGroupId,
        createdAt: tagSubtotalGroup.createdAt.toISOString(),
        updatedAt: tagSubtotalGroup.updatedAt.toISOString(),
      })),
      examTags: examTags.map((examTag) => ({
        id: examTag.id,
        examId: examTag.examId,
        tagId: examTag.tagId,
        createdAt: examTag.createdAt.toISOString(),
        updatedAt: examTag.updatedAt.toISOString(),
      })),
    }

    // 11. 削除記録を取得
    const deletedRecords = await prisma.deletedRecord.findMany({
      where: { examId },
    })
    const deletedRecordsData: ArchiveDeletedRecordsData = {
      deletedRecords: deletedRecords.map((deletedRecord) => ({
        id: deletedRecord.id,
        tableName: deletedRecord.tableName,
        recordId: deletedRecord.recordId,
        deletedAt: deletedRecord.deletedAt.toISOString(),
        userId: deletedRecord.userId,
        examId: deletedRecord.examId,
      })),
    }

    // 12. 件数を集計
    const counts: ArchiveDataCounts = {
      students: students.length,
      classrooms: classes.length,
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
