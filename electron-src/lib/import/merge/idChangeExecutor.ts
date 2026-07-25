/**
 * ID変更処理
 *
 * 「書き出したPCに合わせる」を選んだ場合、既存IDを.scoreのIDに変更する。
 * 旧レコードを削除して新IDで作り直す方式のため、対象（Student/Classroom/SubtotalGroup）に
 * onDelete:Cascade で紐づく子テーブルは、旧レコード削除の前に必ず新IDへ移し替える
 * 必要がある。移し替え漏れがあると旧レコード削除時にサイレントにカスケード削除される。
 *
 * 【規約 / convention-as-code】
 * 対象への onDelete:Cascade 子テーブルを schema.prisma に追加したら、必ず対応する
 * CascadeMover を下記レジストリ（STUDENT/CLASSROOM/SUBTOTAL_GROUP_CASCADE_MOVERS）へ
 * 追加すること。レジストリと schema のカスケード子が一致しているかは
 * __tests__/import-export/unit/cascadeCoverage.test.ts が schema.prisma を解析して
 * 自動検証する（追加忘れはテストが赤くなって検出される）。
 *
 * UNIQUE制約のあるフィールド（Student.studentNumber, Classroom.name）は temp-value方式で回避:
 * 既存レコードのUNIQUEフィールドを一時値に変更してから新レコードを作成し、旧を削除する。
 */

import type { IdChangeTarget, IdMappings, PrismaTransaction } from "./types"

/**
 * カスケード子テーブルを旧ID→新IDへ移し替える1単位。
 *
 * `model` はスキーマ上のモデル名（PascalCase）。cascadeCoverage テストが
 * schema.prisma のカスケード子集合と突合するためのキーとして使う。
 */
export interface CascadeMover {
  model: string
  move: (
    tx: PrismaTransaction,
    fromId: string,
    toId: string
  ) => Promise<unknown>
}

/**
 * Student に onDelete:Cascade で紐づく子テーブル全件。
 * schema.prisma の Student へのカスケードFKと一致していること（テストで強制）。
 */
export const STUDENT_CASCADE_MOVERS: CascadeMover[] = [
  {
    model: "StudentClassroomMembership",
    move: (tx, from, to) =>
      tx.studentClassroomMembership.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    model: "ExamStudent",
    move: (tx, from, to) =>
      tx.examStudent.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    // UNIQUE([examPageId, studentId]) があるため移行先の重複を回避しつつ更新する
    model: "StudentAnswerImage",
    move: async (tx, from, to) => {
      const images = await tx.studentAnswerImage.findMany({
        where: { studentId: from },
      })
      for (const image of images) {
        const duplicate = await tx.studentAnswerImage.findFirst({
          where: { examPageId: image.examPageId, studentId: to },
        })
        if (duplicate) {
          await tx.studentAnswerImage.delete({ where: { id: image.id } })
        } else {
          await tx.studentAnswerImage.update({
            where: { id: image.id },
            data: { studentId: to },
          })
        }
      }
    },
  },
  {
    model: "QuestionScore",
    move: (tx, from, to) =>
      tx.questionScore.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    model: "ScoreDecision",
    move: (tx, from, to) =>
      tx.scoreDecision.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    model: "CompoundAnswerScore",
    move: (tx, from, to) =>
      tx.compoundAnswerScore.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    // UNIQUE([examId, studentId]) があるため移行先の重複を回避しつつ更新する
    model: "ReturnSnapshot",
    move: async (tx, from, to) => {
      const snapshots = await tx.returnSnapshot.findMany({
        where: { studentId: from },
      })
      for (const snapshot of snapshots) {
        const duplicate = await tx.returnSnapshot.findFirst({
          where: { examId: snapshot.examId, studentId: to },
        })
        if (duplicate) {
          await tx.returnSnapshot.delete({ where: { id: snapshot.id } })
        } else {
          await tx.returnSnapshot.update({
            where: { id: snapshot.id },
            data: { studentId: to },
          })
        }
      }
    },
  },
  {
    model: "GradeStudent",
    move: (tx, from, to) =>
      tx.gradeStudent.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    // UNIQUE([courseworkId, studentId]) があるため移行先の重複を回避しつつ更新する
    model: "CourseworkStudent",
    move: async (tx, from, to) => {
      const rows = await tx.courseworkStudent.findMany({
        where: { studentId: from },
      })
      for (const courseworkStudent of rows) {
        const duplicate = await tx.courseworkStudent.findFirst({
          where: {
            courseworkId: courseworkStudent.courseworkId,
            studentId: to,
          },
        })
        if (duplicate) {
          await tx.courseworkStudent.delete({
            where: { id: courseworkStudent.id },
          })
        } else {
          await tx.courseworkStudent.update({
            where: { id: courseworkStudent.id },
            data: { studentId: to },
          })
        }
      }
    },
  },
  {
    // UNIQUE([courseworkItemId, studentId]) があるため移行先の重複を回避しつつ更新する
    model: "CourseworkScore",
    move: async (tx, from, to) => {
      const rows = await tx.courseworkScore.findMany({
        where: { studentId: from },
      })
      for (const courseworkScore of rows) {
        const duplicate = await tx.courseworkScore.findFirst({
          where: {
            courseworkItemId: courseworkScore.courseworkItemId,
            studentId: to,
          },
        })
        if (duplicate) {
          await tx.courseworkScore.delete({
            where: { id: courseworkScore.id },
          })
        } else {
          await tx.courseworkScore.update({
            where: { id: courseworkScore.id },
            data: { studentId: to },
          })
        }
      }
    },
  },
  {
    model: "GradeOverride",
    move: (tx, from, to) =>
      tx.gradeOverride.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    model: "GradeFrozenScore",
    move: (tx, from, to) =>
      tx.gradeFrozenScore.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
  {
    model: "GradeItemExclusion",
    move: (tx, from, to) =>
      tx.gradeItemExclusion.updateMany({
        where: { studentId: from },
        data: { studentId: to },
      }),
  },
]

/**
 * Classroom に onDelete:Cascade で紐づく子テーブル全件。
 */
export const CLASSROOM_CASCADE_MOVERS: CascadeMover[] = [
  {
    model: "StudentClassroomMembership",
    move: (tx, from, to) =>
      tx.studentClassroomMembership.updateMany({
        where: { classroomId: from },
        data: { classroomId: to },
      }),
  },
  {
    model: "ExamClassroom",
    move: (tx, from, to) =>
      tx.examClassroom.updateMany({
        where: { classroomId: from },
        data: { classroomId: to },
      }),
  },
  {
    model: "GradeClassroom",
    move: (tx, from, to) =>
      tx.gradeClassroom.updateMany({
        where: { classroomId: from },
        data: { classroomId: to },
      }),
  },
  {
    model: "CourseworkClassroom",
    move: (tx, from, to) =>
      tx.courseworkClassroom.updateMany({
        where: { classroomId: from },
        data: { classroomId: to },
      }),
  },
]

/**
 * SubtotalGroup に onDelete:Cascade で紐づく子テーブル全件。
 */
export const SUBTOTAL_GROUP_CASCADE_MOVERS: CascadeMover[] = [
  {
    model: "ExamSubtotalGroup",
    move: (tx, from, to) =>
      tx.examSubtotalGroup.updateMany({
        where: { subtotalGroupId: from },
        data: { subtotalGroupId: to },
      }),
  },
  {
    model: "Subtotal",
    move: (tx, from, to) =>
      tx.subtotal.updateMany({
        where: { subtotalGroupId: from },
        data: { subtotalGroupId: to },
      }),
  },
  {
    model: "TagSubtotalGroup",
    move: (tx, from, to) =>
      tx.tagSubtotalGroup.updateMany({
        where: { subtotalGroupId: from },
        data: { subtotalGroupId: to },
      }),
  },
]

/**
 * カスケード子テーブルを全件移し替える（旧ID削除前に必ず呼ぶ）。
 */
async function moveCascadeChildren(
  movers: CascadeMover[],
  tx: PrismaTransaction,
  fromId: string,
  toId: string
): Promise<void> {
  for (const mover of movers) {
    await mover.move(tx, fromId, toId)
  }
}

/**
 * idMappings 内で existingId を指す全エントリを newId に張り替える。
 */
function remapMappingValues(
  mapping: Record<string, string>,
  existingId: string,
  newId: string
): void {
  for (const [importId, mappedId] of Object.entries(mapping)) {
    if (mappedId === existingId) {
      mapping[importId] = newId
    }
  }
}

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
    } else if (target.category === "classroom") {
      await changeClassroomId(tx, target, idMappings, warnings)
    } else if (target.category === "subtotalGroup") {
      await changeSubtotalGroupId(tx, target, idMappings, warnings)
    }
  }
}

/**
 * 生徒IDの変更（temp-value方式 + カスケード子の移し替え）
 * 移し替え対象は STUDENT_CASCADE_MOVERS を参照（schema と一致をテストで強制）。
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
  await tx.student.update({
    where: { id: target.existingId },
    data: { studentNumber: `__TEMP_${target.existingId}` },
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

  // 3. カスケード子を全件移し替え（旧生徒削除前に必須）
  await moveCascadeChildren(
    STUDENT_CASCADE_MOVERS,
    tx,
    target.existingId,
    target.newId
  )

  // 4. 古いレコードを削除
  await tx.student.delete({ where: { id: target.existingId } })

  // 5. マッピングを更新
  remapMappingValues(idMappings.student, target.existingId, target.newId)
}

/**
 * 学級IDの変更（temp-value方式 + カスケード子の移し替え）
 * 移し替え対象は CLASSROOM_CASCADE_MOVERS を参照（schema と一致をテストで強制）。
 */
async function changeClassroomId(
  tx: PrismaTransaction,
  target: IdChangeTarget,
  idMappings: IdMappings,
  _warnings: string[]
): Promise<void> {
  const existingClassroom = await tx.classroom.findUnique({
    where: { id: target.existingId },
  })

  if (!existingClassroom) return

  // 1. UNIQUE制約のあるnameを一時値に変更
  await tx.classroom.update({
    where: { id: target.existingId },
    data: { name: `__TEMP_${target.existingId}` },
  })

  // 2. 新しいIDで元のnameを使ってレコード作成
  await tx.classroom.create({
    data: {
      id: target.newId,
      name: existingClassroom.name,
      classroomCode: existingClassroom.classroomCode,
      grade: existingClassroom.grade,
      description: existingClassroom.description,
      createdAt: existingClassroom.createdAt,
      updatedAt: existingClassroom.updatedAt,
    },
  })

  // 3. カスケード子を全件移し替え（旧学級削除前に必須）
  await moveCascadeChildren(
    CLASSROOM_CASCADE_MOVERS,
    tx,
    target.existingId,
    target.newId
  )

  // 4. 古いレコードを削除
  await tx.classroom.delete({ where: { id: target.existingId } })

  // 5. マッピングを更新
  remapMappingValues(idMappings.classroom, target.existingId, target.newId)
}

/**
 * 小計グループIDの変更（カスケード子の移し替え）
 * 移し替え対象は SUBTOTAL_GROUP_CASCADE_MOVERS を参照（schema と一致をテストで強制）。
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

  // カスケード子を全件移し替え（旧グループ削除前に必須）
  await moveCascadeChildren(
    SUBTOTAL_GROUP_CASCADE_MOVERS,
    tx,
    target.existingId,
    target.newId
  )

  await tx.subtotalGroup.delete({ where: { id: target.existingId } })

  remapMappingValues(idMappings.subtotalGroup, target.existingId, target.newId)
}
