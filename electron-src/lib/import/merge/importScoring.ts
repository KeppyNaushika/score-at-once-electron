/**
 * ID統合インポート: 採点結果レイヤーの処理
 *
 * - QuestionScore（設問スコア。事前照合済みの競合はresolveScoringConflictで解決）
 * - ScoreDecision（OWNER確定スコア。decidedAt LWWで競合解決）
 * - CompoundAnswerScore（複合解答スコア。updatedAt LWWで競合解決）
 * - CropRegionAssignment（設問ごとの採点担当。usernameで照合）
 */

import type {
  FileOverviewData,
  ScoringConflictConfig,
} from "../../../../src/types/examArchive.types"
import { buildAssignmentId } from "../../prisma/cropRegionAssignment"
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
        // データが同一なら何もしない
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

    const newSourceQsId = scoreDecision.sourceQuestionScoreId
      ? (idMappings.questionScore[scoreDecision.sourceQuestionScoreId] ?? null)
      : null
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
            sourceQuestionScoreId: newSourceQsId,
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
        sourceQuestionScoreId: newSourceQsId,
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
 * CropRegionAssignment（設問ごとの採点担当）を処理
 *
 * 担当者は `username` で移行先DBを引く（ユーザーはアーカイブを越えない）。
 * 解決できない担当は取り込まない。idは (cropRegionId, userId) から決定論的に
 * 再生成するので、両端で同じペアを割り当てていれば1行に収束する。
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
        id: buildAssignmentId(newRegionId, assigneeUserId),
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
