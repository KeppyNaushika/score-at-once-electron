/**
 * 2段目の項目の案（AiRubricProposal と選択肢・答案）と、問いかけへの教員の答え
 * （AiRubricProposalResponse）の読み書き（docs/vlm-grading-design.md §3-4・§3-5・§5-3）。
 *
 * AI の層は追記だけ。案は書き換えず、答え直しは新しい答えの行（最新が効く）。
 *
 * **教員の層へ書くのは、答えを反映するとき（`answerAiRubricProposal`）だけ。** 選んだ
 * 選択肢からルーブリック項目を作り（既存の項目に当たる案なら作らない）、案の答案の
 * 操作者自身の採点行に当てる。点の計算と朱書きの合わせは renderer が、返した採点行から行う。
 */

import { Prisma } from "@prisma/client"

import type { ValidatedStage2Proposal } from "@/lib/shared/aiGrading/stage2ResponseValidator"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import { cropRegionAuditTarget } from "./auditTargets"
import prisma from "./client"
import { setRubricApplications } from "./rubricApplication"
import { createRubricItem, updateRubricItem } from "./rubricItem"

/**
 * 2段目が返した案を書く。答案の番号（A1, A2, …）は `attemptIdByAnswerKey` で試行の id へ戻す。
 * 案は返ってきた順に `sortOrder` を振る
 */
export async function recordAiRubricProposals(
  runId: string,
  proposals: readonly ValidatedStage2Proposal[],
  attemptIdByAnswerKey: ReadonlyMap<string, string>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const [proposalIndex, proposal] of proposals.entries()) {
      await tx.aiRubricProposal.create({
        data: {
          runId,
          label: proposal.label,
          description: proposal.description,
          adviceDraft: proposal.adviceDraft,
          matchedRubricItemId: proposal.matchedRubricItemId,
          sortOrder: proposalIndex,
          options: {
            create: proposal.options.map((option, optionIndex) => ({
              effectKind: option.effectKind,
              pointDelta:
                option.pointDelta === null
                  ? null
                  : new Prisma.Decimal(option.pointDelta),
              setStatus: option.setStatus,
              setScore:
                option.setScore === null
                  ? null
                  : new Prisma.Decimal(option.setScore),
              rationale: option.rationale,
              recommended: option.recommended,
              sortOrder: optionIndex,
            })),
          },
          members: {
            create: proposal.memberAnswerKeys.flatMap((answerKey) => {
              const attemptId = attemptIdByAnswerKey.get(answerKey)
              return attemptId ? [{ attemptId }] : []
            }),
          },
        },
      })
    }
  })
}

/**
 * 案が既存の項目に当たると返したとき、その項目がまだあるか。2段目は送った時点の項目と
 * 照らすので、書く前に消された項目は結び付けずに新しい特徴として扱う
 */
async function listLivingRubricItemIds(
  rubricItemIds: readonly string[]
): Promise<Set<string>> {
  if (rubricItemIds.length === 0) return new Set()
  const living = await prisma.rubricItem.findMany({
    where: { id: { in: [...rubricItemIds] } },
  })
  return new Set(living.map((rubricItem) => rubricItem.id))
}

/**
 * 教員が問いかけの「その他」に書いた指示のうち、今も効いているもの（案ごとの最新の答えが
 * 「その他」のもの）を、答えた順に。次の往復の1段目・2段目に「教員の指示」として添える。
 *
 * 問いかけは run を実行した教員にだけ出すので、その教員の2段目の実行の案から引く。
 * 同じ文は1つにまとめる
 */
export async function listTeacherInstructions(
  cropRegionId: string,
  userId: string
): Promise<string[]> {
  const proposals = await prisma.aiRubricProposal.findMany({
    where: { run: { userId, purpose: "group", prompt: { cropRegionId } } },
    include: {
      responses: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  })
  const latestResponses = proposals.flatMap((proposal) => {
    const latest = proposal.responses.at(-1)
    return latest ? [latest] : []
  })
  const instructions = latestResponses
    .filter(
      (response) =>
        response.optionId === null && response.freeText.trim() !== ""
    )
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id)
    )
    .map((response) => response.freeText.trim())
  return [...new Set(instructions)]
}

/**
 * 設問の、その教員の2段目の実行を古い順に、案（選択肢・答案・答えの木）付きで。
 * 答案は試行（判定・確信度・受験者）を同梱する。氏名は画面が受験者から引く
 */
export async function listAiRubricProposalRunsByCropRegion(
  cropRegionId: string,
  userId: string
) {
  return prisma.aiGradingRun.findMany({
    where: { userId, purpose: "group", prompt: { cropRegionId } },
    include: {
      rubricProposals: {
        include: {
          options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          members: { include: { attempt: true }, orderBy: { id: "asc" } },
          responses: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
}

/** 問いかけへの答えの引数 */
export interface AnswerAiRubricProposalInput {
  proposalId: string
  /** 選んだ選択肢。「その他」なら null */
  optionId: string | null
  /** 「その他」に書いた指示（選択肢を選んだときは ""） */
  freeText: string
  /**
   * 項目を当てる答案（受験者）。案の答案のうち、renderer が選んだもの
   * （採点キーで付けた点・手での上書きのある答案は外す）。「その他」では外す答案
   */
  examStudentIds: string[]
  /** 新しく作る項目の判断理由（省けば案の名前） */
  label?: string
  /** 新しく作る項目の助言（省けば案の助言の文案。教員が直せる） */
  adviceText?: string
}

/** 答える案の木（実行・設問・選択肢・答案・答え） */
async function findProposalForAnswer(proposalId: string) {
  const proposal = await prisma.aiRubricProposal.findUnique({
    where: { id: proposalId },
    include: {
      run: { include: { prompt: { include: { cropRegion: true } } } },
      options: true,
      members: { include: { attempt: true } },
      responses: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  })
  if (!proposal) throw new Error("項目の案が見つかりません")
  return proposal
}

/**
 * 問いかけに答える（§3-5）。
 *
 * - 選択肢を選んだとき: 項目を決め（既存の項目に当たる案はその項目。前の答えで作った項目が
 *   あれば、その項目の効き方を選んだ選択肢に変える。どちらも無ければ新しく作る）、答えを
 *   記録してから、渡した答案の操作者自身の採点行に当てる
 * - 「その他」のとき: 指示を記録する。前の答えで当てた項目があれば、渡した答案から外す
 *   （その案の答案は未採点に戻り、次の往復に回る）
 *
 * 答えられるのは、その案を出した実行の教員だけ。答えの記録を当てるより先にするのは、当てる
 * 途中で失敗して答え直したときに、同じ案から項目を2つ作らないため。
 *
 * 答えの行（できた・結び付けた項目は `resultRubricItemId`）と、当て外ししたマスの採点行
 * （適用付き）を返す。renderer はこれで点を計算して書き、朱書きを合わせる
 */
export async function answerAiRubricProposal(
  input: AnswerAiRubricProposalInput,
  actorUserId: string
) {
  const proposal = await findProposalForAnswer(input.proposalId)
  if (proposal.run.userId !== actorUserId) {
    throw new Error("問いかけに答えられるのは、AI 採点を実行した教員だけです")
  }
  const { cropRegion } = proposal.run.prompt
  const memberExamStudentIds = new Set(
    proposal.members.map((member) => member.attempt.examStudentId)
  )
  if (
    input.examStudentIds.some(
      (examStudentId) => !memberExamStudentIds.has(examStudentId)
    )
  ) {
    throw new Error("案に入っていない答案が含まれています")
  }
  const previousResultItemId = proposal.responses.at(-1)?.resultRubricItemId
  const livingIds = await listLivingRubricItemIds(
    [proposal.matchedRubricItemId, previousResultItemId].flatMap(
      (rubricItemId) => (rubricItemId ? [rubricItemId] : [])
    )
  )

  if (input.optionId === null) {
    if (input.freeText.trim() === "") {
      throw new Error("「その他」には指示を書いてください")
    }
    const response = await prisma.aiRubricProposalResponse.create({
      data: {
        proposalId: proposal.id,
        optionId: null,
        freeText: input.freeText.trim(),
      },
    })
    await recordAnswerAudit(proposal.label, cropRegion, actorUserId, "その他")
    const touchedRows =
      previousResultItemId && livingIds.has(previousResultItemId)
        ? await setRubricApplications(
            {
              cropRegionId: cropRegion.id,
              rubricItemId: previousResultItemId,
              examStudentIds: input.examStudentIds,
              applied: false,
            },
            actorUserId
          )
        : []
    return { response, touchedRows }
  }

  const option = proposal.options.find(
    (candidate) => candidate.id === input.optionId
  )
  if (!option) throw new Error("選んだ選択肢が、この案のものではありません")
  const effect = {
    effectKind: option.effectKind,
    pointDelta:
      option.pointDelta === null ? null : option.pointDelta.toNumber(),
    setStatus: option.setStatus,
    setScore: option.setScore === null ? null : option.setScore.toNumber(),
  }

  const rubricItemId = await (async (): Promise<string> => {
    if (
      proposal.matchedRubricItemId &&
      livingIds.has(proposal.matchedRubricItemId)
    ) {
      // 既存の項目に当たる案は、項目の値を変えない（その項目を当てる案だけを示す。§3-4）
      return proposal.matchedRubricItemId
    }
    if (previousResultItemId && livingIds.has(previousResultItemId)) {
      // 選び直しは項目の値を変えるだけ（当たっている答案すべての点が変わる。§3-5）
      await updateRubricItem(previousResultItemId, { effect }, actorUserId)
      return previousResultItemId
    }
    const lastItem = await prisma.rubricItem.findFirst({
      where: { cropRegionId: cropRegion.id },
      orderBy: [{ sortOrder: "desc" }],
    })
    const created = await createRubricItem(
      {
        cropRegionId: cropRegion.id,
        label: input.label ?? proposal.label,
        adviceText: input.adviceText ?? proposal.adviceDraft,
        sortOrder: (lastItem?.sortOrder ?? -1) + 1,
        ...effect,
      },
      actorUserId
    )
    return created.id
  })()

  const response = await prisma.aiRubricProposalResponse.create({
    data: {
      proposalId: proposal.id,
      optionId: option.id,
      freeText: "",
      resultRubricItemId: rubricItemId,
    },
  })
  await recordAnswerAudit(
    proposal.label,
    cropRegion,
    actorUserId,
    option.rationale || "選択肢"
  )
  const touchedRows =
    input.examStudentIds.length === 0
      ? []
      : await setRubricApplications(
          {
            cropRegionId: cropRegion.id,
            rubricItemId,
            examStudentIds: input.examStudentIds,
            applied: true,
          },
          actorUserId
        )
  return { response, touchedRows }
}

/** 答えたことを監査ログに残す（何を選んだかは一言で） */
async function recordAnswerAudit(
  proposalLabel: string,
  cropRegion: Parameters<typeof cropRegionAuditTarget>[0],
  actorUserId: string,
  choice: string
): Promise<void> {
  const scope = await resolveExamScopeByCropRegion(cropRegion.id)
  await recordAuditLog({
    action: "exam.ai_proposal.answer",
    userId: actorUserId,
    entityType: "CropRegion",
    entityId: cropRegion.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: proposalLabel || null,
    summary: `AI の項目の案「${proposalLabel}」に答えました（${choice}）`,
    targets: [cropRegionAuditTarget(cropRegion)],
  })
}
