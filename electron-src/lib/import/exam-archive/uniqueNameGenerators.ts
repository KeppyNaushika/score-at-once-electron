/**
 * ユニーク名生成モジュール
 *
 * 取り込む学級名・学籍番号・試験名が既存とぶつかったとき、サフィックスを付けて別物として作る。
 *
 * 学級名・学籍番号は 2026-08-22 に `@unique` を外した
 * （`20260822140000_drop_human_name_uniques`）ので、**DB 上は同じ値が2つ並んでも通る**。
 * それでもここで名前をずらすのは、取り込みが「同名＝同一」と決めていないことを
 * 利用者が名簿の上で見分けられるようにするためで、制約を満たすためではない。
 *
 * 有無を見るだけなので findFirst でよい（複数当たっても「在る」以上の意味は無く、
 * どれを採るかを決める必要も無い）。
 */

import type { PrismaClient } from "@prisma/client"

/** Prismaトランザクションクライアント型 */
export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * 既存とぶつからないstudentNumberを生成
 *
 * 既存のstudentNumberがある場合は `_1`, `_2` のようなサフィックスを付与する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalStudentNumber - 元のstudentNumber
 * @returns 既存のどれとも一致しないstudentNumber
 */
export async function generateUniqueStudentNumber(
  tx: TransactionClient,
  originalStudentNumber: string
): Promise<string> {
  const existing = await tx.student.findFirst({
    where: { studentNumber: originalStudentNumber },
  })

  if (!existing) {
    return originalStudentNumber
  }

  // サフィックスを付けて重複を回避
  let suffix = 1
  let newStudentNumber = `${originalStudentNumber}_${suffix}`

  while (
    await tx.student.findFirst({ where: { studentNumber: newStudentNumber } })
  ) {
    suffix++
    newStudentNumber = `${originalStudentNumber}_${suffix}`
  }

  return newStudentNumber
}

/**
 * 既存とぶつからない試験名を生成
 *
 * 「別の試験として取り込む」を選んだときだけ使う。統合しないと決めた以上、
 * 同じ名前の試験が2つ並ぶので、一覧のどちらが取り込んだ方かを名前で見分けられるようにする。
 * 試験名に DB の制約は無く、これは人が読むためのサフィックス。
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalName - 元の試験名
 * @returns 既存のどれとも一致しない試験名
 */
export async function generateUniqueExamName(
  tx: TransactionClient,
  originalName: string
): Promise<string> {
  const existing = await tx.exam.findFirst({
    where: { examName: originalName },
  })

  if (!existing) {
    return originalName
  }

  let suffix = 2
  let newName = `${originalName} (${suffix})`

  while (await tx.exam.findFirst({ where: { examName: newName } })) {
    suffix++
    newName = `${originalName} (${suffix})`
  }

  return newName
}

/**
 * 既存とぶつからない学級名を生成
 *
 * 既存の名前がある場合は `(2)`, `(3)` のようなサフィックスを付与する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param originalName - 元の学級名
 * @returns 既存のどれとも一致しない学級名
 */
export async function generateUniqueClassName(
  tx: TransactionClient,
  originalName: string
): Promise<string> {
  const existing = await tx.classroom.findFirst({
    where: { name: originalName },
  })

  if (!existing) {
    return originalName
  }

  // サフィックスを付けて重複を回避
  let suffix = 2
  let newName = `${originalName} (${suffix})`

  while (await tx.classroom.findFirst({ where: { name: newName } })) {
    suffix++
    newName = `${originalName} (${suffix})`
  }

  return newName
}
