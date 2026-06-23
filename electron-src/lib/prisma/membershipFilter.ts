/**
 * 学級所属（StudentClassMembership）の在籍フィルタ
 *
 * exam / grade の対象生徒管理で共有する純関数。
 * 「在籍中」は生徒単体では決まらず、終了していない所属（endDateがnull、
 * または基準日以降に終了予定）でしか定義できない。
 */

import { Prisma } from "@prisma/client"

/**
 * 基準日時点で有効なmembershipの条件
 *
 * 在籍中とみなすのは「基準日に既に始まっており（startDate <= 基準日）、
 * かつまだ終了していない（endDateがnull、または基準日以降に終了予定）」所属。
 * startDate を見ないと、基準日より後に始まる将来の所属（転入・進級先など）まで
 * 「在籍中」に混入してしまうため、両側を必ず判定する。
 * 基準日未指定なら現在日時を使う。
 *
 * 注: DateTimeはISO text前提。Date を渡すと Prisma の driver adapter が
 * ISO text 化して比較するため、自前で文字列化しないこと。
 */
export function membershipFilterAt(
  referenceDate?: Date | null
): Prisma.StudentClassMembershipWhereInput {
  const date = referenceDate ?? new Date()
  return {
    startDate: { lte: date },
    OR: [{ endDate: null }, { endDate: { gte: date } }],
  }
}
