/**
 * Stage 2: ID変更処理
 *
 * 「書き出したPCに合わせる」を選んだ場合、既存IDを.scoreのIDに変更する。
 * FK制約があるため、関連テーブルも連鎖的に更新する。
 */

import prisma from "../../prisma/client"
import type { IdChangeTarget, IdMappings } from "./types"

/**
 * ID変更処理を実行
 *
 * @param targets - ID変更対象のリスト
 * @param idMappings - IDマッピング
 * @param warnings - 警告メッセージ
 */
export async function executeIdChanges(
  targets: IdChangeTarget[],
  idMappings: IdMappings,
  warnings: string[]
): Promise<void> {
  for (const target of targets) {
    try {
      await prisma.$transaction(async (tx) => {
        if (target.category === "student") {
          await changeStudentId(tx, target, idMappings, warnings)
        } else if (target.category === "class") {
          await changeClassId(tx, target, idMappings, warnings)
        } else if (target.category === "subtotalGroup") {
          await changeSubtotalGroupId(tx, target, idMappings, warnings)
        }
      })
    } catch (error) {
      console.error(`Error changing ID for ${target.category}:`, error)
      warnings.push(
        `${target.category}のID変更に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    }
  }
}

/**
 * 生徒IDの変更
 * FK: StudentClassMembership.studentId, ProjectStudent.studentId,
 *     StudentAnswerImage.studentId, QuestionScore.studentId
 */
async function changeStudentId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  target: IdChangeTarget,
  idMappings: IdMappings,
  _warnings: string[]
): Promise<void> {
  const existingStudent = await tx.student.findUnique({
    where: { id: target.existingId },
  })

  if (!existingStudent) return

  // 新しいIDで同じデータを作成
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

  // FK参照を更新
  await tx.studentClassMembership.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  await tx.projectStudent.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  await tx.studentAnswerImage.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  await tx.questionScore.updateMany({
    where: { studentId: target.existingId },
    data: { studentId: target.newId },
  })

  // 古いレコードを削除
  await tx.student.delete({
    where: { id: target.existingId },
  })

  // マッピングを更新
  for (const [importId, mappedId] of Object.entries(idMappings.student)) {
    if (mappedId === target.existingId) {
      idMappings.student[importId] = target.newId
    }
  }
}

/**
 * 学級IDの変更
 * FK: StudentClassMembership.classId, ProjectClass.classId
 */
async function changeClassId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  target: IdChangeTarget,
  idMappings: IdMappings,
  _warnings: string[]
): Promise<void> {
  const existingClass = await tx.class.findUnique({
    where: { id: target.existingId },
  })

  if (!existingClass) return

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

  await tx.studentClassMembership.updateMany({
    where: { classId: target.existingId },
    data: { classId: target.newId },
  })

  await tx.projectClass.updateMany({
    where: { classId: target.existingId },
    data: { classId: target.newId },
  })

  await tx.class.delete({
    where: { id: target.existingId },
  })

  for (const [importId, mappedId] of Object.entries(idMappings.class)) {
    if (mappedId === target.existingId) {
      idMappings.class[importId] = target.newId
    }
  }
}

/**
 * 小計グループIDの変更
 * FK: ProjectSubtotalGroup.subtotalGroupId, Subtotal.subtotalGroupId
 */
async function changeSubtotalGroupId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
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

  await tx.projectSubtotalGroup.updateMany({
    where: { subtotalGroupId: target.existingId },
    data: { subtotalGroupId: target.newId },
  })

  await tx.subtotal.updateMany({
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
