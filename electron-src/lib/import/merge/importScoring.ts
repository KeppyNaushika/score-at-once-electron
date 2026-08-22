/**
 * ID統合インポート: 採点結果レイヤーの処理
 *
 * - QuestionScore（設問スコア。行の同一性は (設問, 受験者, 採点者) の3つ組）
 * - ScoreDecision（OWNER確定スコア。decidedAt LWWで競合解決）
 * - CompoundAnswerScore（複合解答スコア。updatedAt LWWで競合解決）
 * - CropRegionAssignment（設問ごとの採点担当。usernameで照合）
 * - ReturnSnapshot（返却版スナップショット。capturedAt LWWで競合解決）
 *
 * **採点した人・確定した人は、アーカイブに書かれたその人のままにする。**
 * 取り込んだ人へ倒すと、誰が付けた点か分からなくなり、確定の材料そのものが変わる
 * （07 は自分の採点だけを見せ、ScoreDecision は採点者ごとの行から確定を作る）。
 * そもそも取り込んだ人のものにするなら**競合という概念が要らない**。競合の検出を
 * 持っていること自体が、採点者ごとの行を前提にしている。
 * アーカイブの採点者は `idMappings.user`（processUserIdIntegration が張る）で解決する。
 *
 * 事前照合の競合一覧（scoringConflicts）は**最終確認に件数を見せるためのもの**で、
 * 書き込みには通さない。どちらを採るかは他の全ての値と同じ規則（上書き=無条件 /
 * 統合=LWW）で決まるので、一覧に載ったかどうかで書き込みの規則が変わってはいけない。
 */

import * as crypto from "crypto"

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

/**
 * アーカイブの採点者を、取り込み先の利用者へ解決する。
 *
 * 解決できないときは取り込んだ人へ倒す。**それでも他人の行は奪わない** ——
 * 採点行を引くのは (設問, 受験者, 採点者) の3つ組なので、倒した先が取り込んだ人なら
 * 触るのも取り込んだ人自身の行だけになる。
 *
 * 解決できないのは、採点者の行が users.json に入っていない古いアーカイブを、
 * 書き出したのとは別のパソコンへ持ってきたとき。名前も利用者名も分からないので
 * 新しく作ることもできない。
 */
function resolveGraderUserId(
  archiveUserId: string,
  idMappings: IdMappings,
  currentUserId: string,
  unresolvedGraderIds: Set<string>
): string {
  const resolved = idMappings.user[archiveUserId]
  if (resolved) return resolved
  unresolvedGraderIds.add(archiveUserId)
  return currentUserId
}

/** 解決できなかった採点者がいたことを利用者へ伝える文言（居なければ空） */
function unresolvedGraderWarnings(unresolvedGraderIds: Set<string>): string[] {
  if (unresolvedGraderIds.size === 0) return []
  return [
    `${unresolvedGraderIds.size}名ぶんの採点は、採点者がこのデータベースで特定できないため、取り込んだ人の採点として登録しました（アーカイブに採点者の情報が入っていません）。`,
  ]
}

/**
 * QuestionScore（設問スコア）を処理
 *
 * **行の同一性は (設問, 受験者, 採点者) の3つ組。** QuestionScore に unique が無いのは
 * 「同じマスに教員の数だけ行が並ぶ」のが正常だからで、採点者を見ずに1行拾って上書きすると
 * **別の教員の採点が黙って消える**。取り込んだ採点はアーカイブの採点者のままにする。
 *
 * 同じ採点者の同じマスの行がローカルに複数あることは、unique が無い以上ありうる。
 * そのときは **updatedAt の新しい方だけを見て、古い方には触らない**（数を減らす操作を
 * 取り込みに混ぜない。畳むなら畳むで、別の操作として人が選ぶべきもの）。
 */
export async function processQuestionScores(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string[]> {
  const unresolvedGraderIds = new Set<string>()

  for (const questionScore of data.scoresData.questionScores) {
    const newRegionId = idMappings.cropRegion[questionScore.cropRegionId]
    const newExamStudentId = questionScore.examStudentId
      ? idMappings.examStudent[questionScore.examStudentId]
      : null
    if (!newRegionId || !newExamStudentId) continue

    const graderUserId = resolveGraderUserId(
      questionScore.userId,
      idMappings,
      currentUserId,
      unresolvedGraderIds
    )

    // 同じ採点者の同じマスの行が複数あったら、いちばん新しい1行だけを相手にする。
    // 時刻が並んだときは id で決着させる（どの端末で走らせても同じ答えになる）
    const existingByCell = await tx.questionScore.findFirst({
      where: {
        cropRegionId: newRegionId,
        examStudentId: newExamStudentId,
        userId: graderUserId,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    })

    // 3つ組で当たらなかったのに同じ id の行が既にある、ということはありうる
    // （別の教員の行がその id を持っている / 受験者の結び付けが変わった）。
    // **その行は書き換えない** —— 相手のマスも持ち主も違うので、この採点行ではない。
    // 見るのは「その id では作れない」という一点だけ
    const takenScoreId = existingByCell
      ? null
      : await tx.questionScore.findUnique({ where: { id: questionScore.id } })
    const existingScore = existingByCell

    const incomingPartialScore = questionScore.partialScore
      ? parseFloat(questionScore.partialScore)
      : null

    if (existingScore) {
      idMappings.questionScore[questionScore.id] = existingScore.id

      // 中身が同じなら何も書かない。書けば updatedAt だけが動き、同期では
      // 「変更あり」として流れる
      const existingPartialScore = existingScore.partialScore
        ? Number(existingScore.partialScore)
        : null
      if (
        existingScore.status === questionScore.status &&
        existingPartialScore === incomingPartialScore &&
        existingScore.comment === questionScore.comment
      ) {
        counts.unchanged.scores++
        continue
      }

      const updatedAt = replacementUpdatedAt(
        policy,
        questionScore.updatedAt,
        existingScore.updatedAt
      )
      if (!updatedAt) {
        // 中身は違うが、規則がこのPCの採点を採った（統合＝アーカイブの方が古い）
        counts.skipped.scores++
        continue
      }
      await tx.questionScore.update({
        where: { id: existingScore.id },
        data: {
          partialScore: incomingPartialScore,
          status: questionScore.status,
          comment: questionScore.comment,
          updatedAt,
        },
      })
      counts.updated.scores++
      continue
    }

    // id が別の行に取られているなら、その id では作れない。
    // 採点行の id は誰からも参照されない不透明な値なので、振り直して構わない
    const newScoreId = takenScoreId ? crypto.randomUUID() : questionScore.id
    await tx.questionScore.create({
      data: {
        id: newScoreId,
        cropRegionId: newRegionId,
        examStudentId: newExamStudentId,
        partialScore: incomingPartialScore,
        status: questionScore.status,
        comment: questionScore.comment,
        userId: graderUserId,
        ...policy.createdTimestamps(questionScore),
      },
    })
    idMappings.questionScore[questionScore.id] = newScoreId
    counts.created.scores++
  }

  return unresolvedGraderWarnings(unresolvedGraderIds)
}

/**
 * ScoreDecision（OWNER確定スコア）を処理
 *
 * 設問×生徒で高々1件（@@unique）。同一キーがローカルに既存の場合は
 * decidedAt の新しい方を採用（LWW）。
 *
 * **確定を下した人（decidedByUserId）も、アーカイブに書かれたその人のままにする。**
 * 確定は「このマスの結果はこれだ」と誰かが裁定した記録で、取り込んだ人はその裁定を
 * していない。現在の利用者を書けば「この人が確定した」という嘘の記録になる。
 * 行の同一性は @@unique が持っているので、採点者は行を引く鍵ではなく属性である。
 */
export async function processScoreDecisions(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string[]> {
  const unresolvedGraderIds = new Set<string>()

  for (const scoreDecision of data.scoresData.scoreDecisions ?? []) {
    const newRegionId = idMappings.cropRegion[scoreDecision.cropRegionId]
    const newExamStudentId = idMappings.examStudent[scoreDecision.examStudentId]
    if (!newRegionId || !newExamStudentId) continue

    const incomingDecidedAt = new Date(scoreDecision.decidedAt)
    const decidedByUserId = resolveGraderUserId(
      scoreDecision.decidedByUserId,
      idMappings,
      currentUserId,
      unresolvedGraderIds
    )

    const existing = await tx.scoreDecision.findUnique({
      where: {
        cropRegionId_examStudentId: {
          cropRegionId: newRegionId,
          examStudentId: newExamStudentId,
        },
      },
    })

    if (existing) {
      // 置き換えるかどうかは取り込みの規則（上書き=無条件 / 統合=LWW）。
      // 比べるのは確定の時刻（decidedAt）で、これが確定レイヤーの「書かれた時刻」
      if (policy.shouldReplaceExisting(incomingDecidedAt, existing.decidedAt)) {
        await tx.scoreDecision.update({
          where: { id: existing.id },
          data: {
            verdict: scoreDecision.verdict,
            score: scoreDecision.score ? parseFloat(scoreDecision.score) : null,
            comment: scoreDecision.comment,
            decidedByUserId,
            decidedAt: incomingDecidedAt,
            updatedAt: policy.replacedUpdatedAt(
              new Date(scoreDecision.updatedAt)
            ),
          },
        })
        counts.updated.scores++
      } else {
        counts.skipped.scores++
      }
      idMappings.scoreDecision[scoreDecision.id] = existing.id
      continue
    }

    const existingById = await tx.scoreDecision.findUnique({
      where: { id: scoreDecision.id },
    })
    if (existingById) {
      idMappings.scoreDecision[scoreDecision.id] = scoreDecision.id
      counts.unchanged.scores++
      continue
    }

    await tx.scoreDecision.create({
      data: {
        id: scoreDecision.id,
        cropRegionId: newRegionId,
        examStudentId: newExamStudentId,
        verdict: scoreDecision.verdict,
        score: scoreDecision.score ? parseFloat(scoreDecision.score) : null,
        comment: scoreDecision.comment,
        decidedByUserId,
        decidedAt: incomingDecidedAt,
        ...policy.createdTimestamps(scoreDecision),
      },
    })
    idMappings.scoreDecision[scoreDecision.id] = scoreDecision.id
    counts.created.scores++
  }

  return unresolvedGraderWarnings(unresolvedGraderIds)
}

/**
 * CompoundAnswerScore（複合解答スコア）を処理
 *
 * 複合解答×生徒で高々1件（@@unique）。同一キーがローカルに既存の場合は
 * updatedAt の新しい方を採用（LWW）。
 *
 * **採点した人はアーカイブに書かれたその人のまま。** QuestionScore と同じ理由だが、
 * こちらは行の同一性を @@unique が持っている（マスごとに1行）ので、採点者は行を引く
 * 鍵ではなく属性である。
 */
export async function processCompoundAnswerScores(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string[]> {
  const unresolvedGraderIds = new Set<string>()

  for (const compoundAnswerScore of data.examData.compoundAnswerScores ?? []) {
    const newCompoundAnswerId =
      idMappings.compoundAnswer[compoundAnswerScore.compoundAnswerId]
    const newExamStudentId =
      idMappings.examStudent[compoundAnswerScore.examStudentId]
    if (!newCompoundAnswerId || !newExamStudentId) continue

    const graderUserId = resolveGraderUserId(
      compoundAnswerScore.userId,
      idMappings,
      currentUserId,
      unresolvedGraderIds
    )

    const existing = await tx.compoundAnswerScore.findUnique({
      where: {
        compoundAnswerId_examStudentId: {
          compoundAnswerId: newCompoundAnswerId,
          examStudentId: newExamStudentId,
        },
      },
    })

    if (existing) {
      const replacedUpdatedAt = replacementUpdatedAt(
        policy,
        compoundAnswerScore.updatedAt,
        existing.updatedAt
      )
      if (replacedUpdatedAt) {
        await tx.compoundAnswerScore.update({
          where: { id: existing.id },
          data: {
            userId: graderUserId,
            recognizedAnswer: compoundAnswerScore.recognizedAnswer,
            status: compoundAnswerScore.status,
            partialScore: compoundAnswerScore.partialScore
              ? parseFloat(compoundAnswerScore.partialScore)
              : null,
            updatedAt: replacedUpdatedAt,
          },
        })
        counts.updated.scores++
      } else {
        counts.skipped.scores++
      }
      idMappings.compoundAnswerScore[compoundAnswerScore.id] = existing.id
      continue
    }

    const existingById = await tx.compoundAnswerScore.findUnique({
      where: { id: compoundAnswerScore.id },
    })
    if (existingById) {
      idMappings.compoundAnswerScore[compoundAnswerScore.id] =
        compoundAnswerScore.id
      counts.unchanged.scores++
      continue
    }

    await tx.compoundAnswerScore.create({
      data: {
        id: compoundAnswerScore.id,
        compoundAnswerId: newCompoundAnswerId,
        examStudentId: newExamStudentId,
        userId: graderUserId,
        recognizedAnswer: compoundAnswerScore.recognizedAnswer,
        status: compoundAnswerScore.status,
        partialScore: compoundAnswerScore.partialScore
          ? parseFloat(compoundAnswerScore.partialScore)
          : null,
        ...policy.createdTimestamps(compoundAnswerScore),
      },
    })
    idMappings.compoundAnswerScore[compoundAnswerScore.id] =
      compoundAnswerScore.id
    counts.created.scores++
  }

  return unresolvedGraderWarnings(unresolvedGraderIds)
}

/**
 * ReturnSnapshot（返却版スナップショット）を処理
 *
 * 受験者ごとに高々1件（examStudentId が @unique）。同一受験者の行がローカルに既にある
 * 場合は capturedAt の新しい方を採用（LWW）。
 *
 * **記録者（capturedByUserId）は取り込む人へ倒さない。** 「いつ誰が答案を返したか」という
 * 済んだ出来事の記録で、取り込んだ人はその操作をしていない。現在の利用者を書けば
 * 「この人が返却した」という嘘の記録になる。
 *
 * capturedByUserId には Cascade の FK が張られているので、取り込み先に居ない利用者は
 * 書けない。そこで **同じ id の利用者が取り込み先に実在するときだけ引き継ぎ、それ以外は
 * null（＝記録者なし）へ倒す。** 採点者は processUserIdIntegration が先に作るので、
 * 返却したのがその試験の採点者でもある普通の場合は、記録者はそのまま残る。
 * ここで利用者を作らないのは、返却の記録が「採点行の親」ではないから ——
 * 親を失う行が無いのに、記録のためだけにアカウントを増やす理由が無い。
 */
export async function processReturnSnapshots(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string[]> {
  const archivedSnapshots = data.scoresData.returnSnapshots ?? []
  if (archivedSnapshots.length === 0) return []

  const capturedByUserIds = [
    ...new Set(
      archivedSnapshots
        .map((snapshot) => snapshot.capturedByUserId)
        .filter((capturedByUserId) => capturedByUserId !== null)
    ),
  ]
  const resolvedUsers = await tx.user.findMany({
    where: { id: { in: capturedByUserIds } },
  })
  const resolvedUserIds = new Set(resolvedUsers.map((user) => user.id))

  let unresolvedCapturerCount = 0
  let unmappedExamStudentCount = 0

  for (const snapshot of archivedSnapshots) {
    const newExamStudentId = idMappings.examStudent[snapshot.examStudentId]
    if (!newExamStudentId) {
      unmappedExamStudentCount++
      continue
    }

    let capturedByUserId: string | null = null
    if (snapshot.capturedByUserId) {
      if (resolvedUserIds.has(snapshot.capturedByUserId)) {
        capturedByUserId = snapshot.capturedByUserId
      } else {
        unresolvedCapturerCount++
      }
    }

    const incomingCapturedAt = new Date(snapshot.capturedAt)

    const existing = await tx.returnSnapshot.findUnique({
      where: { examStudentId: newExamStudentId },
    })

    if (existing) {
      // 置き換えるかどうかは取り込みの規則。比べるのは記録の時刻（capturedAt）
      if (
        policy.shouldReplaceExisting(incomingCapturedAt, existing.capturedAt)
      ) {
        await tx.returnSnapshot.update({
          where: { id: existing.id },
          data: {
            scoresJson: snapshot.scoresJson,
            totalScore: snapshot.totalScore
              ? parseFloat(snapshot.totalScore)
              : null,
            capturedByUserId,
            capturedAt: incomingCapturedAt,
            updatedAt: policy.replacedUpdatedAt(new Date(snapshot.updatedAt)),
          },
        })
        counts.updated.scores++
      } else {
        counts.skipped.scores++
      }
      continue
    }

    const existingById = await tx.returnSnapshot.findUnique({
      where: { id: snapshot.id },
    })
    if (existingById) {
      counts.unchanged.scores++
      continue
    }

    await tx.returnSnapshot.create({
      data: {
        id: snapshot.id,
        examStudentId: newExamStudentId,
        scoresJson: snapshot.scoresJson,
        totalScore: snapshot.totalScore
          ? parseFloat(snapshot.totalScore)
          : null,
        capturedByUserId,
        capturedAt: incomingCapturedAt,
        ...policy.createdTimestamps(snapshot),
      },
    })
    counts.created.scores++
  }

  const warnings: string[] = []
  if (unmappedExamStudentCount > 0) {
    warnings.push(
      `${unmappedExamStudentCount}件の返却版を取り込めませんでした（対応する受験者が取り込まれていません）。`
    )
  }
  if (unresolvedCapturerCount > 0) {
    warnings.push(
      `${unresolvedCapturerCount}件の返却版は、記録した利用者がこのデータベースに存在しないため記録者なしとして取り込みました。`
    )
  }
  return warnings
}

/**
 * CropRegionAssignment（設問ごとの採点担当）を処理
 *
 * 担当者は `username` で移行先DBを引く（ユーザーはアーカイブを越えない）。
 * 解決できない担当は取り込まない。idはアーカイブから持ち回らず取り込み先で振り直す。
 * 既に同じ割当があれば何もしない（担当は有無だけの情報でLWWの対象が無い）。
 */
export async function processCropRegionAssignments(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<string[]> {
  const archivedAssignments = data.scoresData.cropRegionAssignments ?? []
  if (archivedAssignments.length === 0) return []

  const usernames = [
    ...new Set(archivedAssignments.map((assignment) => assignment.username)),
  ]
  const resolvedUsers = await tx.user.findMany({
    where: { username: { in: usernames } },
  })
  const userIdByUsername = new Map(
    resolvedUsers.map((user) => [user.username, user.id])
  )

  const unresolvedUsernames = new Set<string>()
  for (const assignment of archivedAssignments) {
    const newRegionId = idMappings.cropRegion[assignment.cropRegionId]
    if (!newRegionId) continue

    const assigneeUserId = userIdByUsername.get(assignment.username)
    if (!assigneeUserId) {
      unresolvedUsernames.add(assignment.username)
      continue
    }

    const existing = await tx.cropRegionAssignment.findUnique({
      where: {
        cropRegionId_userId: {
          cropRegionId: newRegionId,
          userId: assigneeUserId,
        },
      },
    })
    if (existing) {
      counts.unchanged.scores++
      continue
    }

    await tx.cropRegionAssignment.create({
      data: {
        cropRegionId: newRegionId,
        userId: assigneeUserId,
        assignedBy: currentUserId,
        ...policy.createdTimestamps(assignment),
      },
    })
    counts.created.scores++
  }

  if (unresolvedUsernames.size === 0) return []
  return [
    `採点担当のうち ${unresolvedUsernames.size} 名（${[...unresolvedUsernames].join(", ")}）は` +
      `このデータベースに存在しないため割当を取り込みませんでした。担当0人の設問は全員が採点できます。`,
  ]
}
