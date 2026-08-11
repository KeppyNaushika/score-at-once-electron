/**
 * 試験全体の裁定サマリ。
 *
 * `resolveEffectiveScores` が有効スコアを解決できなかったセル（競合）と、
 * 確定後に新しい提案が入ったセル（stale）だけを裁定対象として集める。
 * 出力の解決ルール自体には一切手を入れない — ここは表示のための派生計算に徹する。
 */
import type {
  AssignedGrader,
  ExamDecisionSummary,
  ScoreDecisionCell,
  ScoreDecisionQuestion,
  ScoreProposal,
} from "@/types/scoreDecision.types"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { calculateActualScore } from "../shared/calculations/actualScore"
import { resolveEffectiveScores } from "../shared/calculations/scoreResolution"
import prisma from "./client"
import { canDecideExamScores } from "./scoreDecision"

const cellKey = (examStudentId: string, cropRegionId: string): string =>
  `${examStudentId} ${cropRegionId}`

export const getExamDecisionSummary = async (
  examId: string,
  userId: string
): Promise<ExamDecisionSummary> => {
  const [
    questionRegions,
    scores,
    decisions,
    examStudents,
    permission,
    assignments,
    members,
    studentsWithAnswers,
  ] = await Promise.all([
    prisma.cropRegion.findMany({
      where: { examPage: { examId }, type: "QUESTION_ANSWER" },
      orderBy: { orderIndex: "asc" },
    }),
    // 採点行は試験全体で数万行になりうる。行はそのまま持ち（射影しない）、
    // 氏名だけは裁定対象セル（通常わずか）が確定してから別途引いて join を広げない。
    prisma.questionScore.findMany({
      where: {
        cropRegion: { examPage: { examId }, type: "QUESTION_ANSWER" },
      },
    }),
    prisma.scoreDecision.findMany({
      where: {
        cropRegion: { examPage: { examId }, type: "QUESTION_ANSWER" },
      },
      include: { decidedBy: { omit: { passcode: true } } },
    }),
    prisma.examStudent.findMany({
      where: { examId },
    }),
    canDecideExamScores(examId, userId),
    // 担当は「現在この試験のメンバーである人」に限る。非メンバーを担当として
    // 数えると、担当が居るのに誰も採点できない設問が生まれる
    // （メンバー削除・アーカイブインポートで割当行だけ残るため）。
    prisma.cropRegionAssignment.findMany({
      where: {
        cropRegion: { examPage: { examId }, type: "QUESTION_ANSWER" },
        user: { userExams: { some: { examId } } },
      },
      include: { user: { omit: { passcode: true } } },
    }),
    prisma.userExam.findMany({
      where: { examId },
      include: { user: { omit: { passcode: true } } },
    }),
    // 設問の分母は「答案画像がある受験者数」（getExamProgress と同じ数え方）
    prisma.studentAnswerImage.findMany({
      where: { examPage: { examId } },
      distinct: ["examStudentId"],
    }),
  ])

  const { resolved, conflicts } = resolveEffectiveScores(scores, decisions)

  // 裁定対象セル: 解決できなかった競合と、確定後に新しい提案が入ったもの
  const targets: Array<{
    examStudentId: string
    cropRegionId: string
    reason: "conflict" | "stale"
  }> = [
    ...conflicts.map((conflict) => ({
      examStudentId: conflict.examStudentId,
      cropRegionId: conflict.cropRegionId,
      reason: "conflict" as const,
    })),
    ...resolved
      .filter(
        (effective) => effective.source === "decision" && effective.isStale
      )
      .map((effective) => ({
        examStudentId: effective.examStudentId,
        cropRegionId: effective.cropRegionId,
        reason: "stale" as const,
      })),
  ]

  const regionById = new Map(
    questionRegions.map((cropRegion) => [cropRegion.id, cropRegion])
  )
  const decisionByCell = new Map(
    decisions.map((decision) => [
      cellKey(decision.examStudentId, decision.cropRegionId),
      decision,
    ])
  )
  const customOrderByExamStudent = new Map(
    examStudents.map((examStudent) => [
      examStudent.id,
      examStudent.customOrder ?? Number.MAX_SAFE_INTEGER,
    ])
  )

  // セルごとの提案（unscored は採点の意思表示ではないので除く）と、
  // 設問ごとの進捗（担当者別／全体）を1周で集める。
  const proposalsByCell = new Map<string, typeof scores>()
  const gradedUserIds = new Set<string>()
  /** 設問id → 担当者id → 採点済みセル数 */
  const scoredByRegionAndUser = new Map<string, Map<string, number>>()
  /** 設問id → 誰か1人でも採点したセルのキー集合 */
  const scoredCellsByRegion = new Map<string, Set<string>>()

  for (const score of scores) {
    if (score.status === "unscored") continue
    gradedUserIds.add(score.userId)

    const key = cellKey(score.examStudentId, score.cropRegionId)
    const group = proposalsByCell.get(key)
    if (group) {
      group.push(score)
    } else {
      proposalsByCell.set(key, [score])
    }

    const byUser =
      scoredByRegionAndUser.get(score.cropRegionId) ?? new Map<string, number>()
    byUser.set(score.userId, (byUser.get(score.userId) ?? 0) + 1)
    scoredByRegionAndUser.set(score.cropRegionId, byUser)

    const scoredCells =
      scoredCellsByRegion.get(score.cropRegionId) ?? new Set<string>()
    scoredCells.add(key)
    scoredCellsByRegion.set(score.cropRegionId, scoredCells)
  }

  // 設問ごとの担当者。0人の設問は「全員担当」なので空配列のままにする
  const assigneesByRegion = assignments.reduce((acc, assignment) => {
    const scoredCount =
      scoredByRegionAndUser
        .get(assignment.cropRegionId)
        ?.get(assignment.userId) ?? 0
    const list = acc.get(assignment.cropRegionId) ?? []
    list.push({
      userId: assignment.userId,
      userName: assignment.user.name,
      scoredCount,
    })
    acc.set(assignment.cropRegionId, list)
    return acc
  }, new Map<string, AssignedGrader[]>())

  // 氏名は裁定対象セルの分だけ引く（全採点行に join を効かせない）
  const targetExamStudentIds = [
    ...new Set(targets.map((target) => target.examStudentId)),
  ]
  const [targetExamStudents, users] = await Promise.all([
    prisma.examStudent.findMany({
      where: { id: { in: targetExamStudentIds } },
      include: { student: true },
    }),
    targetExamStudentIds.length > 0
      ? prisma.user.findMany({ omit: { passcode: true } })
      : Promise.resolve([]),
  ])
  const studentByExamStudentId = new Map(
    targetExamStudents.map((examStudent) => [
      examStudent.id,
      examStudent.student,
    ])
  )
  const userNameById = new Map(users.map((user) => [user.id, user.name]))

  const toProposal = (
    score: (typeof scores)[number],
    maxScore: number
  ): ScoreProposal => {
    const partialScore =
      score.partialScore !== null ? Number(score.partialScore) : null
    return {
      questionScoreId: score.id,
      userId: score.userId,
      userName: userNameById.get(score.userId) ?? score.userId,
      status: toScoringStatus(score.status),
      partialScore,
      scoreValue: calculateActualScore(
        { status: score.status, partialScore },
        maxScore
      ),
      updatedAt: score.updatedAt.toISOString(),
    }
  }

  const cellsByRegion = new Map<string, ScoreDecisionCell[]>()
  let totalScoreImpact = 0

  for (const target of targets) {
    const key = cellKey(target.examStudentId, target.cropRegionId)
    const group = proposalsByCell.get(key)
    if (!group || group.length === 0) continue

    const cropRegion = regionById.get(target.cropRegionId)
    if (!cropRegion) continue

    const maxScore = cropRegion.points ?? 0
    const proposals = group
      .map((score) => toProposal(score, maxScore))
      .sort((proposalA, proposalB) =>
        proposalA.userName.localeCompare(proposalB.userName, "ja")
      )

    // 未解決のまま出力すると合計点から最大でこの値が失われる
    const scoreImpact =
      target.reason === "conflict"
        ? Math.max(0, ...proposals.map((proposal) => proposal.scoreValue ?? 0))
        : 0
    totalScoreImpact += scoreImpact

    const decision = decisionByCell.get(key)
    const student = studentByExamStudentId.get(target.examStudentId)

    const cell: ScoreDecisionCell = {
      examStudentId: target.examStudentId,
      studentName: student
        ? `${student.lastName} ${student.firstName}`
        : target.examStudentId,
      cropRegionId: target.cropRegionId,
      reason: target.reason,
      proposals,
      decision: decision
        ? {
            verdict: toScoringStatus(decision.verdict),
            score: decision.score !== null ? Number(decision.score) : null,
            comment: decision.comment,
            decidedByName: decision.decidedBy.name,
            decidedAt: decision.decidedAt.toISOString(),
            sourceQuestionScoreId: decision.sourceQuestionScoreId,
          }
        : null,
      scoreImpact,
    }

    const cells = cellsByRegion.get(target.cropRegionId)
    if (cells) {
      cells.push(cell)
    } else {
      cellsByRegion.set(target.cropRegionId, [cell])
    }
  }

  const decidedCountByRegion = decisions.reduce((acc, decision) => {
    acc.set(decision.cropRegionId, (acc.get(decision.cropRegionId) ?? 0) + 1)
    return acc
  }, new Map<string, number>())

  // 裁定対象が無い設問も担当・進捗のために残す（割当UIの行になる）
  const questions: ScoreDecisionQuestion[] = questionRegions.map(
    (cropRegion, index) => ({
      cropRegionId: cropRegion.id,
      questionLabel: cropRegion.label,
      maxScore: cropRegion.points ?? 0,
      orderIndex: cropRegion.orderIndex ?? index,
      assignees: (assigneesByRegion.get(cropRegion.id) ?? []).sort(
        (graderA, graderB) =>
          graderA.userName.localeCompare(graderB.userName, "ja")
      ),
      totalStudents: studentsWithAnswers.length,
      scoredCount: scoredCellsByRegion.get(cropRegion.id)?.size ?? 0,
      cells: (cellsByRegion.get(cropRegion.id) ?? []).sort(
        (cellA, cellB) =>
          (customOrderByExamStudent.get(cellA.examStudentId) ??
            Number.MAX_SAFE_INTEGER) -
          (customOrderByExamStudent.get(cellB.examStudentId) ??
            Number.MAX_SAFE_INTEGER)
      ),
      decidedCount: decidedCountByRegion.get(cropRegion.id) ?? 0,
    })
  )

  return {
    graderCount: gradedUserIds.size,
    conflictCount: targets.filter((target) => target.reason === "conflict")
      .length,
    staleCount: targets.filter((target) => target.reason === "stale").length,
    decidedCount: decisions.length,
    totalScoreImpact,
    questions,
    members: members.map((member) => ({
      userId: member.userId,
      userName: member.user.name,
      role: member.role,
    })),
    canDecide: permission.allowed,
  }
}
