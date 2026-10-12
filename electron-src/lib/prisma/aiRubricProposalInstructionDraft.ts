/**
 * 問いかけの「その他：再採点を指示する」の欄の文（AiRubricProposalInstructionDraft）の読み書き
 * （docs/vlm-grading-design.md §3-5・§5-3）。
 *
 * 欄の文は1打鍵ごとに、案ごと・教員ごとの行をその場で書き換える（答えの行は追記なので、打鍵ごとに書くと行が増える）。
 * 決めたときは renderer が欄の文を答えの `freeText` に写す。確定のとき「その他」を選んでいない案の行は消す。
 * AI の層の下書きなので、助言の欄の文と同じく監査ログには残さない（再採点への指示が効くのは確定した答えの freeText）。
 */

import prisma from "./client"

/** 「その他」の欄の文の引数 */
export interface SetAiRubricProposalInstructionDraftInput {
  proposalId: string
  /** 欄の文そのまま（決めるときに前後の空白を落とす） */
  instructionText: string
}

/**
 * 「その他」の欄の文を書く（1打鍵ごと）。案ごと・教員ごとの行を、その場で書き換える
 * （無ければ作る。複数あれば updatedAt の新しい方）。書けるのは、その案を出した実行の教員だけ
 */
export async function setAiRubricProposalInstructionDraft(
  input: SetAiRubricProposalInstructionDraftInput,
  actorUserId: string
) {
  const proposal = await prisma.aiRubricProposal.findUnique({
    where: { id: input.proposalId },
    include: { run: true },
  })
  if (!proposal) throw new Error("項目の案が見つかりません")
  if (proposal.run.userId !== actorUserId) {
    throw new Error("問いかけに答えられるのは、AI採点を実行した教員だけです")
  }
  const latest = await prisma.aiRubricProposalInstructionDraft.findFirst({
    where: { proposalId: proposal.id, userId: actorUserId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  })
  return latest
    ? prisma.aiRubricProposalInstructionDraft.update({
        where: { id: latest.id },
        data: { instructionText: input.instructionText },
      })
    : prisma.aiRubricProposalInstructionDraft.create({
        data: {
          proposalId: proposal.id,
          userId: actorUserId,
          instructionText: input.instructionText,
        },
      })
}

/** 捨てる「その他」の欄の文の引数 */
export interface DiscardAiRubricProposalInstructionDraftsInput {
  /** 確定のとき「その他」を選んでいない案 */
  proposalIds: string[]
}

/**
 * 「その他」の欄の文を捨てる（確定のとき、「その他」を選んでいない案の行）。消すのは操作者自身の行だけ
 */
export async function discardAiRubricProposalInstructionDrafts(
  input: DiscardAiRubricProposalInstructionDraftsInput,
  actorUserId: string
) {
  if (input.proposalIds.length === 0) return { count: 0 }
  return prisma.aiRubricProposalInstructionDraft.deleteMany({
    where: { proposalId: { in: input.proposalIds }, userId: actorUserId },
  })
}
