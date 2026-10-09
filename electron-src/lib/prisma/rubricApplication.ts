/**
 * ルーブリックの適用（RubricApplication）の読み書きと、点を計算し直す材料の取得
 * （docs/vlm-grading-design.md §4-3・§4-6）。
 *
 * 適用は「この答案にこの項目が当たっている」を採点者ごとに持つ（QuestionScore × 項目）。
 * 当てる・外すのは操作者自身の採点行だけ。行が無いマスに当てるときは、その場で採点行
 * （unscored）を用意する — 当てるのは利用者の採点の操作なので、表示しただけで行を作る
 * 経路とは違う（`ensureQuestionScore` の注意書き）。
 *
 * **点はここで計算しない。** 当てたあとの点は renderer が計算して `writeRubricScores`
 * （rubricScoreWrite.ts）で書く。
 */

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import { cropRegionAuditTarget } from "./auditTargets"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"
import { PUBLIC_USER_OMIT } from "./publicUser"
import { toSerializedQuestionScore } from "./questionScore"

/**
 * 設問の適用を全部（採点者を問わない）。誰の適用かは親の採点行で決まるので、画面は
 * 採点行（`get-question-scores-by-crop-region-id`）と突き合わせて絞る
 */
export async function listRubricApplicationsByCropRegion(cropRegionId: string) {
  return prisma.rubricApplication.findMany({
    where: { questionScore: { cropRegionId } },
    orderBy: { id: "asc" },
  })
}

/** 適用の付け外しの引数。項目1つを、選んだ答案（受験者）にまとめて当てる・外す */
export interface SetRubricApplicationsInput {
  cropRegionId: string
  rubricItemId: string
  examStudentIds: string[]
  /** true で当てる、false で外す */
  applied: boolean
}

/**
 * 操作者の採点行に、項目をまとめて当てる・外す。
 *
 * 付け外ししたマスは手での上書き（`overridesRubric`）を外す（§4-5）。同じ項目が既に当たって
 * いるマスには足さず、外すときは重なった行（同期で2つできたもの）もまとめて消す。
 *
 * 付け外ししたマスの採点行を、適用を同梱して返す。renderer はこれで点を計算して書く。
 */
export async function setRubricApplications(
  input: SetRubricApplicationsInput,
  actorUserId: string
) {
  const examStudentIds = [...new Set(input.examStudentIds)]
  const rubricItem = await prisma.rubricItem.findUnique({
    where: { id: input.rubricItemId },
    include: { cropRegion: true },
  })
  if (!rubricItem || rubricItem.cropRegionId !== input.cropRegionId) {
    throw new Error("ルーブリック項目が、この設問のものではありません")
  }
  await assertCropRegionsInSameExam(
    examStudentIds.map((examStudentId) => ({
      cropRegionId: input.cropRegionId,
      examStudentId,
    }))
  )

  const touchedQuestionScoreIds = await prisma.$transaction(async (tx) => {
    const questionScoreIds: string[] = []
    for (const examStudentId of examStudentIds) {
      const existing = await tx.questionScore.findFirst({
        where: {
          examStudentId,
          cropRegionId: input.cropRegionId,
          userId: actorUserId,
        },
        include: { rubricApplications: true },
      })
      // 外すときに行が無ければ、外すものも無い
      if (!existing && !input.applied) continue

      const questionScore =
        existing ??
        (await tx.questionScore.create({
          data: {
            examStudentId,
            cropRegionId: input.cropRegionId,
            userId: actorUserId,
            status: "unscored",
            partialScore: null,
          },
          include: { rubricApplications: true },
        }))
      const alreadyApplied = questionScore.rubricApplications.some(
        (application) => application.rubricItemId === input.rubricItemId
      )

      if (input.applied && !alreadyApplied) {
        await tx.rubricApplication.create({
          data: {
            questionScoreId: questionScore.id,
            rubricItemId: input.rubricItemId,
          },
        })
      }
      if (!input.applied && alreadyApplied) {
        await tx.rubricApplication.deleteMany({
          where: {
            questionScoreId: questionScore.id,
            rubricItemId: input.rubricItemId,
          },
        })
      }
      if (questionScore.overridesRubric) {
        await tx.questionScore.update({
          where: { id: questionScore.id },
          data: { overridesRubric: false },
        })
      }
      questionScoreIds.push(questionScore.id)
    }
    return questionScoreIds
  })

  if (touchedQuestionScoreIds.length > 0) {
    const scope = await resolveExamScopeByCropRegion(input.cropRegionId)
    const verb = input.applied ? "当てました" : "外しました"
    await recordAuditLog({
      action: input.applied ? "exam.rubric.apply" : "exam.rubric.unapply",
      userId: actorUserId,
      entityType: "RubricItem",
      entityId: input.rubricItemId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: rubricItem.label || null,
      summary: `ルーブリック項目「${rubricItem.label}」を${touchedQuestionScoreIds.length}件の答案に${verb}`,
      extra: { count: touchedQuestionScoreIds.length },
      targets: [cropRegionAuditTarget(rubricItem.cropRegion)],
    })
  }

  const touched = await prisma.questionScore.findMany({
    where: { id: { in: touchedQuestionScoreIds } },
    include: { rubricApplications: true },
    orderBy: { id: "asc" },
  })
  return touched.map(toSerializedQuestionScore)
}

/**
 * 点を計算し直す材料（§4-6）。設問（採点方式・配点）と、その項目の全部と、
 * **適用が1つ以上ある採点行の全部（どの採点者のものも）**を、適用と採点者を同梱して返す。
 *
 * 項目の値・採点方式・配点を変えたとき、どの行の点が変わるかは renderer が洗い出す
 * （`planRubricRecalculation`）。保存の前に「他の採点者 N名・M件」と示すのにも使う。
 * 設問が無ければ null
 */
export async function getRubricRecalculationSource(cropRegionId: string) {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    include: {
      rubricItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
      questionScores: {
        where: { rubricApplications: { some: {} } },
        include: {
          rubricApplications: true,
          user: { omit: PUBLIC_USER_OMIT },
        },
        orderBy: { id: "asc" },
      },
    },
  })
  if (!cropRegion) return null
  return {
    ...cropRegion,
    questionScores: cropRegion.questionScores.map(toSerializedQuestionScore),
  }
}
