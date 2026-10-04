/**
 * プロンプトの改訂（VLM に直させる1往復）を走らせる（docs/vlm-grading-design.md §3-1）。
 *
 * 送るのは、いまのプロンプト・教員の指示文・選んだ答案の画像・その答案での AI と教員の
 * 食い違い、の4つだけ。返ってきた各欄から、元のプロンプトを親とする新しい行を作る。
 * 改訂では採点しない（直したプロンプトでの採点は、改めて本番と同じ送り方で行う）。
 */

import { buildRevisionOutputSchema } from "@/lib/shared/aiGrading/gradingSchema"
import { AI_GRADING_TEMPLATE_VERSION } from "@/lib/shared/aiGrading/promptBuilder"
import {
  buildRevisionRequest,
  describeScoreDiscrepancy,
  parseRevisionResponse,
} from "@/lib/shared/aiGrading/revisionPromptBuilder"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { createAiGradingRun, updateAiGradingRun } from "../prisma/aiGradingRun"
import {
  getCropRegionWithAnswerImages,
  listAiGradingAttemptsByIds,
  listOwnQuestionScores,
} from "../prisma/aiGradingSource"
import { createAiPrompt, getAiPrompt } from "../prisma/aiPrompt"
import { cropRegionForSending } from "./answerImage"
import {
  loadPromptImages,
  REVISION_MAX_OUTPUT_TOKENS,
  toJsonSchemaObject,
  toPngPromptImage,
} from "./gradingRequestFactory"
import type { AiGradingJobDependencies } from "./jobDependencies"
import type {
  GradingEffort,
  GradingProviderId,
  ProviderUsage,
} from "./providers/types"
import { isGradingEffort, isGradingProviderId } from "./providers/types"

/** 改訂を頼むときに渡すもの */
export interface RevisePromptInput {
  /** 直す元のプロンプト */
  promptId: string
  /** 教員の指示文 */
  instruction: string
  /**
   * 添える答案。`attemptId` は画面に出している AI の判定（どれを出すかは renderer が
   * 決める）。AI の判定が無い答案は null
   */
  samples: { examStudentId: string; attemptId: string | null }[]
  provider: GradingProviderId
  model: string
  effort: GradingEffort
}

function assertValidRevisionInput(input: RevisePromptInput): void {
  if (input.instruction.trim() === "" && input.samples.length === 0) {
    throw new Error("指示文か、添える答案のどちらかが要ります")
  }
  if (!isGradingProviderId(input.provider)) {
    throw new Error(`対応していない事業者です: ${String(input.provider)}`)
  }
  if (input.model.trim() === "") throw new Error("モデルを指定してください")
  if (!isGradingEffort(input.effort)) {
    throw new Error(`effort の値が正しくありません: ${String(input.effort)}`)
  }
}

const usageColumns = (usage: ProviderUsage) => ({
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens,
  cacheWriteTokens: usage.cacheWriteTokens,
})

/**
 * 改訂を頼み、できたプロンプトを返す。失敗したら run を failed にして投げる
 */
export async function runPromptRevision(
  input: RevisePromptInput,
  actorUserId: string,
  dependencies: AiGradingJobDependencies
) {
  assertValidRevisionInput(input)
  const prompt = await getAiPrompt(input.promptId)
  if (!prompt) throw new Error("プロンプトが見つかりません")
  const examStudentIds = input.samples.map((sample) => sample.examStudentId)
  const cropRegion = await getCropRegionWithAnswerImages(
    prompt.cropRegionId,
    examStudentIds
  )
  if (!cropRegion) throw new Error("設問が見つかりません")
  const provider = dependencies.resolveProvider(input.provider)

  const attemptIds = input.samples.flatMap((sample) =>
    sample.attemptId ? [sample.attemptId] : []
  )
  const attempts = await listAiGradingAttemptsByIds(attemptIds)
  const ownScores = await listOwnQuestionScores(
    cropRegion.id,
    actorUserId,
    examStudentIds
  )
  const points = cropRegion.points

  const samples = []
  for (const sample of input.samples) {
    const studentAnswerImage = cropRegion.examPage.studentAnswerImages.find(
      (answerImage) => answerImage.examStudentId === sample.examStudentId
    )
    if (!studentAnswerImage) throw new Error("答案画像の無い答案があります")
    const attempt = attempts.find(
      (candidate) =>
        candidate.id === sample.attemptId &&
        candidate.examStudentId === sample.examStudentId &&
        candidate.run.prompt.cropRegionId === cropRegion.id
    )
    if (sample.attemptId && !attempt) {
      throw new Error("添えた AI の判定が、この設問・答案のものではありません")
    }
    const ownScore = ownScores.find(
      (questionScore) => questionScore.examStudentId === sample.examStudentId
    )
    const crop = await cropRegionForSending(
      dependencies.resolveDataPath(studentAnswerImage.imagePath),
      cropRegion
    )
    samples.push({
      answerImage: toPngPromptImage(crop.png),
      discrepancyText: describeScoreDiscrepancy({
        aiJudgement:
          attempt?.state === "succeeded"
            ? {
                status: toScoringStatus(attempt.status),
                partialScore: attempt.partialScore?.toNumber() ?? null,
                comment: attempt.comment,
              }
            : null,
        teacherScore: ownScore
          ? {
              status: toScoringStatus(ownScore.status),
              partialScore: ownScore.partialScore?.toNumber() ?? null,
              comment: ownScore.comment,
            }
          : null,
        points,
      }),
    })
  }

  const { questionImage, modelAnswerImage } = await loadPromptImages({
    prompt,
    cropRegion,
    examPage: cropRegion.examPage,
    imageScale: 1,
    resolveDataPath: dependencies.resolveDataPath,
  })
  const { systemText, fixedParts, variableParts } = buildRevisionRequest({
    prompt,
    points,
    questionImage,
    modelAnswerImage,
    instruction: input.instruction,
    samples,
  })

  const run = await createAiGradingRun(
    {
      userId: actorUserId,
      promptId: prompt.id,
      purpose: "revise",
      templateVersion: AI_GRADING_TEMPLATE_VERSION,
      provider: input.provider,
      model: input.model,
      effort: input.effort,
      mode: "realtime",
      status: "in_progress",
      submittedClientId: dependencies.getClientId(),
      imageScale: 1,
      points,
    },
    []
  )

  const fail = async (message: string, usage?: ProviderUsage) => {
    await updateAiGradingRun(run.id, {
      status: "failed",
      endedAt: new Date(),
      ...(usage ? usageColumns(usage) : {}),
    })
    return new Error(message)
  }

  let response
  try {
    response = await provider.grade(
      {
        customId: run.id,
        model: input.model,
        effort: input.effort,
        maxOutputTokens: REVISION_MAX_OUTPUT_TOKENS,
        systemText,
        fixedParts,
        variableParts,
        outputSchema: toJsonSchemaObject(buildRevisionOutputSchema()),
      },
      new AbortController().signal
    )
  } catch (error) {
    throw await fail(
      `改訂を頼めませんでした: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (response.stop !== "completed") {
    throw await fail(
      `改訂が返りませんでした: ${response.errorMessage}`,
      response.usage
    )
  }
  const revision = parseRevisionResponse(response.parsedJson)
  if (!revision.ok) {
    throw await fail(
      `改訂の応答を読めませんでした: ${revision.reasons.join(" / ")}`,
      response.usage
    )
  }

  const revisedPrompt = await createAiPrompt(
    {
      cropRegionId: prompt.cropRegionId,
      parentPromptId: prompt.id,
      questionText: revision.value.questionText,
      questionImagePath: prompt.questionImagePath,
      modelAnswerText: revision.value.modelAnswerText,
      sendModelAnswerImage: prompt.sendModelAnswerImage,
      rubricText: revision.value.rubricText,
    },
    actorUserId,
    {
      revisionInstruction: input.instruction,
      revisionMessage: revision.value.message,
    }
  )
  await updateAiGradingRun(run.id, {
    status: "ended",
    endedAt: new Date(),
    resultPromptId: revisedPrompt.id,
    ...usageColumns(response.usage),
  })
  return revisedPrompt
}
