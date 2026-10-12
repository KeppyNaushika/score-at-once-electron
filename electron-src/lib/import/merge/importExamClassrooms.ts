/**
 * ID統合インポート: 試験×学級の関連（ExamClassroom）の処理
 *
 * 親の試験が新規作成/マッチした場合にのみ呼ばれる。
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 既にある行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 */

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, PrismaTransaction } from "./types"

export async function processExamClassrooms(
  data: ExtractedArchiveData,
  newExamId: string,
  idMappings: IdMappings,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<{ orderWrittenCount: number }> {
  // 詰め直しの起動条件は「作成**または更新**したとき」。上書き／統合は既存行の
  // order も書き換えるので、行が1つも増えない取り込みでも番号は重なる
  let orderWrittenCount = 0

  for (const examClassroom of data.examData.examClassrooms) {
    const newClassroomId = idMappings.classroom[examClassroom.classroomId]
    if (!newClassroomId) continue

    const values = {
      administered: examClassroom.administered,
      // 旧フラグ(statistics/teacherStat)は変換チェーンが現行フラグへ移行済み
      teacherStatistics: examClassroom.teacherStatistics ?? false,
      studentReport: examClassroom.studentReport ?? false,
      // 並び順は取り込みの最後に詰め直す（reorderAfterImport）
      order: examClassroom.order,
    }

    const existing =
      (await tx.examClassroom.findFirst({
        where: { examId: newExamId, classroomId: newClassroomId },
      })) ??
      (await tx.examClassroom.findUnique({ where: { id: examClassroom.id } }))

    if (existing) {
      const updatedAt = replacementUpdatedAt(
        policy,
        examClassroom.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.examClassroom.update({
          where: { id: existing.id },
          data: { ...values, updatedAt },
        })
        orderWrittenCount++
      }
      continue
    }

    await tx.examClassroom.create({
      data: {
        id: examClassroom.id,
        examId: newExamId,
        classroomId: newClassroomId,
        ...values,
        ...policy.createdTimestamps(examClassroom),
      },
    })
    orderWrittenCount++
  }

  return { orderWrittenCount }
}
