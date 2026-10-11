/**
 * 2段目の項目の案（AiRubricProposal と選択肢・答案）と、問いかけへの教員の答え
 * （AiRubricProposalResponse）の読み書き（docs/vlm-grading-design.md §3-4・§3-5・§5-3）。
 *
 * AI の層は追記だけ。案は書き換えず、答え直しは新しい答えの行（最新が効く）。
 *
 * **答えは下書き（`recordAiRubricProposalDraft`）で、教員の層へ書くのは確定のとき
 * （`commitAiRubricProposalResponse`）だけ。** 選んだ選択肢からルーブリック項目を作り（既存の項目に
 * 当たる案なら作らない）、案の答案の操作者自身の採点行に当てる。点の計算と朱書きの合わせは
 * renderer が、返した採点行から行う。
 */

import { Prisma } from "@prisma/client"

import type { ValidatedStage2Proposal } from "@/lib/shared/aiGrading/stage2ResponseValidator"

import {
  assertQuestioningScores,
  type QuestioningScoreInput,
} from "./aiQuestioningScore"
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
 * 教員が問いかけの「その他」に書いた再採点への指示のうち、今も効いているもの（案ごとの最新の
 * **確定した**答えが「その他」のもの）を、答えた順に。次の往復の1段目（答案ごとの採点のやり直し）に
 * だけ「教員の指示」として添える（2段目の案の作り直しへの指示ではない）。下書きの答えと、
 * 1件ずつ採点した答え（指示が空）は入れない。
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
      responses: {
        where: { committedAt: { not: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
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
 * 答案は試行（判定・確信度・受験者）を、答えは1件ずつ採点した点を同梱する。氏名は画面が受験者から引く
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
          responses: {
            include: { scores: { orderBy: { id: "asc" } } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
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

/** 問いかけへの答え（下書き）の引数 */
export interface RecordAiRubricProposalDraftInput {
  proposalId: string
  /** 選んだ選択肢。「その他」・1件ずつ採点なら null */
  optionId: string | null
  /** 「その他」に書いた再採点への指示（それ以外は ""） */
  freeText: string
  /**
   * 1件ずつ自分で採点したときの点（案の答案の試行ごと。付けていない答案は入れない）。
   * 選択肢・「その他」のときは空
   */
  manualScores: QuestioningScoreInput[]
}

/**
 * 問いかけに答える（下書き。§3-5）。答えの行（と、1件ずつ採点した点）を書くだけで、
 * 教員の層（項目・適用・採点）には触らない。答え直しは新しい行（最新が効く）。
 *
 * 答えの種類は3つで、混ぜない: 選択肢（`optionId`）／「その他」（`freeText`）／1件ずつ採点
 * （どちらも無く、`manualScores` だけ。点を1件も付けずに答えてもよい）。
 * 答えられるのは、その案を出した実行の教員だけ
 */
export async function recordAiRubricProposalDraft(
  input: RecordAiRubricProposalDraftInput,
  actorUserId: string
) {
  const proposal = await findProposalForAnswer(input.proposalId)
  if (proposal.run.userId !== actorUserId) {
    throw new Error("問いかけに答えられるのは、AI 採点を実行した教員だけです")
  }
  const freeText = input.freeText.trim()
  if (input.optionId !== null) {
    if (freeText !== "" || input.manualScores.length > 0) {
      throw new Error("選択肢を選んだ答えに、指示や点は付けません")
    }
    if (!proposal.options.some((option) => option.id === input.optionId)) {
      throw new Error("選んだ選択肢が、この案のものではありません")
    }
  } else if (freeText !== "" && input.manualScores.length > 0) {
    throw new Error("「その他」の指示と、1件ずつ採点した点は一緒に答えません")
  }
  const memberAttemptIds = new Set(
    proposal.members.map((member) => member.attemptId)
  )
  if (
    input.manualScores.some((score) => !memberAttemptIds.has(score.attemptId))
  ) {
    throw new Error("案に入っていない答案の点が含まれています")
  }
  const points = proposal.run.prompt.cropRegion.points
  assertQuestioningScores(input.manualScores, points)

  return prisma.aiRubricProposalResponse.create({
    data: {
      proposalId: proposal.id,
      optionId: input.optionId,
      freeText,
      scores: {
        create: input.manualScores.map((score) => ({
          attemptId: score.attemptId,
          status: score.status,
          partialScore:
            score.partialScore === null
              ? null
              : new Prisma.Decimal(score.partialScore),
        })),
      },
    },
    include: { scores: true },
  })
}

/** 答えの確定の引数 */
export interface CommitAiRubricProposalResponseInput {
  /** 確定する答え（下書き） */
  responseId: string
  /**
   * 項目を当てる（「その他」・1件ずつ採点なら外す）答案（受験者）。案の答案のうち renderer が
   * 選んだもの（AI 採点では、採点済みの答案も案に入れて置き換えるので、ふつうは案の答案すべて）
   */
  examStudentIds: string[]
}

/**
 * 問いかけの答え（下書き）を、教員の層へ書いて確定する（§3-5）。
 *
 * - 選択肢: 項目を決め（既存の項目に当たる案はその項目。前に確定した答えで作った項目があれば、
 *   その項目の効き方を選んだ選択肢に変える。どちらも無ければ新しく作る）、渡した答案の
 *   操作者自身の採点行に当て、答えを確定済みにする
 * - 「その他」: 前に確定した答えで当てた項目があれば渡した答案から外し、答えを確定済みにする
 *   （その案の答案は次の往復の1段目に回せる）
 * - 1件ずつ採点: 前に確定した答えで当てた項目があれば外す。**確定済みにはしない** — 点は
 *   renderer が項目の点のあとに書き（`writeAiQuestioningScores`）、書き終えてから
 *   `markAiQuestioningCommitted` で確定済みにする（点を書く前に失敗しても、下書きが残って確定し直せる）
 *
 * 項目を決めたら、当てる前に答えの行へ `resultRubricItemId` を書く。当てる途中で失敗して確定し直したとき、
 * 同じ案から項目を2つ作らないため。確定済みの答えを渡したら、何もせずに返す。
 *
 * 答えの行と、当て外ししたマスの採点行（適用付き）を返す。renderer はこれで点を計算して書き、朱書きを合わせる
 */
export async function commitAiRubricProposalResponse(
  input: CommitAiRubricProposalResponseInput,
  actorUserId: string
) {
  const draft = await prisma.aiRubricProposalResponse.findUnique({
    where: { id: input.responseId },
  })
  if (!draft) throw new Error("問いかけの答えが見つかりません")
  const proposal = await findProposalForAnswer(draft.proposalId)
  if (proposal.run.userId !== actorUserId) {
    throw new Error("問いかけに答えられるのは、AI 採点を実行した教員だけです")
  }
  if (draft.committedAt !== null) return { response: draft, touchedRows: [] }

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
  // 前に確定した答えで作った・結び付けた項目（「その他」で外したあとも、選び直しで使い回す）
  const previousResultItemId = [...proposal.responses]
    .reverse()
    .find(
      (response) =>
        response.committedAt !== null &&
        response.id !== draft.id &&
        response.resultRubricItemId !== null
    )?.resultRubricItemId
  const livingIds = await listLivingRubricItemIds(
    [
      proposal.matchedRubricItemId,
      previousResultItemId,
      draft.resultRubricItemId,
    ].flatMap((rubricItemId) => (rubricItemId ? [rubricItemId] : []))
  )

  if (draft.optionId === null) {
    const isInstruction = draft.freeText.trim() !== ""
    const response = isInstruction
      ? await prisma.aiRubricProposalResponse.update({
          where: { id: draft.id },
          data: { committedAt: new Date() },
        })
      : draft
    await recordAnswerAudit(
      proposal.label,
      cropRegion,
      actorUserId,
      isInstruction ? "その他" : "1件ずつ採点"
    )
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
    (candidate) => candidate.id === draft.optionId
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
    // 前の確定の途中で作った項目（この答えに書いてある）か、前に確定した答えで作った項目
    const reusableItemId = [
      draft.resultRubricItemId,
      previousResultItemId,
    ].find((rubricItemId) => rubricItemId && livingIds.has(rubricItemId))
    if (reusableItemId) {
      // 選び直しは項目の値を変えるだけ（当たっている答案すべての点が変わる。§3-5）
      await updateRubricItem(reusableItemId, { effect }, actorUserId)
      return reusableItemId
    }
    const lastItem = await prisma.rubricItem.findFirst({
      where: { cropRegionId: cropRegion.id },
      orderBy: [{ sortOrder: "desc" }],
    })
    const created = await createRubricItem(
      {
        cropRegionId: cropRegion.id,
        label: proposal.label,
        adviceText: proposal.adviceDraft,
        sortOrder: (lastItem?.sortOrder ?? -1) + 1,
        ...effect,
      },
      actorUserId
    )
    return created.id
  })()

  if (draft.resultRubricItemId !== rubricItemId) {
    await prisma.aiRubricProposalResponse.update({
      where: { id: draft.id },
      data: { resultRubricItemId: rubricItemId },
    })
  }
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
  const response = await prisma.aiRubricProposalResponse.update({
    where: { id: draft.id },
    data: { committedAt: new Date() },
  })
  await recordAnswerAudit(
    proposal.label,
    cropRegion,
    actorUserId,
    option.rationale || "選択肢"
  )
  return { response, touchedRows }
}

/** 確定したことを監査ログに残す（何を選んだかは一言で） */
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
    summary: `AI の項目の案「${proposalLabel}」への答えを確定しました（${choice}）`,
    targets: [cropRegionAuditTarget(cropRegion)],
  })
}
