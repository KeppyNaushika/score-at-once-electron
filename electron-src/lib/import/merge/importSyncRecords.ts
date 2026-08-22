/**
 * ID統合インポート: アノテーションと学級所属の処理
 *
 * - DrawingAnnotation（アーカイブに在るものは作る。tombstoneによる復活防止はしない）
 * - StudentClassroomMembership（学級所属。student-archiveからも再利用される）
 *
 * アーカイブは正本であり、存在については忠実に復元する。アーカイブはスナップショットで
 * 削除を表現できず「無い」が曖昧なため、削除を推論せず追加とマージのみを行う。
 * 削除の伝搬は sqlite-nas-sync の `_tombstone`（deletedAt と updatedAt のLWW）が担う。
 * 値の競合は従来どおりLWWと競合UIで解決する（issue #918）。
 */

import type { ArchiveClassesData } from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

/**
 * 注釈は採点者を持たない。持ち主は親 QuestionScore（生徒×設問×採点者で1行）から決まる。
 *
 * 以前は取り込むユーザーを注釈へ焼き込んでいたため、既存の採点データへ相乗りする場合
 * （`existingByComposite` で他人の行に当たった場合）に親子で採点者が食い違った。
 */
export async function processDrawingAnnotations(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  for (const drawingAnnotation of data.scoresData.drawingAnnotations) {
    const newScoreId =
      idMappings.questionScore[drawingAnnotation.questionScoreId]

    if (newScoreId) {
      const existingById = await tx.drawingAnnotation.findUnique({
        where: { id: drawingAnnotation.id },
      })
      if (existingById) {
        idMappings.drawingAnnotation[drawingAnnotation.id] =
          drawingAnnotation.id
        const updatedAt = replacementUpdatedAt(
          policy,
          drawingAnnotation.updatedAt,
          existingById.updatedAt
        )
        if (updatedAt) {
          await tx.drawingAnnotation.update({
            where: { id: existingById.id },
            data: {
              questionScoreId: newScoreId,
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
              updatedAt,
            },
          })
          counts.updated.annotations++
        } else {
          counts.unchanged.annotations++
        }
      } else {
        await tx.drawingAnnotation.create({
          data: {
            id: drawingAnnotation.id,
            questionScoreId: newScoreId,
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
            ...policy.createdTimestamps(drawingAnnotation),
          },
        })
        idMappings.drawingAnnotation[drawingAnnotation.id] =
          drawingAnnotation.id
        counts.created.annotations++
      }
    }
  }
}

/**
 * 学級所属データを処理
 *
 * @param memberships - 所属データ配列
 * @param idMappings - IDマッピング（student, classroom, membership を使用）
 * @param tx - Prismaトランザクション
 */
export async function processMemberships(
  memberships: ArchiveClassesData["memberships"],
  idMappings: Pick<IdMappings, "student" | "classroom" | "membership">,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  for (const membership of memberships) {
    const newStudentId = idMappings.student[membership.studentId]
    const newClassroomId = idMappings.classroom[membership.classroomId]

    if (newStudentId && newClassroomId) {
      const existing = await tx.studentClassroomMembership.findFirst({
        where: { studentId: newStudentId, classroomId: newClassroomId },
      })

      const existingMembership =
        existing ??
        (await tx.studentClassroomMembership.findUnique({
          where: { id: membership.id },
        }))

      if (existingMembership) {
        idMappings.membership[membership.id] = existingMembership.id
        const updatedAt = replacementUpdatedAt(
          policy,
          membership.updatedAt,
          existingMembership.updatedAt
        )
        if (updatedAt) {
          await tx.studentClassroomMembership.update({
            where: { id: existingMembership.id },
            data: {
              startDate: new Date(membership.startDate),
              endDate: membership.endDate ? new Date(membership.endDate) : null,
              attendanceNumber: membership.attendanceNumber,
              notes: membership.notes,
              updatedAt,
            },
          })
        }
      } else {
        await tx.studentClassroomMembership.create({
          data: {
            id: membership.id,
            studentId: newStudentId,
            classroomId: newClassroomId,
            startDate: new Date(membership.startDate),
            endDate: membership.endDate ? new Date(membership.endDate) : null,
            attendanceNumber: membership.attendanceNumber,
            notes: membership.notes,
            ...policy.createdTimestamps(membership),
          },
        })
        idMappings.membership[membership.id] = membership.id
      }
    }
  }
}
