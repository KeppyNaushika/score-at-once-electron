/**
 * AI 採点のプロンプト（AiPrompt）の読み書きと、模範解答の下書きの元（ASB）の読み取り。
 *
 * **プロンプトは書き換えない・消さない**（docs/vlm-grading-design.md §3-1・§4-2）。
 * 教員が直接直しても VLM に改訂させても、元の行を親とする新しい行を作る。過去の
 * プロンプトはすべて残り、それ自体が履歴になる。そのため、ここには作成の口しか無い。
 */

import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"

/** プロンプトを画面へ返すときの木。作成者は秘密（passcode）を落として連れてくる */
const aiPromptInclude = {
  createdBy: { omit: PUBLIC_USER_OMIT },
} satisfies Prisma.AiPromptInclude

/** 設問のプロンプトを古い順に全部（どの採点者が作ったものも。設計 §4-5 G） */
export async function listAiPromptsByCropRegion(cropRegionId: string) {
  return prisma.aiPrompt.findMany({
    where: { cropRegionId },
    include: aiPromptInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
}

/** プロンプト1件（作成者付き）。無ければ null */
export async function getAiPrompt(promptId: string) {
  return prisma.aiPrompt.findUnique({
    where: { id: promptId },
    include: aiPromptInclude,
  })
}

/**
 * 教員が書いたプロンプトの中身。作成者と、改訂のときだけ埋まる2欄は含めない
 * （作成者は main が操作者から決め、改訂の欄は VLM の改訂だけが書く）
 */
export type CreateAiPromptData = Pick<
  Prisma.AiPromptUncheckedCreateInput,
  | "cropRegionId"
  | "parentPromptId"
  | "questionText"
  | "questionImagePath"
  | "modelAnswerText"
  | "sendModelAnswerImage"
  | "rubricText"
>

/** VLM に改訂させてできた行だけが持つ2欄 */
interface AiPromptRevisionRecord {
  revisionInstruction: string
  revisionMessage: string
}

/**
 * プロンプトを1行作る。
 *
 * 親を指定するなら、親は同じ設問のプロンプトでなければならない（別の設問の行を親に
 * すると、履歴を辿ったときに設問をまたいでしまう）。
 *
 * @param revision VLM の改訂でできた行のとき、指示文と説明。教員が直接書いた行は省く
 */
export async function createAiPrompt(
  data: CreateAiPromptData,
  actorUserId: string,
  revision?: AiPromptRevisionRecord
) {
  if (data.parentPromptId) {
    const parentPrompt = await prisma.aiPrompt.findUnique({
      where: { id: data.parentPromptId },
    })
    if (!parentPrompt || parentPrompt.cropRegionId !== data.cropRegionId) {
      throw new Error("直す元のプロンプトが、この設問のものではありません")
    }
  }

  const created = await prisma.aiPrompt.create({
    data: {
      cropRegionId: data.cropRegionId,
      parentPromptId: data.parentPromptId ?? null,
      createdByUserId: actorUserId,
      questionText: data.questionText ?? "",
      questionImagePath: data.questionImagePath ?? null,
      modelAnswerText: data.modelAnswerText ?? "",
      sendModelAnswerImage: data.sendModelAnswerImage ?? false,
      rubricText: data.rubricText ?? "",
      revisionInstruction: revision?.revisionInstruction ?? "",
      revisionMessage: revision?.revisionMessage ?? "",
    },
    include: aiPromptInclude,
  })

  const scope = await resolveExamScopeByCropRegion(data.cropRegionId)
  await recordAuditLog({
    action: "exam.ai_prompt.create",
    userId: actorUserId,
    entityType: "AiPrompt",
    entityId: created.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    extra: { revisedByAi: revision !== undefined },
  })

  return created
}

/**
 * 模範解答の下書きの元になる解答用紙（ASB）の小問・枝問とテキスト要素を、木のまま返す。
 *
 * 試験と ASB の間に FK は無く、つながりはラベル文字列だけ（設計 §2）。ラベルの照合と
 * `||…||` の抽出は renderer で行うので、ここは生の行を返すだけにする。担当者（User）は
 * 連れてこない。無ければ null。
 */
export async function getAsbModelAnswerSource(asbDefinitionId: string) {
  return prisma.asbDefinition.findUnique({
    where: { id: asbDefinitionId },
    include: {
      majorQuestions: {
        orderBy: { order: "asc" },
        include: {
          subQuestions: {
            orderBy: { order: "asc" },
            include: {
              textElements: { orderBy: { order: "asc" } },
              branchQuestions: {
                orderBy: { order: "asc" },
                include: { textElements: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  })
}
