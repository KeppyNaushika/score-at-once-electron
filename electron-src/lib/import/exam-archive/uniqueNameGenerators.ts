/**
 * ユニーク名生成モジュール
 *
 * 重複を避けるための一意な名前を生成
 */

import type { PrismaClient } from "@prisma/client"

/** Prismaトランザクションクライアント型 */
export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * 重複しないstudentNumberを生成
 *
 * 既存のstudentNumberがある場合は `_1`, `_2` のようなサフィックスを付与して
 * 一意性を保証する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalStudentNumber - 元のstudentNumber
 * @returns 一意なstudentNumber
 */
export async function generateUniqueStudentNumber(
  tx: TransactionClient,
  originalStudentNumber: string
): Promise<string> {
  const existing = await tx.student.findUnique({
    where: { studentNumber: originalStudentNumber },
  })

  if (!existing) {
    return originalStudentNumber
  }

  // サフィックスを付けて重複を回避
  let suffix = 1
  let newStudentNumber = `${originalStudentNumber}_${suffix}`

  while (
    await tx.student.findUnique({ where: { studentNumber: newStudentNumber } })
  ) {
    suffix++
    newStudentNumber = `${originalStudentNumber}_${suffix}`
  }

  return newStudentNumber
}

/**
 * 重複しない学級名を生成
 *
 * 既存の名前がある場合は `(2)`, `(3)` のようなサフィックスを付与して
 * 一意性を保証する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalName - 元の学級名
 * @returns 一意な学級名
 */
export async function generateUniqueClassName(
  tx: TransactionClient,
  originalName: string
): Promise<string> {
  const existing = await tx.classroom.findUnique({
    where: { name: originalName },
  })

  if (!existing) {
    return originalName
  }

  // サフィックスを付けて重複を回避
  let suffix = 2
  let newName = `${originalName} (${suffix})`

  while (await tx.classroom.findUnique({ where: { name: newName } })) {
    suffix++
    newName = `${originalName} (${suffix})`
  }

  return newName
}
