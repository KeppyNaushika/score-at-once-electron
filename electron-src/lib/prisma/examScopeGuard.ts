/**
 * 採点行の親と受験者が同じ試験に属することの検査
 *
 * 採点層（QuestionScore / ScoreDecision / CompoundAnswerScore / StudentAnswerImage）は
 * 「採点対象（採点領域・複合回答・ページ）」と「受験者（ExamStudent）」の2つを参照する。
 * FK が保証するのは**それぞれが実在すること**だけで、両者が同じ Exam に属することは
 * 強制されない。食い違ったまま書けると、試験 A の設問に試験 B の受験者の採点が
 * ぶら下がり、A の受験者一覧に居ない生徒の得点が成績算出に算入される
 * — #962 で塞いだのと同じ穴が別の入口から開く。
 *
 * どちらの id も string なので取り違えてもコンパイルは通る。書き込みの入口で
 * 実際に試験を突き合わせて弾く。
 *
 * 注: これはアプリのコードが書く経路の守りであって、NAS 同期がライブラリから
 * 直接書く行には効かない（同期は行単位で運ぶため、食い違ったペアを新たに作ることは
 * 無いが、参照先が消えた行は残りうる）。
 */

import prisma from "./client"
import type { Tx } from "./transactionClient"

type PrismaLike = typeof prisma | Tx

/** 検査に失敗したときのエラー。呼び出し側は success:false へ倒す */
export class ExamScopeMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExamScopeMismatchError"
  }
}

/** 受験者 id → その試験の id */
async function resolveExamIdByExamStudent(
  client: PrismaLike,
  examStudentIds: string[]
): Promise<Map<string, string>> {
  const rows = await client.examStudent.findMany({
    where: { id: { in: examStudentIds } },
    select: { id: true, examId: true },
  })
  return new Map(
    rows.map((examStudent) => [examStudent.id, examStudent.examId])
  )
}

/**
 * 「採点対象 id → 試験 id」と「受験者 id → 試験 id」を突き合わせる共通処理。
 * 解決できない id があればその時点でエラーにする（存在しない親を指す行を作らせない）。
 */
function assertPairs(
  pairs: { targetId: string; examStudentId: string }[],
  examIdByTarget: Map<string, string>,
  examIdByExamStudent: Map<string, string>,
  targetLabel: string
): void {
  for (const pair of pairs) {
    const targetExamId = examIdByTarget.get(pair.targetId)
    const examStudentExamId = examIdByExamStudent.get(pair.examStudentId)
    if (!targetExamId || !examStudentExamId) {
      throw new ExamScopeMismatchError(
        `${targetLabel}または受験者が見つかりません`
      )
    }
    if (targetExamId !== examStudentExamId) {
      throw new ExamScopeMismatchError(
        `${targetLabel}と受験者が別の試験に属しています`
      )
    }
  }
}

/** 採点領域（CropRegion）と受験者が同じ試験のものか検査する */
export async function assertCropRegionsInSameExam(
  pairs: { cropRegionId: string; examStudentId: string }[],
  client: PrismaLike = prisma
): Promise<void> {
  if (pairs.length === 0) return
  const [cropRegions, examIdByExamStudent] = await Promise.all([
    client.cropRegion.findMany({
      where: {
        id: { in: [...new Set(pairs.map((pair) => pair.cropRegionId))] },
      },
      select: { id: true, examPage: { select: { examId: true } } },
    }),
    resolveExamIdByExamStudent(client, [
      ...new Set(pairs.map((pair) => pair.examStudentId)),
    ]),
  ])
  assertPairs(
    pairs.map((pair) => ({
      targetId: pair.cropRegionId,
      examStudentId: pair.examStudentId,
    })),
    new Map(
      cropRegions.map((cropRegion) => [
        cropRegion.id,
        cropRegion.examPage.examId,
      ])
    ),
    examIdByExamStudent,
    "採点領域"
  )
}

/** 複合回答（CompoundAnswer）と受験者が同じ試験のものか検査する */
export async function assertCompoundAnswersInSameExam(
  pairs: { compoundAnswerId: string; examStudentId: string }[],
  client: PrismaLike = prisma
): Promise<void> {
  if (pairs.length === 0) return
  const [compoundAnswers, examIdByExamStudent] = await Promise.all([
    client.compoundAnswer.findMany({
      where: {
        id: { in: [...new Set(pairs.map((pair) => pair.compoundAnswerId))] },
      },
      select: { id: true, examPage: { select: { examId: true } } },
    }),
    resolveExamIdByExamStudent(client, [
      ...new Set(pairs.map((pair) => pair.examStudentId)),
    ]),
  ])
  assertPairs(
    pairs.map((pair) => ({
      targetId: pair.compoundAnswerId,
      examStudentId: pair.examStudentId,
    })),
    new Map(
      compoundAnswers.map((compoundAnswer) => [
        compoundAnswer.id,
        compoundAnswer.examPage.examId,
      ])
    ),
    examIdByExamStudent,
    "複合回答"
  )
}

/** 答案ページ（ExamPage）と受験者が同じ試験のものか検査する */
export async function assertExamPagesInSameExam(
  pairs: { examPageId: string; examStudentId: string }[],
  client: PrismaLike = prisma
): Promise<void> {
  if (pairs.length === 0) return
  const [examPages, examIdByExamStudent] = await Promise.all([
    client.examPage.findMany({
      where: { id: { in: [...new Set(pairs.map((pair) => pair.examPageId))] } },
      select: { id: true, examId: true },
    }),
    resolveExamIdByExamStudent(client, [
      ...new Set(pairs.map((pair) => pair.examStudentId)),
    ]),
  ])
  assertPairs(
    pairs.map((pair) => ({
      targetId: pair.examPageId,
      examStudentId: pair.examStudentId,
    })),
    new Map(examPages.map((examPage) => [examPage.id, examPage.examId])),
    examIdByExamStudent,
    "答案ページ"
  )
}
