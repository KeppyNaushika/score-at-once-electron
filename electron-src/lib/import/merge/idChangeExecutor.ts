/**
 * ID変更処理
 *
 * 「書き出したPCに合わせる」を選んだ場合、既存IDを.scoreのIDに変更する。
 * FK制約があるため、関連テーブルも連鎖的に更新する。
 *
 * UNIQUE制約のあるフィールド（Student.studentNumber, Class.name）は
 * temp-value方式で回避: 既存レコードのUNIQUEフィールドを一時値に変更してから
 * 新レコードを作成し、旧レコードを削除する。
 */

import type { IdChangeTarget, IdMappings, PrismaTransaction } from "./types"

/**
 * ID変更処理を実行
 *
 * Stage 1トランザクション内から呼び出される。
 * エラーが発生した場合はthrowしてトランザクション全体をロールバックする。
 *
 * @param targets - ID変更対象のリスト
 * @param idMappings - IDマッピング
 * @param warnings - 警告メッセージ
 * @param tx - Prismaトランザクション
 */
export async function executeIdChanges(
  targets: IdChangeTarget[],
  idMappings: IdMappings,
  warnings: string[],
  tx: PrismaTransaction
): Promise<void> {
  for (const target of targets) {
    if (target.category === "student") {
      await changeStudentId(tx, target, idMappings, warnings)
    } else if (target.category === "class") {
      await changeClassId(tx, target, idMappings, warnings)
    } else if (target.category === "subtotalGroup") {
      await changeSubtotalGroupId(tx, target, idMappings, warnings)
    }
  }
}

/**
 * 生徒IDの変更
 * FK: StudentClassMembership.studentId, ExamStudent.studentId,
 *     StudentAnswerImage.studentId, QuestionScore.studentId
 *
 * temp-value方式: studentNumber（UNIQUE制約）を一時値に変更してから新レコードを作成
 */
async function changeStudentId(
  tx: PrismaTransaction,
  target: IdChangeTarget,
  idMappings: IdMappings,
  _warnings: string[]
): Promise<void> {
  const existingStudent = await tx.student.findUnique({
    where: { id: target.existingId },
  })

  if (!existingStudent) return

  // 1. UNIQUE制約のあるstudentNumberを一時値に変更
  const tempStudentNumber = `__TEMP_${target.existingId}`
  await tx.student.update({
    where: { id: target.existingId },
    data: { studentNumber: tempStudentNumber },
  })

  // 2. 新しいIDで元のstudentNumberを使ってレコード作成
  await tx.student.create({
    data: {
      id: target.newId,
      studentNumber: existingStudent.studentNumber,
      lastName: existingStudent.lastName,
      firstName: existingStudent.firstName,
      lastNameKana: existingStudent.lastNameKana,
      firstNameKana: existingStudent.firstNameKana,
      enrollmentYear: existingStudent.enrollmentYear,
      createdAt: existingStudent.createdAt,
      updatedAt: existingStudent.updatedAt,
    },
  })

  // 3. FK参照を更新
  await tx.studentClassMembership.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  await tx.examStudent.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  // StudentAnswerImage: 重複を回避しつつstudentIdを更新
  const existingAnswerImages = await tx.studentAnswerImage.findMany({
    where: { studentId: target.existingId },
  })
  for (const img of existingAnswerImages) {
    // 移行先のstudentIdで同じexamPageIdのレコードが既に存在するか確認
    const duplicate = await tx.studentAnswerImage.findFirst({
      where: {
        examPageId: img.examPageId,
        studentId: target.newId,
      },
    })
    if (duplicate) {
      // 重複する場合は古い方を削除
      await tx.studentAnswerImage.delete({ where: { id: img.id } })
    } else {
      await tx.studentAnswerImage.update({
        where: { id: img.id },
        data: { studentId: target.newId },
      })
    }
  }

  await tx.questionScore.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  // 4. 古いレコードを削除
  await tx.student.delete({
    where: { id: target.existingId },
  })

  // 5. マッピングを更新
  for (const [importId, mappedId] of Object.entries(idMappings.student)) {
    if (mappedId === target.existingId) {
      idMappings.student[importId] = target.newId
    }
  }
}

/**
 * 学級IDの変更
 * FK: StudentClassMembership.classId, ExamClass.classId
 *
 * temp-value方式: name（UNIQUE制約）を一時値に変更してから新レコードを作成
 */
async function changeClassId(
  tx: PrismaTransaction,
  target: IdChangeTarget,
  idMappings: IdMappings,
  _warnings: string[]
): Promise<void> {
  const existingClass = await tx.class.findUnique({
    where: { id: target.existingId },
  })

  if (!existingClass) return

  // 1. UNIQUE制約のあるnameを一時値に変更
  const tempName = `__TEMP_${target.existingId}`
  await tx.class.update({
    where: { id: target.existingId },
    data: { name: tempName },
  })

  // 2. 新しいIDで元のnameを使ってレコード作成
  await tx.class.create({
    data: {
      id: target.newId,
      name: existingClass.name,
      classCode: existingClass.classCode,
      grade: existingClass.grade,
      description: existingClass.description,
      createdAt: existingClass.createdAt,
      updatedAt: existingClass.updatedAt,
    },
  })

  // 3. FK参照を更新
  await tx.studentClassMembership.updateMany({
    where: { classId: target.existingId },
    data: { classId: target.newId },
  })

  await tx.examClass.updateMany({
    where: { classId: target.existingId },
    data: { classId: target.newId },
  })

  // 4. 古いレコードを削除
  await tx.class.delete({
    where: { id: target.existingId },
  })

  // 5. マッピングを更新
  for (const [importId, mappedId] of Object.entries(idMappings.class)) {
    if (mappedId === target.existingId) {
      idMappings.class[importId] = target.newId
    }
  }
}

/**
 * 小計グループIDの変更
 * FK: ExamSubtotalGroup.subtotalGroupId, Subtotal.subtotalGroupId,
 *     SubjectSubtotalGroup.subtotalGroupId
 */
async function changeSubtotalGroupId(
  tx: PrismaTransaction,
  target: IdChangeTarget,
  idMappings: IdMappings,
  _warnings: string[]
): Promise<void> {
  const existingGroup = await tx.subtotalGroup.findUnique({
    where: { id: target.existingId },
  })

  if (!existingGroup) return

  await tx.subtotalGroup.create({
    data: {
      id: target.newId,
      name: existingGroup.name,
      createdAt: existingGroup.createdAt,
      updatedAt: existingGroup.updatedAt,
    },
  })

  await tx.examSubtotalGroup.updateMany({
    where: { subtotalGroupId: target.existingId },
    data: { subtotalGroupId: target.newId },
  })

  await tx.subtotal.updateMany({
    where: { subtotalGroupId: target.existingId },
    data: { subtotalGroupId: target.newId },
  })

  await tx.subjectSubtotalGroup.updateMany({
    where: { subtotalGroupId: target.existingId },
    data: { subtotalGroupId: target.newId },
  })

  await tx.subtotalGroup.delete({
    where: { id: target.existingId },
  })

  for (const [importId, mappedId] of Object.entries(idMappings.subtotalGroup)) {
    if (mappedId === target.existingId) {
      idMappings.subtotalGroup[importId] = target.newId
    }
  }
}
