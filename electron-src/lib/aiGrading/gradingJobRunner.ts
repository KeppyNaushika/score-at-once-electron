/**
 * AI 採点の実行（採点の run）を走らせる（docs/vlm-grading-design.md §10 jobRunner）。
 *
 * - 対象の答案（examStudentId）は renderer が選んで明示的に渡す。選び方はここに無い
 * - その場の採点（realtime）: 同時実行数を絞って1件ずつ送り、結果が届くたびに試行へ書いて
 *   進み具合を押し出す。run ごとに AbortController を持ち、中止できる
 * - バッチ（batch）: まとめて事業者へ預け、回収は `batchPoller.ts` が行う
 *
 * 認証・権限の失敗は、どの答案でも同じ結果になるので run 全体を止める。
 */

import { getOrientedPaperDimensions } from "@/lib/paperSize"
import { estimateAnnotationCharacterLimit } from "@/lib/shared/aiGrading/annotationPlacement"
import { buildGradingOutputSchema } from "@/lib/shared/aiGrading/gradingSchema"
import {
  AI_GRADING_TEMPLATE_VERSION,
  buildGradingRequestParts,
  buildGradingVariableParts,
} from "@/lib/shared/aiGrading/promptBuilder"
import type { AiGradingRunMode } from "@/types/aiGrading.types"
import { isAiGradingRunMode } from "@/types/aiGrading.types"

import {
  closePendingAiGradingAttempts,
  createAiGradingRun,
  getAiGradingRunForProcessing,
  narrowAiGradingRun,
  updateAiGradingRun,
} from "../prisma/aiGradingRun"
import { getCropRegionWithAnswerImages } from "../prisma/aiGradingSource"
import { getAiPrompt } from "../prisma/aiPrompt"
import { cropRegionForSending } from "./answerImage"
import {
  GRADING_MAX_OUTPUT_TOKENS,
  loadPromptImages,
  toJsonSchemaObject,
  toPngPromptImage,
} from "./gradingRequestFactory"
import {
  errorMessageOf,
  processRealtimeAttempts,
  submitBatchAttempts,
} from "./gradingRunExecution"
import type { AiGradingJobDependencies } from "./jobDependencies"
import type {
  GradingEffort,
  GradingProviderId,
  GradingRequest,
} from "./providers/types"
import { isGradingEffort, isGradingProviderId } from "./providers/types"
import { createRunProgressTracker } from "./runProgressTracker"

/** 拡大率の範囲（原寸の 1/4〜4倍） */
const IMAGE_SCALE_MIN = 0.25
const IMAGE_SCALE_MAX = 4

/** 採点を始めるときに渡すもの */
export interface StartGradingRunInput {
  promptId: string
  /** 送る答案。renderer が選び方（§3-2）に従って選んだもの */
  examStudentIds: string[]
  provider: GradingProviderId
  model: string
  effort: GradingEffort
  mode: AiGradingRunMode
  /** 答案の切り出しの拡大率（1 = 原寸） */
  imageScale: number
}

/** 入力を確かめる。正しくなければ投げる（何も作らない） */
function assertValidStartInput(input: StartGradingRunInput): void {
  if (input.examStudentIds.length === 0) {
    throw new Error("採点する答案がありません")
  }
  if (new Set(input.examStudentIds).size !== input.examStudentIds.length) {
    throw new Error("同じ答案が2回指定されています")
  }
  if (!isGradingProviderId(input.provider)) {
    throw new Error(`対応していない事業者です: ${String(input.provider)}`)
  }
  if (input.model.trim() === "") throw new Error("モデルを指定してください")
  if (!isGradingEffort(input.effort)) {
    throw new Error(`effort の値が正しくありません: ${String(input.effort)}`)
  }
  if (!isAiGradingRunMode(input.mode)) {
    throw new Error(`送り方の値が正しくありません: ${String(input.mode)}`)
  }
  if (
    !Number.isFinite(input.imageScale) ||
    input.imageScale < IMAGE_SCALE_MIN ||
    input.imageScale > IMAGE_SCALE_MAX
  ) {
    throw new Error(
      `拡大率は ${IMAGE_SCALE_MIN}〜${IMAGE_SCALE_MAX} にしてください`
    )
  }
}

/** 採点の実行を作る口。アプリでは1つだけ作る（`aiGradingMainServices.ts`） */
export function createGradingJobRunner(dependencies: AiGradingJobDependencies) {
  /** 走っているその場の採点の run と、その中止の口 */
  const activeControllers = new Map<string, AbortController>()

  /**
   * 採点を始める。run と試行（pending）を作って返す。
   *
   * その場の採点は送信を裏で続け、`finished` で終わりを待てる（IPC は待たずに run を返す）。
   * バッチは事業者へ預け終わるまで待つ（預けられなければ投げる）。
   */
  async function startGradingRun(
    input: StartGradingRunInput,
    actorUserId: string
  ) {
    assertValidStartInput(input)
    const prompt = await getAiPrompt(input.promptId)
    if (!prompt) throw new Error("プロンプトが見つかりません")
    const cropRegion = await getCropRegionWithAnswerImages(
      prompt.cropRegionId,
      input.examStudentIds
    )
    if (!cropRegion) throw new Error("設問が見つかりません")
    const answerImagePathByExamStudentId = new Map(
      cropRegion.examPage.studentAnswerImages.map((studentAnswerImage) => [
        studentAnswerImage.examStudentId,
        studentAnswerImage.imagePath,
      ])
    )
    const missingCount = input.examStudentIds.filter(
      (examStudentId) => !answerImagePathByExamStudentId.has(examStudentId)
    ).length
    if (missingCount > 0) {
      throw new Error(`答案画像の無い答案が${missingCount}件含まれています`)
    }

    // 送る前に事業者を決める（同意・キーが無ければここで止まり、何も作らない）
    const provider = dependencies.resolveProvider(input.provider)
    if (input.mode === "batch" && !provider.capabilities.batch) {
      throw new Error("この事業者はバッチに対応していません")
    }

    const points = cropRegion.points
    const { questionImage, modelAnswerImage } = await loadPromptImages({
      prompt,
      cropRegion,
      examPage: cropRegion.examPage,
      imageScale: input.imageScale,
      resolveDataPath: dependencies.resolveDataPath,
    })
    // 朱書きの字数の目安は面積から出すので、用紙の向きは問わない（縦として換算する）
    const paperDimensions = getOrientedPaperDimensions(
      cropRegion.examPage.pageSize,
      false
    )
    const { systemText, fixedParts } = buildGradingRequestParts({
      prompt,
      points,
      questionImage,
      modelAnswerImage,
      annotationCharacterLimit: estimateAnnotationCharacterLimit(
        cropRegion.width * paperDimensions.width,
        cropRegion.height * paperDimensions.height
      ),
    })
    const outputSchema = toJsonSchemaObject(buildGradingOutputSchema())

    const run = await createAiGradingRun(
      {
        userId: actorUserId,
        promptId: prompt.id,
        purpose: "grade",
        templateVersion: AI_GRADING_TEMPLATE_VERSION,
        provider: input.provider,
        model: input.model,
        effort: input.effort,
        mode: input.mode,
        status: input.mode === "batch" ? "submitting" : "in_progress",
        submittedClientId: dependencies.getClientId(),
        imageScale: input.imageScale,
        points,
      },
      input.examStudentIds
    )

    /** 試行1件の依頼を組む（答案の画像を切り出す） */
    const buildRequest = async (attempt: {
      id: string
      examStudentId: string
    }): Promise<GradingRequest> => {
      const answerImagePath = answerImagePathByExamStudentId.get(
        attempt.examStudentId
      )
      if (!answerImagePath) throw new Error("答案画像がありません")
      const crop = await cropRegionForSending(
        dependencies.resolveDataPath(answerImagePath),
        cropRegion,
        { imageScale: input.imageScale }
      )
      return {
        customId: attempt.id,
        model: input.model,
        effort: input.effort,
        maxOutputTokens: GRADING_MAX_OUTPUT_TOKENS,
        systemText,
        fixedParts,
        variableParts: buildGradingVariableParts(toPngPromptImage(crop.png)),
        outputSchema,
      }
    }

    const tracker = createRunProgressTracker({
      runId: run.id,
      cropRegionId: cropRegion.id,
      total: run.attempts.length,
      notifyProgress: dependencies.notifyProgress,
    })

    if (input.mode === "batch") {
      await submitBatchAttempts({
        runId: run.id,
        attempts: run.attempts,
        provider,
        buildRequest,
        tracker,
      })
      return { run: narrowAiGradingRun(run), finished: Promise.resolve() }
    }

    const controller = new AbortController()
    activeControllers.set(run.id, controller)
    const finished = processRealtimeAttempts({
      runId: run.id,
      attempts: run.attempts,
      provider,
      buildRequest,
      tracker,
      controller,
      concurrency: dependencies.getConcurrency(),
      maxPoints: points,
    })
      .catch(async (error: unknown) => {
        console.error("[aiGrading] 採点の実行が途中で失敗しました:", error)
        await closePendingAiGradingAttempts(
          run.id,
          "errored",
          errorMessageOf(error)
        )
        await updateAiGradingRun(run.id, {
          status: "failed",
          endedAt: new Date(),
        })
        tracker.finish("failed")
      })
      .finally(() => activeControllers.delete(run.id))
    return { run: narrowAiGradingRun(run), finished }
  }

  /**
   * 中止する。止められるのは実行した教員だけ。
   *
   * その場の採点は送信中の呼び出しを打ち切り、結果待ちの試行を「中止」で閉じる。
   * バッチは事業者へ取り消しを頼むだけで、取り消された結果は回収（`batchPoller.ts`）が
   * いつもどおり取り込んで閉じる（取り消しの前に終わった判定もそのまま残す）。
   */
  async function cancelRun(runId: string, actorUserId: string): Promise<void> {
    const run = await getAiGradingRunForProcessing(runId)
    if (!run) throw new Error("実行が見つかりません")
    if (run.userId !== actorUserId) {
      throw new Error("中止できるのは実行した教員だけです")
    }
    const controller = activeControllers.get(run.id)
    if (controller) {
      controller.abort()
      return
    }
    if (run.mode === "batch" && run.externalBatchId) {
      if (!isGradingProviderId(run.provider)) {
        throw new Error(`対応していない事業者です: ${run.provider}`)
      }
      await dependencies
        .resolveProvider(run.provider)
        .cancelBatch(run.externalBatchId)
    }
  }

  return { startGradingRun, cancelRun }
}
