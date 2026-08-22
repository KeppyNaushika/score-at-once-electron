/**
 * 採点者（利用者）マッチングロジック
 *
 * **採点行の同一性は (設問, 受験者, 採点者) の3つ組。** QuestionScore に unique が
 * 無いのは、同じマスに教員の数だけ行が並ぶのが正常だからで、取り込みが採点者を見ずに
 * 「その設問・その受験者の行」を1つ拾って上書きすると、別の教員の採点が黙って消える。
 * だから取り込みの前に、**アーカイブの採点者をこのPCの利用者へ解決しておく**。
 *
 * 照合の対象は**採点層から実際に参照されている利用者だけ**にする。users.json には
 * 書き出した本人も載るが、その人が1つも採点していないなら取り込み先に作る理由が無い
 * （作れば、使われないアカウントが取り込みのたびに増える）。
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
} from "../../../../../src/types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import { describeCandidateCount, groupByHumanKey } from "../../humanKeyMatching"

/** アーカイブ側の利用者1行 */
type ArchiveUser = ExtractedArchiveData["usersData"]["users"][number]

/**
 * 採点層から参照されている採点者の id を集める。
 *
 * ReturnSnapshot.capturedByUserId は入れない。あれは「いつ誰が答案を返したか」という
 * 済んだ出来事の記録で、取り込み先に居なければ記録者なしへ倒す決まりになっている
 * （importScoring の processReturnSnapshots）。採点の持ち主とは別の話なので、
 * ここで利用者を作る理由にはしない。
 */
export function collectGraderUserIds(
  importData: ExtractedArchiveData
): Set<string> {
  const graderUserIds = new Set<string>()
  for (const questionScore of importData.scoresData.questionScores) {
    graderUserIds.add(questionScore.userId)
  }
  for (const scoreDecision of importData.scoresData.scoreDecisions ?? []) {
    graderUserIds.add(scoreDecision.decidedByUserId)
  }
  for (const compoundAnswerScore of importData.examData.compoundAnswerScores ??
    []) {
    graderUserIds.add(compoundAnswerScore.userId)
  }
  return graderUserIds
}

/** 画面に出す名乗り（利用者名だけだと同じ文字列が並ぶので氏名を添える） */
const displayLabelOf = (archiveUser: ArchiveUser): string =>
  archiveUser.name && archiveUser.name !== archiveUser.username
    ? `${archiveUser.name}（${archiveUser.username}）`
    : archiveUser.username

/**
 * 採点者の事前照合
 *
 * - byId: 同じ id の利用者がこのPCに居る（同じパソコンで作ったデータ）
 * - byName: 利用者名が一致する（`username` は unique ではないので候補どまり）
 * - noMatch: どちらも当たらない（新しく作るしかない）
 */
export async function preMatchUsers(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const graderUserIds = collectGraderUserIds(importData)
  const archiveGraders = importData.usersData.users.filter((archiveUser) =>
    graderUserIds.has(archiveUser.id)
  )

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  if (archiveGraders.length === 0) {
    return { byId, byName, noMatch, allExistingItems: [] }
  }

  const existingUsers = await prisma.user.findMany()
  const existingById = new Map(existingUsers.map((user) => [user.id, user]))
  // 利用者名は unique ではない（2026-08-22 に外した）ので、名前で引くと複数当たりうる。
  // 候補は humanKeyMatching の決まりで古い順に並び、先頭を候補として見せる
  const existingByUsername = groupByHumanKey(
    existingUsers,
    (user) => user.username
  )

  for (const archiveGrader of archiveGraders) {
    const displayLabel = displayLabelOf(archiveGrader)

    const idMatch = existingById.get(archiveGrader.id)
    if (idMatch) {
      byId.push({
        importId: archiveGrader.id,
        existingId: idMatch.id,
        importData: archiveGrader,
        existingData: idMatch,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    const usernameCandidates =
      existingByUsername.get(archiveGrader.username) ?? []
    const usernameMatch = usernameCandidates[0]
    if (usernameMatch) {
      byName.push({
        importId: archiveGrader.id,
        existingId: usernameMatch.id,
        importData: archiveGrader,
        existingData: usernameMatch,
        displayLabel,
        matchReason: describeCandidateCount(
          "利用者名が一致",
          usernameCandidates.length
        ),
      })
      continue
    }

    noMatch.push({
      importId: archiveGrader.id,
      importData: archiveGrader,
      displayLabel,
    })
  }

  return {
    byId,
    byName,
    noMatch,
    // 「既存の利用者に結ぶ」を人が選び直せるように、このPCの利用者を全部渡す
    allExistingItems: existingUsers.map((user) => ({
      id: user.id,
      name:
        user.name === user.username
          ? user.name
          : `${user.name}（${user.username}）`,
    })),
  }
}
