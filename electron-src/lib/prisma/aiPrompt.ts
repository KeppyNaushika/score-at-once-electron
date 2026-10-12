/**
 * AI採点のプロンプト（AiPrompt）の読み書きと、模範解答の下書きの元（ASB）の読み取り。
 *
 * **プロンプトは書き換えない・消さない**（docs/vlm-grading-design.md §3-1・§5-3）。
 * 教員が直すと、元の行を親とする新しい行を作る。過去のプロンプトはすべて残り、それ自体が
 * 履歴になる。そのため、ここには作成の口しか無い。
 *
 * 行には、その時点の採点項目の一覧を文にしたもの（`renderedRubricItems`）と、類型方式の設問なら
 * 類型表の類型の一覧を文にしたもの（`renderedScaleLevels`）を写す。送るときに今の項目・類型と
 * 違っていれば、アプリが新しい行を作って送る（`ensurePromptRendersCriteria`）。
 *
 * 問題の画像（`AiPromptQuestionImage`）もプロンプトの一部で、プロンプトの行を作るときに一緒に作る。
 * 新しい行を作るたびに、画像の行も並び順のまま作り直す（ファイルは同じものを指す）。
 */

import type { Prisma } from "@prisma/client"

import {
  formatRubricItemsSection,
  toRubricItemForPrompt,
} from "@/lib/shared/aiGrading/rubricItemsText"
import {
  formatScaleLevelsSection,
  type ScaleLevelForPrompt,
} from "@/lib/shared/aiGrading/scaleLevelsText"
import { type RubricItemForPrompt, toScoringMethod } from "@/types/rubric.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"
import { listRubricItemsByCropRegion } from "./rubricItem"

/** プロンプトを画面へ返すときの木。作成者は秘密（passcode）を落として連れてくる */
const aiPromptInclude = {
  createdBy: { omit: PUBLIC_USER_OMIT },
  questionImages: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
} satisfies Prisma.AiPromptInclude

/** プロンプト1行（作成者・問題の画像付き） */
type AiPromptWithImages = Prisma.AiPromptGetPayload<{
  include: typeof aiPromptInclude
}>

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

/** 送る時点の採点の基準（採点項目と、類型方式の設問の類型）と、それをプロンプトの行へ写す文 */
export interface GradingCriteriaForPrompt {
  /** 設問が類型方式か（CropRegion.scoringMethod が scale） */
  isScaleQuestion: boolean
  /** 採点項目（並び順） */
  rubricItems: RubricItemForPrompt[]
  renderedRubricItems: string
  /** 類型方式の設問の類型表の類型（並び順）。類型方式でない・類型表の無い設問は空 */
  scaleLevels: ScaleLevelForPrompt[]
  /** 類型の一覧の文。類型方式でない設問は "" */
  renderedScaleLevels: string
}

/**
 * 送る時点の採点項目・類型（並び順）と、それをプロンプトの行へ写す文。
 * 類型にする項目の効き目は類型の記号で書くので、項目の文も類型の一覧から組む
 */
export async function readGradingCriteriaForPrompt(
  cropRegionId: string
): Promise<GradingCriteriaForPrompt> {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    include: {
      scoreScale: {
        include: { levels: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
    },
  })
  if (!cropRegion) throw new Error("設問が見つかりません")
  const isScaleQuestion = toScoringMethod(cropRegion.scoringMethod) === "scale"
  const scaleLevels: ScaleLevelForPrompt[] = isScaleQuestion
    ? (cropRegion.scoreScale?.levels ?? [])
    : []
  const rows = await listRubricItemsByCropRegion(cropRegionId)
  const rubricItems = rows.map((row) =>
    toRubricItemForPrompt({
      id: row.id,
      label: row.label,
      effectKind: row.effectKind,
      pointDelta: row.pointDelta === null ? null : row.pointDelta.toNumber(),
      setStatus: row.setStatus,
      setScore: row.setScore === null ? null : row.setScore.toNumber(),
      setScaleLevelId: row.setScaleLevelId,
    })
  )
  return {
    isScaleQuestion,
    rubricItems,
    renderedRubricItems:
      formatRubricItemsSection(rubricItems, scaleLevels) ?? "",
    scaleLevels,
    renderedScaleLevels: formatScaleLevelsSection(scaleLevels) ?? "",
  }
}

/**
 * 教員が書いたプロンプトの中身。作成者・項目の一覧の文は含めない
 * （作成者は main が操作者から決め、項目の一覧の文はアプリが写す）
 */
export type CreateAiPromptData = Pick<
  Prisma.AiPromptUncheckedCreateInput,
  | "cropRegionId"
  | "parentPromptId"
  | "questionText"
  | "modelAnswerText"
  | "sendModelAnswerImage"
  | "rubricText"
  | "annotationInstruction"
> & {
  /**
   * 問題の画像（data ディレクトリからの相対パス）を送る順に。取り込んだ画像
   * （`aiGrading:importQuestionImage` が返したパス）か、直す元のプロンプトの画像だけを指せる
   */
  questionImagePaths?: string[]
}

/** 問題の画像を置く、試験フォルダの中のディレクトリ名 */
export const AI_QUESTION_IMAGES_DIRECTORY_NAME = "ai-question-images"

/** 問題の画像のパスが、この試験の取り込み先の中か（`..` で外へ出るものは外す） */
function isInQuestionImagesDirectory(imagePath: string, examId: string) {
  const segments = imagePath.split("/")
  return (
    imagePath.startsWith(
      `exams/${examId}/${AI_QUESTION_IMAGES_DIRECTORY_NAME}/`
    ) &&
    segments.every((segment) => segment !== ".." && segment !== "") &&
    !imagePath.includes("\\")
  )
}

/** 問題の画像の行を、送る順のまま作る形にする */
function toQuestionImageCreates(imagePaths: readonly string[]) {
  return imagePaths.map((imagePath, sortOrder) => ({ imagePath, sortOrder }))
}

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
  const parentPrompt = data.parentPromptId
    ? await prisma.aiPrompt.findUnique({
        where: { id: data.parentPromptId },
        include: { questionImages: true },
      })
    : null
  if (
    data.parentPromptId &&
    (!parentPrompt || parentPrompt.cropRegionId !== data.cropRegionId)
  ) {
    throw new Error("直す元の採点指示が、この設問のものではありません")
  }

  const questionImagePaths = data.questionImagePaths ?? []
  if (questionImagePaths.length > 0) {
    const cropRegion = await prisma.cropRegion.findUnique({
      where: { id: data.cropRegionId },
      include: { examPage: true },
    })
    if (!cropRegion) throw new Error("設問が見つかりません")
    const inheritedPaths = new Set(
      (parentPrompt?.questionImages ?? []).map(
        (questionImage) => questionImage.imagePath
      )
    )
    const unknownPath = questionImagePaths.find(
      (imagePath) =>
        !inheritedPaths.has(imagePath) &&
        !isInQuestionImagesDirectory(imagePath, cropRegion.examPage.examId)
    )
    if (unknownPath !== undefined) {
      throw new Error("問題の画像に、この試験で取り込んでいない画像があります")
    }
  }

  const { renderedRubricItems, renderedScaleLevels } =
    await readGradingCriteriaForPrompt(data.cropRegionId)
  const created = await prisma.aiPrompt.create({
    data: {
      cropRegionId: data.cropRegionId,
      parentPromptId: data.parentPromptId ?? null,
      createdByUserId: actorUserId,
      questionText: data.questionText ?? "",
      modelAnswerText: data.modelAnswerText ?? "",
      sendModelAnswerImage: data.sendModelAnswerImage ?? true,
      rubricText: data.rubricText ?? "",
      annotationInstruction: data.annotationInstruction ?? "",
      renderedRubricItems,
      renderedScaleLevels,
      questionImages: {
        create: toQuestionImageCreates(questionImagePaths),
      },
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
 * 送る項目・類型の一覧の文が、プロンプトの行に写したものと同じならその行を、違えばその行を親として
 * 文だけを今のものにした新しい行を作って返す（§3-1・§4-8-6。送った文面を行から再現できるように）
 */
export async function ensurePromptRendersCriteria(
  prompt: AiPromptWithImages,
  rendered: Pick<
    GradingCriteriaForPrompt,
    "renderedRubricItems" | "renderedScaleLevels"
  >,
  actorUserId: string
): Promise<AiPromptWithImages> {
  const { renderedRubricItems, renderedScaleLevels } = rendered
  if (
    prompt.renderedRubricItems === renderedRubricItems &&
    prompt.renderedScaleLevels === renderedScaleLevels
  ) {
    return prompt
  }
  const created = await prisma.aiPrompt.create({
    data: {
      cropRegionId: prompt.cropRegionId,
      parentPromptId: prompt.id,
      createdByUserId: actorUserId,
      questionText: prompt.questionText,
      modelAnswerText: prompt.modelAnswerText,
      sendModelAnswerImage: prompt.sendModelAnswerImage,
      rubricText: prompt.rubricText,
      annotationInstruction: prompt.annotationInstruction,
      renderedRubricItems,
      renderedScaleLevels,
      questionImages: {
        create: toQuestionImageCreates(
          prompt.questionImages.map((questionImage) => questionImage.imagePath)
        ),
      },
    },
    include: aiPromptInclude,
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
      prompt.renderedRubricItems === renderedRubricItems
        ? "類型表の類型が変わったので、採点指示の新しい版を作りました"
        : "採点項目の一覧が変わったので、採点指示の新しい版を作りました",
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
