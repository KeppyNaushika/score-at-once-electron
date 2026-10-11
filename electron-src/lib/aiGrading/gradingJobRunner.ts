/**
 * AI 採点の実行（1段目の run）を走らせる（docs/vlm-grading-design.md §3-3・§11 jobRunner）。
 *
 * - 対象の答案（examStudentId）は renderer が選んで明示的に渡す。選び方はここに無い
 * - 1段目は答案ごとに、判定・読み取り・所見・当てはまる項目・確信度を返させる。
 *   その設問のルーブリック項目を文にしてプロンプトに入れ、送った文をプロンプトの行に写す
 *   （今の項目と違えば新しい行を作る。§3-1）。教員が問いかけの「その他」に書いた指示も添える
 * - その場の採点（realtime）: 同時実行数を絞って1件ずつ送り、結果が届くたびに試行へ書いて
 *   進み具合を押し出す。run ごとに AbortController を持ち、中止できる。最後まで送れたら
 *   **そのまま2段目（項目の案）を続ける**（`groupingRunner.ts`）
 * - バッチ（batch）: まとめて事業者へ預け、回収は `batchPoller.ts` が行う（回収したら2段目を続ける）
 * - 採点チェック（purpose: check）: 採点済みの答案を1段目だけで判定させる。**教員の点は送らない**
 *   （送るのは採点のときと同じプロンプトと答案の画像だけ）。比べるのは画面の側で、2段目は続けない
 *
 * 認証・権限の失敗は、どの答案でも同じ結果になるので run 全体を止める。
 */

import { buildGradingVariableParts } from "@/lib/shared/aiGrading/promptBuilder"
import {
  buildStage1OutputSchema,
  buildStage1RequestParts,
  STAGE1_TEMPLATE_VERSION,
} from "@/lib/shared/aiGrading/stage1Grading"
import type {
  AiGradingRunMode,
  AiGradingStage1Purpose,
} from "@/types/aiGrading.types"
import { isAiGradingRunMode, isStage1RunPurpose } from "@/types/aiGrading.types"

import {
  closePendingAiGradingAttempts,
  createAiGradingRun,
  getAiGradingRunForProcessing,
  narrowAiGradingRun,
  updateAiGradingRun,
} from "../prisma/aiGradingRun"
import { getCropRegionWithAnswerImages } from "../prisma/aiGradingSource"
import {
  ensurePromptRendersRubricItems,
  getAiPrompt,
  readRubricItemsForPrompt,
} from "../prisma/aiPrompt"
import { listTeacherInstructions } from "../prisma/aiRubricProposal"
import { cropRegionForSending } from "./answerImage"
import {
  GRADING_MAX_OUTPUT_TOKENS,
  loadPromptImages,
  STAGE1_OUTPUT_SCHEMA_NAME,
  toJsonSchemaObject,
  toPngPromptImage,
} from "./gradingRequestFactory"
import {
  errorMessageOf,
  processRealtimeAttempts,
  submitBatchAttempts,
} from "./gradingRunExecution"
import { createGroupingRunner } from "./groupingRunner"
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
  /** 採点（grade。終われば2段目が続く）か、採点チェック（check。1段目だけ） */
  purpose: AiGradingStage1Purpose
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
  if (!isStage1RunPurpose(input.purpose)) {
    throw new Error(
      `実行の目的の値が正しくありません: ${String(input.purpose)}`
    )
  }
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

/**
 * 開始の処理中の実行を見分けるキー。同じ教員が、同じプロンプト（＝同じ設問）で、
 * 同じ答案の組を送ろうとしているか（答案の並び順は問わない）
 */
function startingRunKeyOf(
  input: StartGradingRunInput,
  actorUserId: string
): string {
  return JSON.stringify([
    actorUserId,
    input.purpose,
    input.promptId,
    [...input.examStudentIds].sort(),
  ])
}

/**
 * 採点の実行を作る口。アプリでは1つだけ作る（`aiGradingMainServices.ts`）。
 * 2段目の口はバッチの回収と共有する（同じ1段目から2段目を2つ同時に作らないため）
 */
export function createGradingJobRunner(
  dependencies: AiGradingJobDependencies,
  groupingRunner: ReturnType<
    typeof createGroupingRunner
  > = createGroupingRunner(dependencies)
) {
  /** 走っているその場の採点の run と、その中止の口 */
  const activeControllers = new Map<string, AbortController>()
  /**
   * 開始の処理中（受け付けてから run を返すまで。バッチは預け終えるまで）の実行のキー。
   * ダブルクリックなどで同じ実行が2重に始まり、外部へ2回送って費用が2倍になるのを防ぐ
   */
  const startingRunKeys = new Set<string>()

  /**
   * 採点を始める。run と試行（pending）を作って返す。
   *
   * その場の採点は送信を裏で続け、`finished` で終わりを待てる（IPC は待たずに run を返す）。
   * バッチは事業者へ預け終わるまで待つ（預けられなければ投げる）。
   *
   * 同じ教員・同じプロンプト・同じ答案の組の実行が開始の処理中なら、2つ目は拒む
   * （同じ run を返すと、画面は2回送ったように見えるうえ、2つ目の呼び出しの設定が黙って
   * 捨てられる）。開始の処理が終われば（成功でも失敗でも）、同じ組でも再び始められる。
   */
  async function startGradingRun(
    input: StartGradingRunInput,
    actorUserId: string
  ) {
    assertValidStartInput(input)
    // 最初の await より前に、同期的に印を付ける（2つ目の呼び出しがここを通る前に閉じる）
    const startingRunKey = startingRunKeyOf(input, actorUserId)
    if (startingRunKeys.has(startingRunKey)) {
      throw new Error(
        "同じ答案の AI 採点を始めているところです。2重に送らないよう、この実行は受け付けませんでした"
      )
    }
    startingRunKeys.add(startingRunKey)
    try {
      return await launchGradingRun(input, actorUserId)
    } finally {
      startingRunKeys.delete(startingRunKey)
    }
  }

  /** 採点の run を作って送り始める（入力の検証と2重の防止は `startGradingRun`） */
  async function launchGradingRun(
    input: StartGradingRunInput,
    actorUserId: string
  ) {
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
    const { questionImages, modelAnswerImage } = await loadPromptImages({
      prompt,
      cropRegion,
      examPage: cropRegion.examPage,
      imageScale: input.imageScale,
      resolveDataPath: dependencies.resolveDataPath,
    })
    const { rubricItems, renderedRubricItems } = await readRubricItemsForPrompt(
      cropRegion.id
    )
    const rubricItemIds = rubricItems.map((rubricItem) => rubricItem.id)
    const teacherInstructions = await listTeacherInstructions(
      cropRegion.id,
      actorUserId
    )
    const { systemText, fixedParts } = buildStage1RequestParts({
      prompt,
      points,
      questionImages,
      modelAnswerImage,
      rubricItems,
      teacherInstructions,
    })
    const outputSchema = toJsonSchemaObject(
      buildStage1OutputSchema(rubricItemIds)
    )
    // 送る項目の一覧の文をプロンプトの行に写す（違えば新しい行。送った文面を再現できるように）
    const sendingPrompt = await ensurePromptRendersRubricItems(
      prompt,
      renderedRubricItems,
      actorUserId
    )

    const run = await createAiGradingRun(
      {
        userId: actorUserId,
        promptId: sendingPrompt.id,
        purpose: input.purpose,
        templateVersion: STAGE1_TEMPLATE_VERSION,
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
        outputSchemaName: STAGE1_OUTPUT_SCHEMA_NAME,
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
      validationContext: { maxPoints: points, rubricItemIds },
    })
      .then(async (status) => {
        activeControllers.delete(run.id)
        // 最後まで送れたら、そのまま2段目（項目の案）を続ける。中止・失敗と、採点チェックでは続けない
        if (status === "ended" && input.purpose === "grade") {
          await groupingRunner.runGroupingAfterGrading(run.id, actorUserId)
        }
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
    if (groupingRunner.cancelGrouping(run.id)) return
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

  /**
   * 1段目の実行から2段目（項目の案）を作り直す（自動で続けた2段目が失敗したとき）。
   * 終わるまで待って、2段目の run を返す（送れる判定が無ければ null）
   */
  async function startGroupingRun(gradeRunId: string, actorUserId: string) {
    return groupingRunner.runGrouping(gradeRunId, actorUserId)
  }

  return { startGradingRun, cancelRun, startGroupingRun }
}
