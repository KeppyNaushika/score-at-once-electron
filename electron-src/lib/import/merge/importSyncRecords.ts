/**
 * ID統合インポート: 同期記録（tombstone伝搬・アノテーション）と学級所属の処理
 *
 * - DeletedRecord（tombstone）をupsertし、DrawingAnnotationの削除を伝搬
 * - DrawingAnnotation（tombstoneチェック付きで復活を防止）
 * - StudentClassroomMembership（学級所属。student-archiveからも再利用される）
 */

import type { ArchiveClassesData } from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

export async function processDeletedRecords(
  data: ExtractedArchiveData,
  tx: PrismaTransaction
): Promise<void> {
  const deletedRecords = data.deletedRecordsData?.deletedRecords ?? []
  if (deletedRecords.length === 0) return

  for (const deletedRecord of deletedRecords) {
    // tombstoneをローカルDBにupsert
    await tx.deletedRecord.upsert({
      where: {
        tableName_recordId: {
          tableName: deletedRecord.tableName,
          recordId: deletedRecord.recordId,
        },
      },
      update: {},
      create: {
        tableName: deletedRecord.tableName,
        recordId: deletedRecord.recordId,
        deletedAt: new Date(deletedRecord.deletedAt),
        userId: deletedRecord.userId,
        examId: deletedRecord.examId,
      },
    })

    // ローカルに該当レコードが残っていれば削除（削除の伝搬）
    if (deletedRecord.tableName === "DrawingAnnotation") {
      await tx.drawingAnnotation.deleteMany({
        where: { id: deletedRecord.recordId },
      })
    }
  }
}

export async function processDrawingAnnotations(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  // tombstoneを一括取得してSetに格納
  const localTombstones = await tx.deletedRecord.findMany({
    where: { tableName: "DrawingAnnotation" },
    select: { recordId: true },
  })
  const deletedIds = new Set(
    localTombstones.map((tombstone) => tombstone.recordId)
  )

  for (const drawingAnnotation of data.scoresData.drawingAnnotations) {
    const newScoreId =
      idMappings.questionScore[drawingAnnotation.questionScoreId]

    if (newScoreId) {
      // tombstoneチェック: 削除済みならスキップ
      if (deletedIds.has(drawingAnnotation.id)) {
        counts.skipped.annotations++
        continue
      }

      const existingById = await tx.drawingAnnotation.findUnique({
        where: { id: drawingAnnotation.id },
      })
      if (existingById) {
        idMappings.drawingAnnotation[drawingAnnotation.id] =
          drawingAnnotation.id
        counts.unchanged.annotations++
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
            userId: currentUserId,
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
  tx: PrismaTransaction
): Promise<void> {
  for (const membership of memberships) {
    const newStudentId = idMappings.student[membership.studentId]
    const newClassroomId = idMappings.classroom[membership.classroomId]

    if (newStudentId && newClassroomId) {
      const existing = await tx.studentClassroomMembership.findFirst({
        where: { studentId: newStudentId, classroomId: newClassroomId },
      })

      if (!existing) {
        const existingById = await tx.studentClassroomMembership.findUnique({
          where: { id: membership.id },
        })
        if (existingById) {
          idMappings.membership[membership.id] = membership.id
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
            },
          })
          idMappings.membership[membership.id] = membership.id
        }
      } else {
        idMappings.membership[membership.id] = existing.id
      }
    }
  }
}
