/**
 * ID統合インポート: 採点結果レイヤーの処理
 *
 * - QuestionScore（設問スコア。事前照合済みの競合はresolveScoringConflictで解決）
 * - ScoreDecision（OWNER確定スコア。decidedAt LWWで競合解決）
 * - CompoundAnswerScore（複合解答スコア。updatedAt LWWで競合解決）
 * - CropRegionAssignment（設問ごとの採点担当。usernameで照合）
 * - ReturnSnapshot（返却版スナップショット。capturedAt LWWで競合解決）
 */

import type {
  FileOverviewData,
  ScoringConflictConfig,
} from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { isNewerByLww } from "./decisionMergePolicy"
import { resolveScoringConflict } from "./scoringConflictResolver"
import type { IdMappings, ImportCounts, PrismaTransaction } from "./types"

export async function processQuestionScores(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  scoringConflictConfig: ScoringConflictConfig | undefined,
  tx: PrismaTransaction
): Promise<void> {
  const scoringConflicts = preMatchResult.scoringConflicts?.conflicts ?? []
  const conflictMap = new Map(
    scoringConflicts.map((conflict) => [conflict.importScoreId, conflict])
  )

  for (const questionScore of data.scoresData.questionScores) {
    const newRegionId = idMappings.cropRegion[questionScore.cropRegionId]
    const newExamStudentId = questionScore.examStudentId
      ? idMappings.examStudent[questionScore.examStudentId]
      : null

    if (newRegionId && newExamStudentId) {
      const conflict = conflictMap.get(questionScore.id)

      if (conflict) {
        // データが同一なら何もしない。
        //
        // ここで見るのは採点結果（判定・部分点）だけで、覚え書き（comment）は見ない。
        // 競合は「どちらの採点結果を採るか」を利用者に問う仕組みで、その一覧に
        // 覚え書きは載っていない。覚え書きは採った側の結果に付いてくる
        // （＝取り込み側が勝ったときだけ書き換わる）。
        const isIdentical =
          conflict.importScore.status === conflict.existingScore.status &&
          conflict.importScore.partialScore ===
            conflict.existingScore.partialScore

        if (isIdentical) {
          idMappings.questionScore[questionScore.id] = conflict.existingScoreId
          counts.unchanged.scores++
          continue
        }

        const resolution = resolveScoringConflict(
          conflict,
          scoringConflictConfig
        )

        if (resolution === "existing") {
          idMappings.questionScore[questionScore.id] = conflict.existingScoreId
          counts.skipped.scores++
          continue
        }

        await tx.questionScore.update({
          where: { id: conflict.existingScoreId },
          data: {
            partialScore: questionScore.partialScore
              ? parseFloat(questionScore.partialScore)
              : null,
            status: questionScore.status,
            comment: questionScore.comment,
            userId: currentUserId,
          },
        })
        idMappings.questionScore[questionScore.id] = conflict.existingScoreId
        counts.updated.scores++
      } else {
        // B11 fix: Check for existing score with same cropRegion+student
        const existingByComposite = await tx.questionScore.findFirst({
          where: {
            cropRegionId: newRegionId,
            examStudentId: newExamStudentId,
          },
        })
        if (existingByComposite) {
          idMappings.questionScore[questionScore.id] = existingByComposite.id
          counts.unchanged.scores++
        } else {
          const existingById = await tx.questionScore.findUnique({
            where: { id: questionScore.id },
          })
          if (existingById) {
            idMappings.questionScore[questionScore.id] = questionScore.id
            counts.unchanged.scores++
          } else {
            await tx.questionScore.create({
              data: {
                id: questionScore.id,
                cropRegionId: newRegionId,
                examStudentId: newExamStudentId,
                partialScore: questionScore.partialScore
                  ? parseFloat(questionScore.partialScore)
                  : null,
                status: questionScore.status,
                comment: questionScore.comment,
                userId: currentUserId,
              },
            })
            idMappings.questionScore[questionScore.id] = questionScore.id
            counts.created.scores++
          }
        }
      }
    }
  }
}

/**
 * ScoreDecision（OWNER確定スコア）を処理
 *
 * 設問×生徒で高々1件（@@unique）。同一キーがローカルに既存の場合は
 * decidedAt の新しい方を採用（LWW）。userIdは現在のユーザーで上書き。
 */
export async function processScoreDecisions(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  for (const scoreDecision of data.scoresData.scoreDecisions ?? []) {
    const newRegionId = idMappings.cropRegion[scoreDecision.cropRegionId]
    const newExamStudentId = idMappings.examStudent[scoreDecision.examStudentId]
    if (!newRegionId || !newExamStudentId) continue

    const incomingDecidedAt = new Date(scoreDecision.decidedAt)

    const existing = await tx.scoreDecision.findUnique({
      where: {
        cropRegionId_examStudentId: {
          cropRegionId: newRegionId,
          examStudentId: newExamStudentId,
        },
      },
    })

    if (existing) {
      // 確定レイヤーの競合解決はLWW（decisionMergePolicy参照）
      if (isNewerByLww(incomingDecidedAt, existing.decidedAt)) {
        await tx.scoreDecision.update({
          where: { id: existing.id },
          data: {
            verdict: scoreDecision.verdict,
            score: scoreDecision.score ? parseFloat(scoreDecision.score) : null,
            comment: scoreDecision.comment,
            decidedByUserId: currentUserId,
            decidedAt: incomingDecidedAt,
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
        decidedByUserId: currentUserId,
        decidedAt: incomingDecidedAt,
      },
    })
    idMappings.scoreDecision[scoreDecision.id] = scoreDecision.id
    counts.created.scores++
  }
}

/**
 * CompoundAnswerScore（複合解答スコア）を処理
 *
 * 複合解答×生徒で高々1件（@@unique）。同一キーがローカルに既存の場合は
 * updatedAt の新しい方を採用（LWW）。userIdは現在のユーザーで上書き。
 */
export async function processCompoundAnswerScores(
  data: ExtractedArchiveData,
  currentUserId: string,
  idMappings: IdMappings,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  for (const compoundAnswerScore of data.examData.compoundAnswerScores ?? []) {
    const newCompoundAnswerId =
      idMappings.compoundAnswer[compoundAnswerScore.compoundAnswerId]
    const newExamStudentId =
      idMappings.examStudent[compoundAnswerScore.examStudentId]
    if (!newCompoundAnswerId || !newExamStudentId) continue

    const incomingUpdatedAt = new Date(compoundAnswerScore.updatedAt)

    const existing = await tx.compoundAnswerScore.findUnique({
      where: {
        compoundAnswerId_examStudentId: {
          compoundAnswerId: newCompoundAnswerId,
          examStudentId: newExamStudentId,
        },
      },
    })

    if (existing) {
      // 確定レイヤーの競合解決はLWW（decisionMergePolicy参照）
      if (isNewerByLww(incomingUpdatedAt, existing.updatedAt)) {
        await tx.compoundAnswerScore.update({
          where: { id: existing.id },
          data: {
            userId: currentUserId,
            recognizedAnswer: compoundAnswerScore.recognizedAnswer,
            status: compoundAnswerScore.status,
            partialScore: compoundAnswerScore.partialScore
              ? parseFloat(compoundAnswerScore.partialScore)
              : null,
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
        userId: currentUserId,
        recognizedAnswer: compoundAnswerScore.recognizedAnswer,
        status: compoundAnswerScore.status,
        partialScore: compoundAnswerScore.partialScore
          ? parseFloat(compoundAnswerScore.partialScore)
          : null,
      },
    })
    idMappings.compoundAnswerScore[compoundAnswerScore.id] =
      compoundAnswerScore.id
    counts.created.scores++
  }
}

/**
 * ReturnSnapshot（返却版スナップショット）を処理
 *
 * 受験者ごとに高々1件（examStudentId が @unique）。同一受験者の行がローカルに既にある
 * 場合は capturedAt の新しい方を採用（LWW）。
 *
 * **記録者（capturedByUserId）は取り込む人へ倒さない。** QuestionScore.userId は
 * 「誰の採点か」という持ち主で、取り込んだ人がその採点を自分のものとして引き受けるので
 * 現在の利用者へ倒す。返却版の記録者はそうではなく「いつ誰が答案を返したか」という
 * 済んだ出来事の記録で、取り込んだ人はその操作をしていない。現在の利用者を書けば
 * 「この人が返却した」という嘘の記録になる。
 * ユーザーはアーカイブを越えないので、書かれている id は取り込み先では宙に浮くのが普通で、
 * capturedByUserId には Cascade の FK が張られている。そこで **同じ id の利用者が
 * 取り込み先に実在するときだけ引き継ぎ、それ以外は null（＝記録者なし）へ倒す。**
 */
export async function processReturnSnapshots(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  counts: ImportCounts,
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
      // 返却版も確定レイヤーと同じくLWW（decisionMergePolicy参照）
      if (isNewerByLww(incomingCapturedAt, existing.capturedAt)) {
        await tx.returnSnapshot.update({
          where: { id: existing.id },
          data: {
            scoresJson: snapshot.scoresJson,
            totalScore: snapshot.totalScore
              ? parseFloat(snapshot.totalScore)
              : null,
            capturedByUserId,
            capturedAt: incomingCapturedAt,
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
        createdAt: new Date(assignment.createdAt),
        updatedAt: new Date(assignment.updatedAt),
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
