/**
 * 利用者を削除すると所有者（OWNER）が居なくなる試験を見つける。
 *
 * 利用者を消すと、その利用者の試験への参加（UserExam）も一緒に消える。その利用者が
 * 試験のただ1人の所有者だと、**所有者の居ない試験**が残る。所有者にしかできない操作
 * （採点の確定・担当の割り当て・参加者の招待）がその試験で誰にもできなくなるので、
 * 削除を断る。
 *
 * 材料は、利用者が所有者として参加している UserExam に、試験ごとの所有者の参加を
 * 同梱したもの（`electron-src/lib/prisma/user.ts` の `fetchUserExamOwnerships`）。
 * 確認画面が前もって見せる文言と、main が削除を断る文言を同じにするため、
 * renderer と main の両方がここを使う。
 */

import type { Exam, UserExam } from "@prisma/client"

/** 利用者が所有者として参加している1試験。試験の所有者全員の参加を同梱する */
type UserExamOwnership = Pick<UserExam, "userId"> & {
  exam: Pick<Exam, "id" | "examName"> & {
    userExams: Pick<UserExam, "userId" | "role">[]
  }
}

/**
 * 利用者がただ1人の所有者になっている試験。
 *
 * 同梱の参加に所有者以外が混ざっていても数えない（役割はここで見直す）。
 */
export function findSoleOwnedExams<TOwnership extends UserExamOwnership>(
  ownerships: TOwnership[]
): TOwnership["exam"][] {
  return ownerships
    .filter((ownership) =>
      ownership.exam.userExams
        .filter((userExam) => userExam.role === "OWNER")
        .every((userExam) => userExam.userId === ownership.userId)
    )
    .map((ownership) => ownership.exam)
}

/**
 * ただ1人の所有者になっている試験があれば、削除を断る文言を返す。無ければ null。
 * 試験名は1行に1つ並べる（確認画面は改行をそのまま見せる）。
 */
export function buildSoleOwnerBlockedMessage(
  soleOwnedExams: Pick<Exam, "examName">[]
): string | null {
  if (soleOwnedExams.length === 0) return null
  return [
    "この利用者だけがオーナーになっている試験があるため、削除できません。",
    ...soleOwnedExams.map((exam) => `・${exam.examName}`),
    // オーナーを増やせるのはオーナーだけなので、この利用者本人がログインして行う
    "先にこの利用者でログインし、試験の概要ページの「メンバー」で別の教員を「オーナーにする」か、試験を削除してください。",
  ].join("\n")
}
