/**
 * データ作成モジュール
 *
 * インポートデータをデータベースに作成
 */

import { randomUUID } from "crypto"

import type { ArchiveDataCounts } from "../../../../src/types/examArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "./archiveExtractor"
import type { IdMappings } from "./idRemapper"
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
  mappings: IdMappings,
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

        for (const tsg of tagsData.tagSubtotalGroups) {
          const newTagId = remapId(tsg.tagId, mappings.tag)
          const newSubtotalGroupId = remapId(
            tsg.subtotalGroupId,
            mappings.subtotalGroup
          )
          if (newTagId && newSubtotalGroupId) {
            // tagのIDがupsertで変わっている可能性があるため、名前で実際のIDを取得
            const originalTag = tagsData.tags.find((t) => t.id === tsg.tagId)
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
                      id: remapIdRequired(tsg.id, mappings.tagSubtotalGroup),
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
        for (const et of tagsData.examTags) {
          const newTagId = remapId(et.tagId, mappings.tag)
          if (newTagId) {
            const originalTag = tagsData.tags.find((t) => t.id === et.tagId)
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
                      id: remapIdRequired(et.id, mappings.examTag),
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
      for (const pmf of data.examData.examMarkingFormats || []) {
        await tx.examMarkingFormat.create({
          data: {
            id: remapIdRequired(pmf.id, mappings.examMarkingFormat),
            examId: newExamId,
            markType: pmf.markType,
            symbol: pmf.symbol,
            color: pmf.color,
            fontSize: pmf.fontSize,
            strokeWidth: pmf.strokeWidth,
          },
        })
      }

      // 8.6. ExamExportSettingsを作成 (v1.4.0+)
      const pes = data.examData.examExportSettings
      if (pes) {
        await tx.examExportSettings.create({
          data: {
            id: remapIdRequired(pes.id, mappings.examExportSettings),
            examId: newExamId,
            settingsJson: pes.settingsJson,
          },
        })
      }

      // 9. ExamSubtotalGroupを作成
      for (const psg of data.examData.examSubtotalGroups) {
        const newSubtotalGroupId = remapId(
          psg.subtotalGroupId,
          mappings.subtotalGroup
        )
        if (newSubtotalGroupId) {
          await tx.examSubtotalGroup.create({
            data: {
              id: remapIdRequired(psg.id, mappings.examSubtotalGroup),
              examId: newExamId,
              subtotalGroupId: newSubtotalGroupId,
            },
          })
        }
      }

      // 9.5. ExamClassを作成 (v1.1.0+)
      for (const pc of data.examData.examClasses || []) {
        const newClassId = remapId(pc.classId, mappings.class)
        if (newClassId) {
          await tx.examClass.create({
            data: {
              id: remapIdRequired(pc.id, mappings.examClass),
              examId: newExamId,
              classId: newClassId,
              administered: pc.administered,
              statistics: pc.statistics,
              order: pc.order,
            },
          })
        }
      }

      // 10. ExamStudentを作成
      for (const ps of data.examData.examStudents) {
        const newStudentId = remapId(ps.studentId, mappings.student)
        if (newStudentId) {
          await tx.examStudent.create({
            data: {
              id: remapIdRequired(ps.id, mappings.examStudent),
              examId: newExamId,
              studentId: newStudentId,
              status: ps.status,
              customOrder: ps.customOrder,
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
      for (const ca of data.examData.compoundAnswers || []) {
        const newExamPageId = remapId(ca.examPageId, mappings.examPage)
        if (newExamPageId) {
          await tx.compoundAnswer.create({
            data: {
              id: remapIdRequired(ca.id, mappings.compoundAnswer),
              examPageId: newExamPageId,
              label: ca.label,
              answerFormat: ca.answerFormat,
              correctAnswer: ca.correctAnswer,
              points: ca.points,
              orderIndex: ca.orderIndex,
              alternativeAnswers: ca.alternativeAnswers,
              requireReduced: ca.requireReduced,
            },
          })
        }
      }

      // 12.11. CompoundAnswerMemberを作成 (v1.11.0+)
      for (const cam of data.examData.compoundAnswerMembers || []) {
        const newCompoundAnswerId = remapId(
          cam.compoundAnswerId,
          mappings.compoundAnswer
        )
        const newCropRegionId = remapId(cam.cropRegionId, mappings.cropRegion)
        if (newCompoundAnswerId && newCropRegionId) {
          await tx.compoundAnswerMember.create({
            data: {
              id: remapIdRequired(cam.id, mappings.compoundAnswerMember),
              compoundAnswerId: newCompoundAnswerId,
              cropRegionId: newCropRegionId,
              order: cam.order,
              roleLabel: cam.roleLabel,
              separator: cam.separator,
            },
          })
        }
      }

      // 12.12. CompoundAnswerScoreを作成 (v1.11.0+)
      for (const cas of data.examData.compoundAnswerScores || []) {
        const newCompoundAnswerId = remapId(
          cas.compoundAnswerId,
          mappings.compoundAnswer
        )
        const newStudentId = remapId(cas.studentId, mappings.student)
        if (newCompoundAnswerId && newStudentId) {
          await tx.compoundAnswerScore.create({
            data: {
              id: remapIdRequired(cas.id, mappings.compoundAnswerScore),
              compoundAnswerId: newCompoundAnswerId,
              studentId: newStudentId,
              userId: currentUserId,
              recognizedAnswer: cas.recognizedAnswer,
              status: cas.status,
              partialScore: cas.partialScore
                ? parseFloat(cas.partialScore)
                : null,
            },
          })
        }
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

      // 14.5. ScoreDecisionを作成 (v1.13.0+)
      // decidedByUserIdは現在のログインユーザーで上書き
      for (const sd of data.scoresData.scoreDecisions || []) {
        const newCropRegionId = remapId(sd.cropRegionId, mappings.cropRegion)
        const newStudentId = remapId(sd.studentId, mappings.student)

        if (newCropRegionId && newStudentId) {
          await tx.scoreDecision.create({
            data: {
              id: remapIdRequired(sd.id, mappings.scoreDecision),
              cropRegionId: newCropRegionId,
              studentId: newStudentId,
              verdict: sd.verdict,
              score: sd.score ? parseFloat(sd.score) : null,
              comment: sd.comment,
              decidedByUserId: currentUserId,
              decidedAt: new Date(sd.decidedAt),
              sourceQuestionScoreId: remapId(
                sd.sourceQuestionScoreId,
                mappings.questionScore
              ),
            },
          })
        }
      }

      // 14.6. ReturnSnapshot（返却版スナップショット）を作成 (v1.14.0+)
      // capturedByUserId は現在のログインユーザーで上書き
      for (const rs of data.scoresData.returnSnapshots || []) {
        const newExamId = remapId(rs.examId, mappings.exam)
        const newStudentId = remapId(rs.studentId, mappings.student)

        if (newExamId && newStudentId) {
          await tx.returnSnapshot.create({
            data: {
              id: remapIdRequired(rs.id, mappings.returnSnapshot),
              examId: newExamId,
              studentId: newStudentId,
              scoresJson: rs.scoresJson,
              totalScore: rs.totalScore ? parseFloat(rs.totalScore) : null,
              capturedByUserId: currentUserId,
              capturedAt: new Date(rs.capturedAt),
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
              isFavorite: da.isFavorite,
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
        classes: data.classesData.classes.length,
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
