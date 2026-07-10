/**
 * データ作成モジュール
 *
 * インポートデータをデータベースに作成
 */

import { randomUUID } from "crypto"

import type { ArchiveDataCounts } from "../../../../src/types/examArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "./archiveExtractor"
import type { ExamArchiveIdMappings } from "./idRemapper"
import { remapId, remapIdRequired } from "./idRemapper"
import { copyImages, createImageRecords } from "./imageHandler"
import {
  generateUniqueClassName,
  generateUniqueStudentNumber,
} from "./uniqueNameGenerators"

/**
 * データ作成結果
 */
export interface DataCreationResult {
  success: boolean
  examId?: string
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
  mappings: ExamArchiveIdMappings,
  currentUserId: string
): Promise<DataCreationResult> {
  const warnings: string[] = []
  const newExamId = remapIdRequired(data.examData.exam.id, mappings.exam)

  try {
    // トランザクションで全データを作成
    await prisma.$transaction(async (tx) => {
      // 1. 生徒を作成（重複する出席番号はサフィックスを付与）
      for (const student of data.studentsData.students) {
        const uniqueStudentNumber = await generateUniqueStudentNumber(
          tx,
          student.studentNumber
        )

        if (uniqueStudentNumber !== student.studentNumber) {
          warnings.push(
            `生徒「${student.lastName} ${student.firstName}」の出席番号を「${student.studentNumber}」から「${uniqueStudentNumber}」に変更しました`
          )
        }

        await tx.student.create({
          data: {
            id: remapIdRequired(student.id, mappings.student),
            studentNumber: uniqueStudentNumber,
            lastName: student.lastName,
            firstName: student.firstName,
            lastNameKana: student.lastNameKana,
            firstNameKana: student.firstNameKana,
            enrollmentYear: student.enrollmentYear,
          },
        })
      }

      // 2. 学級を作成（重複する名前はサフィックスを付与）
      for (const classroom of data.classesData.classrooms) {
        const uniqueName = await generateUniqueClassName(tx, classroom.name)

        if (uniqueName !== classroom.name) {
          warnings.push(
            `学級名を「${classroom.name}」から「${uniqueName}」に変更しました`
          )
        }

        await tx.classroom.create({
          data: {
            id: remapIdRequired(classroom.id, mappings.classroom),
            name: uniqueName,
            classroomCode: classroom.classroomCode,
            grade: classroom.grade,
            description: classroom.description,
            isVisible: classroom.isVisible,
          },
        })
      }

      // 3. 学級所属を作成
      for (const membership of data.classesData.memberships) {
        const newStudentId = remapId(membership.studentId, mappings.student)
        const newClassroomId = remapId(
          membership.classroomId,
          mappings.classroom
        )

        if (newStudentId && newClassroomId) {
          await tx.studentClassroomMembership.create({
            data: {
              id: remapIdRequired(membership.id, mappings.membership),
              studentId: newStudentId,
              classroomId: newClassroomId,
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
      for (const subtotalGroup of data.subtotalsData.subtotalGroups) {
        await tx.subtotalGroup.create({
          data: {
            id: remapIdRequired(subtotalGroup.id, mappings.subtotalGroup),
            name: subtotalGroup.name,
          },
        })
      }

      // 6. 小計を作成
      for (const subtotal of data.subtotalsData.subtotals) {
        await tx.subtotal.create({
          data: {
            id: remapIdRequired(subtotal.id, mappings.subtotal),
            name: subtotal.name,
            subtotalGroupId: remapIdRequired(
              subtotal.subtotalGroupId,
              mappings.subtotalGroup
            ),
            order: subtotal.order,
          },
        })
      }

      // 6.5. Tag/TagSubtotalGroup/ExamTagを作成 (v1.10.0+, 旧Subject)
      const tagsData = data.tagsData
      if (tagsData) {
        for (const tag of tagsData.tags) {
          await tx.tag.upsert({
            where: { name: tag.name },
            update: {},
            create: {
              id: remapIdRequired(tag.id, mappings.tag),
              name: tag.name,
              order: tag.order ?? 0,
              color: tag.color ?? null,
            },
          })
        }

        for (const tagSubtotalGroup of tagsData.tagSubtotalGroups) {
          const newTagId = remapId(tagSubtotalGroup.tagId, mappings.tag)
          const newSubtotalGroupId = remapId(
            tagSubtotalGroup.subtotalGroupId,
            mappings.subtotalGroup
          )
          if (newTagId && newSubtotalGroupId) {
            // tagのIDがupsertで変わっている可能性があるため、名前で実際のIDを取得
            const originalTag = tagsData.tags.find(
              (tag) => tag.id === tagSubtotalGroup.tagId
            )
            if (originalTag) {
              const actualTag = await tx.tag.findUnique({
                where: { name: originalTag.name },
              })
              if (actualTag) {
                // 重複チェック
                const existing = await tx.tagSubtotalGroup.findUnique({
                  where: {
                    tagId_subtotalGroupId: {
                      tagId: actualTag.id,
                      subtotalGroupId: newSubtotalGroupId,
                    },
                  },
                })
                if (!existing) {
                  await tx.tagSubtotalGroup.create({
                    data: {
                      id: remapIdRequired(
                        tagSubtotalGroup.id,
                        mappings.tagSubtotalGroup
                      ),
                      tagId: actualTag.id,
                      subtotalGroupId: newSubtotalGroupId,
                    },
                  })
                }
              }
            }
          }
        }

        // ExamTag作成
        for (const examTag of tagsData.examTags) {
          const newTagId = remapId(examTag.tagId, mappings.tag)
          if (newTagId) {
            const originalTag = tagsData.tags.find(
              (tag) => tag.id === examTag.tagId
            )
            if (originalTag) {
              const actualTag = await tx.tag.findUnique({
                where: { name: originalTag.name },
              })
              if (actualTag) {
                const existing = await tx.examTag.findFirst({
                  where: { examId: newExamId, tagId: actualTag.id },
                })
                if (!existing) {
                  await tx.examTag.create({
                    data: {
                      id: remapIdRequired(examTag.id, mappings.examTag),
                      examId: newExamId,
                      tagId: actualTag.id,
                    },
                  })
                }
              }
            }
          }
        }
      }

      // 7. 試験を作成
      const exam = data.examData.exam
      await tx.exam.create({
        data: {
          id: newExamId,
          examName: exam.examName,
          examDate: exam.examDate ? new Date(exam.examDate) : null,
          description: exam.description,
          markerCorrectionEnabled: exam.markerCorrectionEnabled ?? false,
        },
      })

      // 8. UserExamを作成（現在のログインユーザーのみ）
      // v0.3.0以降: アーカイブ内のUserExamは無視し、現在のユーザーをOWNERとして作成
      // UserExamのIDはuserExam mappingから取得、空の場合は新規UUID
      const userExamId =
        data.examData.userExams.length > 0
          ? remapIdRequired(data.examData.userExams[0].id, mappings.userExam)
          : randomUUID()
      await tx.userExam.create({
        data: {
          id: userExamId,
          userId: currentUserId,
          examId: newExamId,
          role: "OWNER",
          invitedAt: new Date(),
          invitedBy: null,
        },
      })

      // 8.5. ExamMarkingFormatを作成 (v1.4.0+)
      for (const examMarkingFormat of data.examData.examMarkingFormats || []) {
        await tx.examMarkingFormat.create({
          data: {
            id: remapIdRequired(
              examMarkingFormat.id,
              mappings.examMarkingFormat
            ),
            examId: newExamId,
            markType: examMarkingFormat.markType,
            symbol: examMarkingFormat.symbol,
            color: examMarkingFormat.color,
            fontSize: examMarkingFormat.fontSize,
            strokeWidth: examMarkingFormat.strokeWidth,
          },
        })
      }

      // 8.6. ExamExportSettingsを作成 (v1.4.0+)
      const examExportSettings = data.examData.examExportSettings
      if (examExportSettings) {
        await tx.examExportSettings.create({
          data: {
            id: remapIdRequired(
              examExportSettings.id,
              mappings.examExportSettings
            ),
            examId: newExamId,
            settingsJson: examExportSettings.settingsJson,
          },
        })
      }

      // 9. ExamSubtotalGroupを作成
      for (const examSubtotalGroup of data.examData.examSubtotalGroups) {
        const newSubtotalGroupId = remapId(
          examSubtotalGroup.subtotalGroupId,
          mappings.subtotalGroup
        )
        if (newSubtotalGroupId) {
          await tx.examSubtotalGroup.create({
            data: {
              id: remapIdRequired(
                examSubtotalGroup.id,
                mappings.examSubtotalGroup
              ),
              examId: newExamId,
              subtotalGroupId: newSubtotalGroupId,
              // v1.15.0+。旧アーカイブには無いので false 既定
              selectedForTable: examSubtotalGroup.selectedForTable ?? false,
              selectedForBoxPlot: examSubtotalGroup.selectedForBoxPlot ?? false,
            },
          })
        }
      }

      // 9.5. ExamClassroomを作成 (v1.1.0+)
      // 旧フラグ(statistics/teacherStat)は変換チェーンが現行フラグへ移行済み
      for (const examClassroom of data.examData.examClassrooms || []) {
        const newClassroomId = remapId(
          examClassroom.classroomId,
          mappings.classroom
        )
        if (newClassroomId) {
          await tx.examClassroom.create({
            data: {
              id: remapIdRequired(examClassroom.id, mappings.examClassroom),
              examId: newExamId,
              classroomId: newClassroomId,
              administered: examClassroom.administered,
              teacherStatistics: examClassroom.teacherStatistics ?? false,
              studentReport: examClassroom.studentReport ?? false,
              order: examClassroom.order,
            },
          })
        }
      }

      // 10. ExamStudentを作成
      for (const examStudent of data.examData.examStudents) {
        const newStudentId = remapId(examStudent.studentId, mappings.student)
        if (newStudentId) {
          await tx.examStudent.create({
            data: {
              id: remapIdRequired(examStudent.id, mappings.examStudent),
              examId: newExamId,
              studentId: newStudentId,
              status: examStudent.status,
              customOrder: examStudent.customOrder,
            },
          })
        }
      }

      // 11. ExamPageを作成
      for (const page of data.examData.examPages) {
        await tx.examPage.create({
          data: {
            id: remapIdRequired(page.id, mappings.examPage),
            examId: newExamId,
            pageNumber: page.pageNumber,
          },
        })
      }

      // 12. CropRegionを作成
      for (const region of data.examData.cropRegions) {
        await tx.cropRegion.create({
          data: {
            id: remapIdRequired(region.id, mappings.cropRegion),
            examPageId: remapIdRequired(region.examPageId, mappings.examPage),
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

      // 12.5. CropRegionMarkingOverrideを作成 (v1.4.0+)
      for (const crmo of data.examData.cropRegionMarkingOverrides || []) {
        const newCropRegionId = remapId(crmo.cropRegionId, mappings.cropRegion)
        if (newCropRegionId) {
          await tx.cropRegionMarkingOverride.create({
            data: {
              id: remapIdRequired(crmo.id, mappings.cropRegionMarkingOverride),
              cropRegionId: newCropRegionId,
              markType: crmo.markType,
              symbol: crmo.symbol,
              color: crmo.color,
              visible: crmo.visible,
            },
          })
        }
      }

      // 12.7. CropRegionOmrConfigを作成 (v1.7.0+)
      for (const cfg of data.examData.omrConfigs || []) {
        const newCropRegionId = remapId(cfg.cropRegionId, mappings.cropRegion)
        if (newCropRegionId) {
          await tx.cropRegionOmrConfig.create({
            data: {
              id: remapIdRequired(cfg.id, mappings.cropRegionOmrConfig),
              cropRegionId: newCropRegionId,
              type: cfg.type,
              numChoices: cfg.numChoices,
              choiceLayout: cfg.choiceLayout,
              numDigits: cfg.numDigits,
              correctAnswer: cfg.correctAnswer,
              colorThreshold: cfg.colorThreshold,
              areaThreshold: cfg.areaThreshold,
            },
          })
        }
      }

      // 12.8. CropRegionOmrChoiceOptionを作成 (v1.7.0+)
      for (const opt of data.examData.omrChoiceOptions || []) {
        const newOmrConfigId = remapId(
          opt.omrConfigId,
          mappings.cropRegionOmrConfig
        )
        if (newOmrConfigId) {
          await tx.cropRegionOmrChoiceOption.create({
            data: {
              id: remapIdRequired(opt.id, mappings.cropRegionOmrChoiceOption),
              omrConfigId: newOmrConfigId,
              choiceIndex: opt.choiceIndex,
              label: opt.label,
              isCorrect: opt.isCorrect,
              shape: opt.shape ?? null,
              normalizedCx: opt.normalizedCx ?? null,
              normalizedCy: opt.normalizedCy ?? null,
              normalizedWidth: opt.normalizedWidth ?? null,
              normalizedHeight: opt.normalizedHeight ?? null,
            },
          })
        }
      }

      // 12.9. CropRegionOmrDigitBoxを作成 (v1.11.0+)
      for (const box of data.examData.omrDigitBoxes || []) {
        const newOmrConfigId = remapId(
          box.omrConfigId,
          mappings.cropRegionOmrConfig
        )
        if (newOmrConfigId) {
          await tx.cropRegionOmrDigitBox.create({
            data: {
              id: remapIdRequired(box.id, mappings.cropRegionOmrDigitBox),
              omrConfigId: newOmrConfigId,
              digitIndex: box.digitIndex,
              normalizedX: box.normalizedX,
              normalizedY: box.normalizedY,
              normalizedW: box.normalizedW,
              normalizedH: box.normalizedH,
            },
          })
        }
      }

      // 12.10. CompoundAnswerを作成 (v1.11.0+)
      for (const compoundAnswer of data.examData.compoundAnswers || []) {
        const newExamPageId = remapId(
          compoundAnswer.examPageId,
          mappings.examPage
        )
        if (newExamPageId) {
          await tx.compoundAnswer.create({
            data: {
              id: remapIdRequired(compoundAnswer.id, mappings.compoundAnswer),
              examPageId: newExamPageId,
              label: compoundAnswer.label,
              answerFormat: compoundAnswer.answerFormat,
              correctAnswer: compoundAnswer.correctAnswer,
              points: compoundAnswer.points,
              orderIndex: compoundAnswer.orderIndex,
              alternativeAnswers: compoundAnswer.alternativeAnswers,
              requireReduced: compoundAnswer.requireReduced,
            },
          })
        }
      }

      // 12.11. CompoundAnswerMemberを作成 (v1.11.0+)
      for (const compoundAnswerMember of data.examData.compoundAnswerMembers ||
        []) {
        const newCompoundAnswerId = remapId(
          compoundAnswerMember.compoundAnswerId,
          mappings.compoundAnswer
        )
        const newCropRegionId = remapId(
          compoundAnswerMember.cropRegionId,
          mappings.cropRegion
        )
        if (newCompoundAnswerId && newCropRegionId) {
          await tx.compoundAnswerMember.create({
            data: {
              id: remapIdRequired(
                compoundAnswerMember.id,
                mappings.compoundAnswerMember
              ),
              compoundAnswerId: newCompoundAnswerId,
              cropRegionId: newCropRegionId,
              order: compoundAnswerMember.order,
              roleLabel: compoundAnswerMember.roleLabel,
              separator: compoundAnswerMember.separator,
            },
          })
        }
      }

      // 12.12. CompoundAnswerScoreを作成 (v1.11.0+)
      for (const compoundAnswerScore of data.examData.compoundAnswerScores ||
        []) {
        const newCompoundAnswerId = remapId(
          compoundAnswerScore.compoundAnswerId,
          mappings.compoundAnswer
        )
        const newStudentId = remapId(
          compoundAnswerScore.studentId,
          mappings.student
        )
        if (newCompoundAnswerId && newStudentId) {
          await tx.compoundAnswerScore.create({
            data: {
              id: remapIdRequired(
                compoundAnswerScore.id,
                mappings.compoundAnswerScore
              ),
              compoundAnswerId: newCompoundAnswerId,
              studentId: newStudentId,
              userId: currentUserId,
              recognizedAnswer: compoundAnswerScore.recognizedAnswer,
              status: compoundAnswerScore.status,
              partialScore: compoundAnswerScore.partialScore
                ? parseFloat(compoundAnswerScore.partialScore)
                : null,
            },
          })
        }
      }

      // 13. CropSubtotalを作成
      for (const cropSubtotal of data.subtotalsData.cropSubtotals) {
        const newCropRegionId = remapId(
          cropSubtotal.cropRegionId,
          mappings.cropRegion
        )
        const newSubtotalId = remapId(
          cropSubtotal.subtotalId,
          mappings.subtotal
        )
        if (newCropRegionId && newSubtotalId) {
          await tx.cropSubtotal.create({
            data: {
              id: remapIdRequired(cropSubtotal.id, mappings.cropSubtotal),
              cropRegionId: newCropRegionId,
              subtotalId: newSubtotalId,
              assignmentType: cropSubtotal.assignmentType,
            },
          })
        }
      }

      // 14. QuestionScoreを作成
      // v0.3.0以降: userIdを現在のログインユーザーで上書き
      // v0.4.0以降: studentIdは必須フィールド
      for (const questionScore of data.scoresData.questionScores) {
        const newCropRegionId = remapId(
          questionScore.cropRegionId,
          mappings.cropRegion
        )
        const newStudentId = remapId(questionScore.studentId, mappings.student)

        // studentIdは必須フィールド
        if (newCropRegionId && newStudentId) {
          await tx.questionScore.create({
            data: {
              id: remapIdRequired(questionScore.id, mappings.questionScore),
              cropRegionId: newCropRegionId,
              studentId: newStudentId,
              partialScore: questionScore.partialScore
                ? parseFloat(questionScore.partialScore)
                : null,
              status: questionScore.status,
              userId: currentUserId,
            },
          })
        }
      }

      // 14.5. ScoreDecisionを作成 (v1.13.0+)
      // decidedByUserIdは現在のログインユーザーで上書き
      for (const scoreDecision of data.scoresData.scoreDecisions || []) {
        const newCropRegionId = remapId(
          scoreDecision.cropRegionId,
          mappings.cropRegion
        )
        const newStudentId = remapId(scoreDecision.studentId, mappings.student)

        if (newCropRegionId && newStudentId) {
          await tx.scoreDecision.create({
            data: {
              id: remapIdRequired(scoreDecision.id, mappings.scoreDecision),
              cropRegionId: newCropRegionId,
              studentId: newStudentId,
              verdict: scoreDecision.verdict,
              score: scoreDecision.score
                ? parseFloat(scoreDecision.score)
                : null,
              comment: scoreDecision.comment,
              decidedByUserId: currentUserId,
              decidedAt: new Date(scoreDecision.decidedAt),
              sourceQuestionScoreId: remapId(
                scoreDecision.sourceQuestionScoreId,
                mappings.questionScore
              ),
            },
          })
        }
      }

      // 14.6. ReturnSnapshot（返却版スナップショット）を作成 (v1.14.0+)
      // capturedByUserId は現在のログインユーザーで上書き
      for (const returnSnapshot of data.scoresData.returnSnapshots || []) {
        const newExamId = remapId(returnSnapshot.examId, mappings.exam)
        const newStudentId = remapId(returnSnapshot.studentId, mappings.student)

        if (newExamId && newStudentId) {
          await tx.returnSnapshot.create({
            data: {
              id: remapIdRequired(returnSnapshot.id, mappings.returnSnapshot),
              examId: newExamId,
              studentId: newStudentId,
              scoresJson: returnSnapshot.scoresJson,
              totalScore: returnSnapshot.totalScore
                ? parseFloat(returnSnapshot.totalScore)
                : null,
              capturedByUserId: currentUserId,
              capturedAt: new Date(returnSnapshot.capturedAt),
            },
          })
        }
      }

      // 15. DrawingAnnotationを作成
      // v0.3.0以降: userIdを現在のログインユーザーで上書き
      for (const drawingAnnotation of data.scoresData.drawingAnnotations) {
        const newQuestionScoreId = remapId(
          drawingAnnotation.questionScoreId,
          mappings.questionScore
        )

        if (newQuestionScoreId) {
          await tx.drawingAnnotation.create({
            data: {
              id: remapIdRequired(
                drawingAnnotation.id,
                mappings.drawingAnnotation
              ),
              questionScoreId: newQuestionScoreId,
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
              userId: currentUserId,
            },
          })
        }
      }
    })

    // 16. 画像ファイルをコピー
    await copyImages(data, newExamId)

    // 17. 画像レコードを作成（画像コピー後）
    await createImageRecords(data, mappings, newExamId)

    return {
      success: true,
      examId: newExamId,
      counts: {
        students: data.studentsData.students.length,
        classrooms: data.classesData.classrooms.length,
        users: data.usersData.users.length,
        pages: data.examData.examPages.length,
        regions: data.examData.cropRegions.length,
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
