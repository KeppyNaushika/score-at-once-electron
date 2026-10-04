import type { Prisma } from "@prisma/client"
import bcrypt from "bcrypt"

import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import {
  buildSoleOwnerBlockedMessage,
  findSoleOwnedExams,
} from "@/lib/shared/userSoleOwnership"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import { getCurrentActorUserId } from "./auditActor"
import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"
import { deleteAfterRecount } from "./deleteAfterRecount"
import { PUBLIC_USER_OMIT, type PublicUser } from "./publicUser"
import {
  SCORED_COMPOUND_ANSWER_SCORE_FILTER,
  SCORED_QUESTION_SCORE_FILTER,
} from "./studentAnswer/crud"

export const fetchUsers = async (): Promise<PublicUser[]> => {
  try {
    return await prisma.user.findMany({ omit: PUBLIC_USER_OMIT })
  } catch (error) {
    console.error("Failed to fetch users:", error)
    throw error
  }
}

export const createUser = async (userData: {
  username: string
  name: string
  passcode?: string
  passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
}): Promise<PublicUser> => {
  try {
    const hashedPasscode =
      userData.passcode && userData.passcodeType !== "none"
        ? await bcrypt.hash(userData.passcode, 10)
        : null

    const user = await prisma.user.create({
      omit: PUBLIC_USER_OMIT,
      data: {
        username: userData.username,
        name: userData.name,
        passcode: hashedPasscode,
        passcodeType: userData.passcodeType || "none",
      },
    })

    await recordAuditLog({
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      target: user.name,
    })

    return user
  } catch (error) {
    console.error("Failed to create user:", error)
    throw error
  }
}

export const verifyPasscode = async (
  userId: string,
  passcode: string
): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.passcode || user.passcodeType === "none") {
      return true // パスコードが設定されていない場合は認証成功
    }

    return await bcrypt.compare(passcode, user.passcode)
  } catch (error) {
    console.error("Failed to verify passcode:", error)
    return false
  }
}

export const updateUser = async (
  userId: string,
  userData: {
    username?: string
    name?: string
  }
): Promise<PublicUser> => {
  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
    })

    const user = await prisma.user.update({
      omit: PUBLIC_USER_OMIT,
      where: { id: userId },
      data: {
        ...(userData.username && { username: userData.username }),
        ...(userData.name && { name: userData.name }),
      },
    })

    await recordAuditLog({
      action: "user.update",
      entityType: "User",
      entityId: user.id,
      target: user.name,
      changes: diffFields(before ?? undefined, user, [
        { field: "name", label: "名前" },
        { field: "username", label: "ユーザー名" },
      ]),
    })

    return user
  } catch (error) {
    console.error("Failed to update user:", error)
    throw error
  }
}

export const updateUserPasscode = async (
  userId: string,
  passcode?: string,
  passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
): Promise<PublicUser> => {
  try {
    const hashedPasscode =
      passcode && passcodeType !== "none"
        ? await bcrypt.hash(passcode, 10)
        : null

    const user = await prisma.user.update({
      omit: PUBLIC_USER_OMIT,
      where: { id: userId },
      data: {
        passcode: hashedPasscode,
        passcodeType: passcodeType || "none",
      },
    })

    // 監査ログ: パスコード変更（パスコード値そのものは記録しない）
    await recordAuditLog({
      action: "user.update",
      entityType: "User",
      entityId: user.id,
      target: user.name,
      summary: `ユーザー「${user.name}」のパスコードを変更しました`,
    })

    return user
  } catch (error) {
    console.error("Failed to update user passcode:", error)
    throw error
  }
}

/** 試験の所有者全員の参加を同梱する（ただ1人の所有者かを見るため） */
const userExamOwnershipInclude = {
  exam: { include: { userExams: { where: { role: "OWNER" } } } },
} satisfies Prisma.UserExamInclude

/**
 * その利用者が所有者（OWNER）として参加している試験への参加。試験ごとに、所有者
 * 全員の参加を同梱する。ただ1人の所有者になっている試験は renderer と main が同じ
 * 関数（`findSoleOwnedExams`）でここから導く。
 */
export const fetchUserExamOwnerships = async (userId: string) =>
  await prisma.userExam.findMany({
    where: { userId, role: "OWNER" },
    include: userExamOwnershipInclude,
  })

/**
 * 利用者を消すと一緒に消えるものを、削除の確認で見せる形で数える。
 *
 * **main で数えて件数だけを返す。** 「計算は renderer 側」規約の名指しの例外
 * （docs/coding-style.md「DB 由来データを計算した値の扱い」）。採点結果は1人で
 * 数万行になり、行を renderer へ渡して `.length` を取ると重いため。
 *
 * 利用者ごとの設定（キーの割り当て・表示の好み等）も一緒に消えるが、本人にしか
 * 意味が無いので見せない。実行者の記録（招待した人・担当を割り当てた人・成績を
 * 確定した人・返却版を記録した人）は null になるだけで行は残るので数えない。
 *
 * 0件の項目は返さない。見せていない項目は「0件と見せた」ものとして扱われるので、
 * 後から増えれば数え直しが拾う（`deleteAfterRecount`）。
 */
const countUserDeletionCounts = async (
  userId: string
): Promise<ConfirmedDeletionCount[]> => {
  const [
    questionScoreCount,
    drawingAnnotationCount,
    scoreDecisionCount,
    compoundAnswerScoreCount,
    answerSheetDefinitionCount,
    examMembershipCount,
    cropRegionAssignmentCount,
  ] = await Promise.all([
    prisma.questionScore.count({
      where: { userId, ...SCORED_QUESTION_SCORE_FILTER },
    }),
    prisma.drawingAnnotation.count({ where: { questionScore: { userId } } }),
    prisma.scoreDecision.count({ where: { decidedByUserId: userId } }),
    prisma.compoundAnswerScore.count({
      where: { userId, ...SCORED_COMPOUND_ANSWER_SCORE_FILTER },
    }),
    prisma.asbDefinition.count({ where: { userId } }),
    prisma.userExam.count({ where: { userId } }),
    prisma.cropRegionAssignment.count({ where: { userId } }),
  ])

  return [
    {
      countedName: DELETION_COUNT_NAME.userQuestionScore,
      shownCount: questionScoreCount,
    },
    {
      countedName: DELETION_COUNT_NAME.drawingAnnotation,
      shownCount: drawingAnnotationCount,
    },
    {
      countedName: DELETION_COUNT_NAME.scoreDecision,
      shownCount: scoreDecisionCount,
    },
    {
      countedName: DELETION_COUNT_NAME.scoredCompoundAnswer,
      shownCount: compoundAnswerScoreCount,
    },
    {
      countedName: DELETION_COUNT_NAME.answerSheetDefinition,
      shownCount: answerSheetDefinitionCount,
    },
    {
      countedName: DELETION_COUNT_NAME.examMembership,
      shownCount: examMembershipCount,
    },
    {
      countedName: DELETION_COUNT_NAME.cropRegionAssignment,
      shownCount: cropRegionAssignmentCount,
    },
  ].filter((deletionCount) => deletionCount.shownCount > 0)
}

/**
 * 利用者を消すと一緒に消えるものを数える（削除確認ダイアログの事前照会）。
 *
 * ここで返した件数を、利用者はそのまま画面で見る。画面はこの配列を表示にも
 * 「削除の要求に添える件数」にも使うので、見せたものと送るものが必ず一致する。
 */
export const getUserDeletionCounts = (
  userId: string
): Promise<ConfirmedDeletionCount[]> => countUserDeletionCounts(userId)

/**
 * 利用者を削除する。その利用者の採点結果・確定・解答用紙・試験への参加なども
 * 外部キーのカスケードで一緒に消える（docs/ownership-and-sharing-design.md §4.4）。
 * 同期で他の端末からも消え、元に戻せない。
 *
 * 次の場合は消さずに断る（確認画面でも前もって押させないが、最終判定はここで行う）。
 * - **ログイン中の本人。** 消すと操作している利用者が居なくなる
 * - **ただ1人の所有者になっている試験がある。** 所有者の居ない試験が残る
 *
 * @param confirmedCounts 利用者が確認ダイアログで見た件数。消す直前に数え直し、
 *   増えていれば削除を中止する（`deleteAfterRecount`）。
 */
export const deleteUser = async (
  userId: string,
  confirmedCounts: ConfirmedDeletionCount[]
): Promise<PublicUser> => {
  if (userId === getCurrentActorUserId()) {
    throw new Error("ログイン中の利用者は削除できません")
  }

  const deletedUser = await deleteAfterRecount({
    confirmedCounts,
    recount: () => countUserDeletionCounts(userId),
    remove: async () => {
      const blockedMessage = buildSoleOwnerBlockedMessage(
        findSoleOwnedExams(await fetchUserExamOwnerships(userId))
      )
      if (blockedMessage !== null) throw new Error(blockedMessage)
      return await prisma.user.delete({
        omit: PUBLIC_USER_OMIT,
        where: { id: userId },
      })
    },
  })

  // 削除後は監査ログの操作者名が引けなくなるので、名前を target に残す
  await recordAuditLog({
    action: "user.delete",
    entityType: "User",
    entityId: deletedUser.id,
    target: deletedUser.name,
  })

  return deletedUser
}
