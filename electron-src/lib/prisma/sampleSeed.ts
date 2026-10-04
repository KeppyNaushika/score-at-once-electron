/**
 * 見本のデータ（シード）
 *
 * 新規インストールのローカルモードと、空の共有プロファイルを作るときに入れる。
 * 「ローカルの DB に利用者のデータが無い」の判定（`../sync/localDataEmptiness.ts`）は、
 * ここで入れる行を利用者のデータに数えないので、**見本の名前はこの定数1か所で決める。**
 */

import type { PrismaClient } from "@prisma/client"

/** 見本の名前。見本を変えたら、空の判定もこれに追随する */
export const SAMPLE_SEED_NAMES = {
  adminUsername: "admin",
  classroomName: "サンプル学級",
  studentNumbers: ["STU001", "STU002", "STU003"],
  subtotalGroupName: "数学小計グループ",
} as const

/**
 * 見本を入れる。
 *
 * username / 学級名 / 学籍番号は unique ではないので upsert の鍵に取れない
 * （20260822140000_drop_human_name_uniques）。ここが問うているのは
 * 「同じ名前の行が既に在るか」という有無だけなので、findFirst で見て無ければ作る。
 * 2度走っても増えない。
 */
export async function seedSampleData(prisma: PrismaClient): Promise<void> {
  try {
    // デフォルトユーザーの作成
    const existingAdmin = await prisma.user.findFirst({
      where: { username: SAMPLE_SEED_NAMES.adminUsername },
    })
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          username: SAMPLE_SEED_NAMES.adminUsername,
          name: "管理者",
          role: "admin",
          passcodeType: "none",
        },
      })
    }

    // サンプル学級の作成
    const sampleClassroom =
      (await prisma.classroom.findFirst({
        where: { name: SAMPLE_SEED_NAMES.classroomName },
      })) ??
      (await prisma.classroom.create({
        data: {
          name: SAMPLE_SEED_NAMES.classroomName,
          classroomCode: "SAMPLE01",
          grade: 1,
          description: "システム動作確認用のサンプル学級です",
          isVisible: true,
        },
      }))

    // サンプル生徒の作成
    const sampleStudents = [
      {
        studentNumber: SAMPLE_SEED_NAMES.studentNumbers[0],
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
        enrollmentYear: new Date().getFullYear(),
      },
      {
        studentNumber: SAMPLE_SEED_NAMES.studentNumbers[1],
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
        enrollmentYear: new Date().getFullYear(),
      },
      {
        studentNumber: SAMPLE_SEED_NAMES.studentNumbers[2],
        lastName: "田中",
        firstName: "次郎",
        lastNameKana: "タナカ",
        firstNameKana: "ジロウ",
        enrollmentYear: new Date().getFullYear(),
      },
    ]

    for (const [index, studentData] of sampleStudents.entries()) {
      const student =
        (await prisma.student.findFirst({
          where: { studentNumber: studentData.studentNumber },
        })) ?? (await prisma.student.create({ data: studentData }))

      // 学級への所属を作成（既存チェック後に作成）
      const existingMembership =
        await prisma.studentClassroomMembership.findFirst({
          where: {
            studentId: student.id,
            classroomId: sampleClassroom.id,
            endDate: null, // 現在有効な所属のみ
          },
        })

      if (!existingMembership) {
        await prisma.studentClassroomMembership.create({
          data: {
            studentId: student.id,
            classroomId: sampleClassroom.id,
            attendanceNumber: index + 1,
            startDate: new Date(),
          },
        })
      }
    }

    // サンプル小計グループの作成
    let mathSubtotalGroup = await prisma.subtotalGroup.findFirst({
      where: { name: SAMPLE_SEED_NAMES.subtotalGroupName },
    })

    if (!mathSubtotalGroup) {
      mathSubtotalGroup = await prisma.subtotalGroup.create({
        data: {
          name: SAMPLE_SEED_NAMES.subtotalGroupName,
        },
      })
    }

    // サンプル小計項目の作成
    const mathSubtotals = [
      { name: "計算問題", order: 1 },
      { name: "文章題", order: 2 },
      { name: "図形問題", order: 3 },
    ]

    for (const subtotalData of mathSubtotals) {
      // 既存チェック後に作成（新しいスキーマではユニーク制約名が変更）
      const existingSubtotal = await prisma.subtotal.findFirst({
        where: {
          subtotalGroupId: mathSubtotalGroup.id,
          name: subtotalData.name,
        },
      })

      if (!existingSubtotal) {
        await prisma.subtotal.create({
          data: {
            ...subtotalData,
            subtotalGroupId: mathSubtotalGroup.id,
          },
        })
      }
    }
  } catch (error) {
    console.error("❌ Error during seed:", error)
    throw error
  }
}
