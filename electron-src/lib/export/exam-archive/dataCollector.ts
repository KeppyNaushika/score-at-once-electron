/**
 * 試験アーカイブ用データ収集
 *
 * 試験に関連する全データをエクスポート用に収集する
 */

import type {
  ArchiveClassesData,
  ArchiveDataCounts,
  ArchiveExamData,
  ArchiveExportMode,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveTagsData,
  ArchiveUsersData,
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
  exportMode: ArchiveExportMode = "full"
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
          orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
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
      // 採点層は ExamStudent の子なので、受験者を集めれば生徒も網羅される
      // （受験者に紐づかない採点行はそもそも存在しえない）
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

    const classroomIds = new Set(
      memberships.map((membership) => membership.classroomId)
    )
    const classes = isTemplate
      ? []
      : await prisma.classroom.findMany({
          where: { id: { in: Array.from(classroomIds) } },
        })

    // 5. 現在のユーザーのみを取得（パスコードは除外）
    // v0.3.0以降: ログインユーザーのデータのみをエクスポート
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      omit: { passcode: true },
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

    // 7.6. 出力設定（正規化済み5テーブル）を取得
    const [
      answerOverlayStyles,
      answerOverlayVisibilities,
      individualReportSettings,
      individualReportTableSections,
      individualReportGraphSettings,
      individualReportStatisticVisibilities,
    ] = await Promise.all([
      prisma.examAnswerOverlayStyle.findMany({ where: { examId } }),
      prisma.examAnswerOverlayVisibility.findMany({ where: { examId } }),
      prisma.examIndividualReportSettings.findUnique({ where: { examId } }),
      prisma.examIndividualReportTableSection.findMany({ where: { examId } }),
      prisma.examIndividualReportGraphSettings.findUnique({
        where: { examId },
      }),
      prisma.examIndividualReportStatisticVisibility.findMany({
        where: { examId },
      }),
    ])

    // 7.7. Tag/TagSubtotalGroup/ExamTagを取得
    //
    // **タグ本体は「小計グループ経由」と「試験への直付け」の両方から集める。**
    // かつては tagSubtotalGroups → tagIds の経路しか見ておらず、TagSubtotalGroup が
    // 1行も無いデータベースでは tags が常に空になっていた。examTags は書き出せているのに
    // 指す先の Tag がアーカイブに無いため、取り込み側がタグ付けを丸ごと落としていた。
    // templateモードでも examTags は集めるので、タグ本体も同じ条件で集める。
    const subtotalGroupIdArray = Array.from(subtotalGroupIds)
    const tagSubtotalGroups = includeSubtotals
      ? await prisma.tagSubtotalGroup.findMany({
          where: { subtotalGroupId: { in: subtotalGroupIdArray } },
        })
      : []
    const examTags = await prisma.examTag.findMany({
      where: { examId },
    })
    const tagIds = [
      ...new Set([
        ...tagSubtotalGroups.map((tagSubtotalGroup) => tagSubtotalGroup.tagId),
        ...examTags.map((examTag) => examTag.tagId),
      ]),
    ]
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
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
      if (page.imagePath) {
        // projects/ → exams/ パス正規化（v0.6.x リネーム対応）
        masterImagePaths.push(page.imagePath.replace(/^projects\//, "exams/"))
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
    const cropRegionAssignments: ArchiveScoresData["cropRegionAssignments"] = []
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
              examStudentId: questionScore.examStudentId,
              partialScore: questionScore.partialScore?.toString() ?? null,
              status: questionScore.status,
              userId: questionScore.userId,
              createdAt: questionScore.createdAt.toISOString(),
              updatedAt: questionScore.updatedAt.toISOString(),
            })

            // 親の採点データが既にログインユーザーのものへ絞られているので、
            // 注釈側で採点者を見直す必要は無い（持ち主は親から決まる）
            for (const drawingAnnotation of questionScore.drawingAnnotations) {
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
          examStudentId: decision.examStudentId,
          verdict: decision.verdict,
          score: decision.score?.toString() ?? null,
          comment: decision.comment,
          decidedByUserId: decision.decidedByUserId,
          decidedAt: decision.decidedAt.toISOString(),
          createdAt: decision.createdAt.toISOString(),
          updatedAt: decision.updatedAt.toISOString(),
        })
      }

      // 9.55. CropRegionAssignment（設問ごとの採点担当）を収集 (v1.20.0+)
      // 担当は試験ごとに1セットなので採点者フィルタはしない。
      // ユーザーはアーカイブを越えないので username を denormalize する
      // （assignedBy は監査用の付随情報なので持ち回らない）。
      const assignments = await prisma.cropRegionAssignment.findMany({
        where: { cropRegion: { examPage: { examId } } },
        include: { user: true },
      })
      for (const assignment of assignments) {
        cropRegionAssignments.push({
          cropRegionId: assignment.cropRegionId,
          username: assignment.user.username,
          createdAt: assignment.createdAt.toISOString(),
          updatedAt: assignment.updatedAt.toISOString(),
        })
      }

      // 9.6. ReturnSnapshot（返却版スナップショット）を収集 (v1.14.0+)
      // 返却版は試験ごとに1セット（受験者ごとに1行）なので採点者フィルタはしない
      const snapshots = await prisma.returnSnapshot.findMany({
        where: { examStudent: { examId } },
      })
      for (const snapshot of snapshots) {
        returnSnapshots.push({
          id: snapshot.id,
          examStudentId: snapshot.examStudentId,
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
        imagePath: page.imagePath,
        pageSize: page.pageSize,
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
                  examStudentId: score.examStudentId,
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
      // 模範解答画像は v1.23.0 で examPages へ畳んだ（masterImages セクションは無い）
      studentAnswerImages: isTemplate
        ? []
        : exam.examPages.flatMap((page) =>
            page.studentAnswerImages.map((studentAnswerImage) => ({
              id: studentAnswerImage.id,
              examPageId: studentAnswerImage.examPageId,
              examStudentId: studentAnswerImage.examStudentId,
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
        : exam.examClassrooms.map((examClassroom) => ({
            id: examClassroom.id,
            examId: examClassroom.examId,
            classroomId: examClassroom.classroomId,
            administered: examClassroom.administered,
            teacherStatistics: examClassroom.teacherStatistics,
            studentReport: examClassroom.studentReport,
            order: examClassroom.order,
            createdAt: examClassroom.createdAt.toISOString(),
            updatedAt: examClassroom.updatedAt.toISOString(),
          })),
      answerOverlayStyles: answerOverlayStyles.map((style) => ({
        ...style,
        createdAt: style.createdAt.toISOString(),
        updatedAt: style.updatedAt.toISOString(),
      })),
      answerOverlayVisibilities: answerOverlayVisibilities.map(
        (visibility) => ({
          ...visibility,
          createdAt: visibility.createdAt.toISOString(),
          updatedAt: visibility.updatedAt.toISOString(),
        })
      ),
      individualReportSettings: individualReportSettings
        ? {
            ...individualReportSettings,
            createdAt: individualReportSettings.createdAt.toISOString(),
            updatedAt: individualReportSettings.updatedAt.toISOString(),
          }
        : null,
      individualReportTableSections: individualReportTableSections.map(
        (section) => ({
          ...section,
          createdAt: section.createdAt.toISOString(),
          updatedAt: section.updatedAt.toISOString(),
        })
      ),
      individualReportStatisticVisibilities:
        individualReportStatisticVisibilities.map((visibility) => ({
          ...visibility,
          createdAt: visibility.createdAt.toISOString(),
          updatedAt: visibility.updatedAt.toISOString(),
        })),
      individualReportGraphSettings: individualReportGraphSettings
        ? {
            ...individualReportGraphSettings,
            createdAt: individualReportGraphSettings.createdAt.toISOString(),
            updatedAt: individualReportGraphSettings.updatedAt.toISOString(),
          }
        : null,
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
        classroomCode: classroom.classroomCode,
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
      cropRegionAssignments,
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

    // 11. 件数を集計
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
