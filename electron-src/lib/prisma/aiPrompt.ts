/**
 * AI 採点のプロンプト（AiPrompt）の読み書きと、模範解答の下書きの元（ASB）の読み取り。
 *
 * **プロンプトは書き換えない・消さない**（docs/vlm-grading-design.md §3-1・§5-3）。
 * 教員が直すと、元の行を親とする新しい行を作る。過去のプロンプトはすべて残り、それ自体が
 * 履歴になる。そのため、ここには作成の口しか無い。
 *
 * 行には、その時点のルーブリック項目の一覧を文にしたもの（`renderedRubricItems`）を写す。
 * 送るときに今の項目と違っていれば、アプリが新しい行を作って送る（`ensurePromptRendersRubricItems`）。
 */

import type { AiPrompt, Prisma } from "@prisma/client"

import {
  formatRubricItemsSection,
  toRubricItemForPrompt,
} from "@/lib/shared/aiGrading/rubricItemsText"
import type { RubricItemForPrompt } from "@/types/rubric.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"
import { listRubricItemsByCropRegion } from "./rubricItem"

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

/** 送る時点のルーブリック項目（並び順）と、それをプロンプトの行へ写す文 */
export async function readRubricItemsForPrompt(cropRegionId: string): Promise<{
  rubricItems: RubricItemForPrompt[]
  renderedRubricItems: string
}> {
  const rows = await listRubricItemsByCropRegion(cropRegionId)
  const rubricItems = rows.map((row) =>
    toRubricItemForPrompt({
      id: row.id,
      label: row.label,
      effectKind: row.effectKind,
      pointDelta: row.pointDelta === null ? null : row.pointDelta.toNumber(),
      setStatus: row.setStatus,
      setScore: row.setScore === null ? null : row.setScore.toNumber(),
    })
  )
  return {
    rubricItems,
    renderedRubricItems: formatRubricItemsSection(rubricItems) ?? "",
  }
}

/**
 * 教員が書いたプロンプトの中身。作成者・項目の一覧の文・改訂のときだけ埋まる2欄は含めない
 * （作成者は main が操作者から決め、項目の一覧の文はアプリが写す。改訂の欄は廃止した
 * プロンプトの改訂の名残で、もう書かない）
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
  | "annotationInstruction"
>

/**
 * プロンプトを1行作る。
 *
 * 親を指定するなら、親は同じ設問のプロンプトでなければならない（別の設問の行を親に
 * すると、履歴を辿ったときに設問をまたいでしまう）。
 */
export async function createAiPrompt(
  data: CreateAiPromptData,
  actorUserId: string
) {
  if (data.parentPromptId) {
    const parentPrompt = await prisma.aiPrompt.findUnique({
      where: { id: data.parentPromptId },
    })
    if (!parentPrompt || parentPrompt.cropRegionId !== data.cropRegionId) {
      throw new Error("直す元のプロンプトが、この設問のものではありません")
    }
  }

  const { renderedRubricItems } = await readRubricItemsForPrompt(
    data.cropRegionId
  )
  const created = await prisma.aiPrompt.create({
    data: {
      cropRegionId: data.cropRegionId,
      parentPromptId: data.parentPromptId ?? null,
      createdByUserId: actorUserId,
      questionText: data.questionText ?? "",
      questionImagePath: data.questionImagePath ?? null,
      modelAnswerText: data.modelAnswerText ?? "",
      sendModelAnswerImage: data.sendModelAnswerImage ?? true,
      rubricText: data.rubricText ?? "",
      annotationInstruction: data.annotationInstruction ?? "",
      renderedRubricItems,
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
  })

  return created
}

/**
 * 送る項目の一覧の文が、プロンプトの行に写したものと同じならその行を、違えばその行を親として
 * 文だけを今のものにした新しい行を作って返す（§3-1。送った文面を行から再現できるように）
 */
export async function ensurePromptRendersRubricItems(
  prompt: AiPrompt,
  renderedRubricItems: string,
  actorUserId: string
): Promise<AiPrompt> {
  if (prompt.renderedRubricItems === renderedRubricItems) return prompt
  const created = await prisma.aiPrompt.create({
    data: {
      cropRegionId: prompt.cropRegionId,
      parentPromptId: prompt.id,
      createdByUserId: actorUserId,
      questionText: prompt.questionText,
      questionImagePath: prompt.questionImagePath,
      modelAnswerText: prompt.modelAnswerText,
      sendModelAnswerImage: prompt.sendModelAnswerImage,
      rubricText: prompt.rubricText,
      annotationInstruction: prompt.annotationInstruction,
      renderedRubricItems,
    },
  })
  const scope = await resolveExamScopeByCropRegion(prompt.cropRegionId)
  await recordAuditLog({
    action: "exam.ai_prompt.create",
    userId: actorUserId,
    entityType: "AiPrompt",
    entityId: created.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary:
      "ルーブリック項目の一覧が変わったので、プロンプトの新しい版を作りました",
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
