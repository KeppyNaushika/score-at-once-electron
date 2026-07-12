/**
 * ID統合インポート: 採点結果レイヤーの処理
 *
 * - QuestionScore（設問スコア。事前照合済みの競合はresolveScoringConflictで解決）
 * - ScoreDecision（OWNER確定スコア。decidedAt LWWで競合解決）
 * - CompoundAnswerScore（複合解答スコア。updatedAt LWWで競合解決）
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
    const newStudentId = questionScore.studentId
      ? idMappings.student[questionScore.studentId]
      : null

    if (newRegionId && newStudentId) {
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
            studentId: newStudentId,
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
                studentId: newStudentId,
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
    const newStudentId = idMappings.student[scoreDecision.studentId]
    if (!newRegionId || !newStudentId) continue

    const newSourceQsId = scoreDecision.sourceQuestionScoreId
      ? (idMappings.questionScore[scoreDecision.sourceQuestionScoreId] ?? null)
      : null
    const incomingDecidedAt = new Date(scoreDecision.decidedAt)

    const existing = await tx.scoreDecision.findUnique({
      where: {
        cropRegionId_studentId: {
          cropRegionId: newRegionId,
          studentId: newStudentId,
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
        studentId: newStudentId,
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
    const newStudentId = idMappings.student[compoundAnswerScore.studentId]
    if (!newCompoundAnswerId || !newStudentId) continue

    const incomingUpdatedAt = new Date(compoundAnswerScore.updatedAt)

    const existing = await tx.compoundAnswerScore.findUnique({
      where: {
        compoundAnswerId_studentId: {
          compoundAnswerId: newCompoundAnswerId,
          studentId: newStudentId,
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
        studentId: newStudentId,
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
