/**
 * 2段目（1段目の結果から項目の案を作る）の実行（docs/vlm-grading-design.md §3-4・§7-1）。
 *
 * 1段目の実行1つ（purpose: grade）の、判定が出た試行の読み取り・所見・判定を、画像を付けずに
 * 1回で送る。答案は仮の番号（A1, A2, …）で送り、生徒の氏名も試行の id も送らない。
 * 返ってきた案は検証してから、仮の番号を試行の id へ戻して書く（`aiRubricProposal.ts`）。
 *
 * 1段目が終わると自動で続ける（その場の採点は終わった直後、バッチは回収した直後。
 * `gradingJobRunner.ts`・`batchPoller.ts`）。失敗した2段目は画面から送り直せる。
 * 2段目の run は文字だけの1件の依頼なので、送り方は常にその場（realtime）で、使用量は
 * run の列に書く。
 */

import { isAiGradingOutputStatus } from "@/lib/shared/aiGrading/responseRules"
import {
  buildStage2OutputSchema,
  buildStage2RequestParts,
  STAGE2_TEMPLATE_VERSION,
  type Stage2AnswerInput,
} from "@/lib/shared/aiGrading/stage2Grouping"
import { validateStage2Response } from "@/lib/shared/aiGrading/stage2ResponseValidator"
import { toAiGradingConfidence } from "@/types/aiGrading.types"

import {
  createAiGradingRun,
  getAiGradingRunForProcessing,
  narrowAiGradingRun,
  updateAiGradingRun,
} from "../prisma/aiGradingRun"
import { readRubricItemsForPrompt } from "../prisma/aiPrompt"
import { recordAiRubricProposals } from "../prisma/aiRubricProposal"
import {
  GROUPING_MAX_OUTPUT_TOKENS,
  STAGE2_OUTPUT_SCHEMA_NAME,
  toJsonSchemaObject,
} from "./gradingRequestFactory"
import { errorMessageOf } from "./gradingRunExecution"
import type { AiGradingJobDependencies } from "./jobDependencies"
import { isGradingEffort, isGradingProviderId } from "./providers/types"
import { createRunProgressTracker } from "./runProgressTracker"

/** 1段目の実行の、2段目へ送れる試行（判定が出たもの）。この並びで仮の番号 A1, A2, … を振る */
function collectStage2Answers(
  attempts: NonNullable<
    Awaited<ReturnType<typeof getAiGradingRunForProcessing>>
  >["attempts"],
  livingRubricItemIds: ReadonlySet<string>
) {
  return attempts.flatMap((attempt) => {
    if (attempt.state !== "succeeded") return []
    if (!isAiGradingOutputStatus(attempt.status)) return []
    const answer: Stage2AnswerInput = {
      status: attempt.status,
      partialScore:
        attempt.partialScore === null ? null : attempt.partialScore.toNumber(),
      confidence: toAiGradingConfidence(attempt.confidence),
      transcription: attempt.transcription,
      observation: attempt.observation,
      matchedRubricItemIds: attempt.rubricMatches
        .map((match) => match.rubricItemId)
        .filter((rubricItemId) => livingRubricItemIds.has(rubricItemId)),
    }
    return [{ attemptId: attempt.id, answer }]
  })
}

export function createGroupingRunner(dependencies: AiGradingJobDependencies) {
  /** 走っている2段目の run と、その中止の口 */
  const activeControllers = new Map<string, AbortController>()
  /** 2段目を作っている途中の1段目の run（同じ1段目から2つ同時に作らない） */
  const groupingGradeRunIds = new Set<string>()

  /**
   * 1段目の実行から2段目を走らせ、終わるまで待つ。2段目の run を返す
   * （送れる試行が無ければ何もせず null）。
   *
   * 送り先は1段目と同じ事業者・モデル・手間。失敗は run の状態（failed）に残して投げない
   * （事業者を用意できない・入力が正しくないときだけ投げる）
   */
  async function runGrouping(gradeRunId: string, actorUserId: string) {
    if (groupingGradeRunIds.has(gradeRunId)) {
      throw new Error("この AI 採点の項目の案を作っているところです")
    }
    groupingGradeRunIds.add(gradeRunId)
    try {
      return await launchGrouping(gradeRunId, actorUserId)
    } finally {
      groupingGradeRunIds.delete(gradeRunId)
    }
  }

  async function launchGrouping(gradeRunId: string, actorUserId: string) {
    const gradeRun = await getAiGradingRunForProcessing(gradeRunId)
    if (!gradeRun) throw new Error("実行が見つかりません")
    if (gradeRun.userId !== actorUserId) {
      throw new Error("項目の案を作れるのは、AI 採点を実行した教員だけです")
    }
    if (gradeRun.purpose !== "grade") {
      throw new Error("項目の案は、答案ごとの判定の実行から作ります")
    }
    if (!isGradingProviderId(gradeRun.provider)) {
      throw new Error(`対応していない事業者です: ${gradeRun.provider}`)
    }
    if (!isGradingEffort(gradeRun.effort)) {
      throw new Error(`effort の値が正しくありません: ${gradeRun.effort}`)
    }
    const { prompt } = gradeRun
    const { rubricItems } = await readRubricItemsForPrompt(prompt.cropRegionId)
    const rubricItemIds = rubricItems.map((rubricItem) => rubricItem.id)
    const usable = collectStage2Answers(
      gradeRun.attempts,
      new Set(rubricItemIds)
    )
    if (usable.length === 0) return null

    // 送る前に事業者を決める（同意・キーが無ければここで止まり、何も作らない）
    const provider = dependencies.resolveProvider(gradeRun.provider)
    const points = gradeRun.points === null ? null : gradeRun.points.toNumber()
    const answers = usable.map(({ answer }) => answer)
    const { systemText, fixedParts, answerKeys } = buildStage2RequestParts({
      prompt,
      points,
      rubricItems,
      answers,
    })
    const attemptIdByAnswerKey = new Map(
      answerKeys.map((answerKey, answerIndex) => [
        answerKey,
        usable[answerIndex].attemptId,
      ])
    )

    const run = await createAiGradingRun(
      {
        userId: actorUserId,
        promptId: prompt.id,
        purpose: "group",
        templateVersion: STAGE2_TEMPLATE_VERSION,
        provider: gradeRun.provider,
        model: gradeRun.model,
        effort: gradeRun.effort,
        mode: "realtime",
        status: "in_progress",
        submittedClientId: dependencies.getClientId(),
        imageScale: gradeRun.imageScale,
        points,
      },
      []
    )
    const tracker = createRunProgressTracker({
      runId: run.id,
      cropRegionId: prompt.cropRegionId,
      total: 1,
      notifyProgress: dependencies.notifyProgress,
    })
    tracker.update("in_progress")

    const controller = new AbortController()
    activeControllers.set(run.id, controller)
    try {
      const response = await provider.grade(
        {
          customId: run.id,
          model: gradeRun.model,
          effort: gradeRun.effort,
          maxOutputTokens: GROUPING_MAX_OUTPUT_TOKENS,
          systemText,
          fixedParts,
          variableParts: [],
          outputSchema: toJsonSchemaObject(buildStage2OutputSchema(answerKeys)),
          outputSchemaName: STAGE2_OUTPUT_SCHEMA_NAME,
        },
        controller.signal
      )
      const usage = response.usage
      const validation =
        response.stop === "completed"
          ? validateStage2Response(response.parsedJson, {
              maxPoints: points,
              rubricItemIds,
              answers,
            })
          : null
      if (validation?.ok) {
        await recordAiRubricProposals(
          run.id,
          validation.proposals,
          attemptIdByAnswerKey
        )
      } else {
        console.warn(
          "[aiGrading] 項目の案を受け取れませんでした:",
          validation ? validation.reasons.join(" / ") : response.errorMessage
        )
      }
      const status = validation?.ok ? "ended" : "failed"
      await updateAiGradingRun(run.id, {
        status,
        endedAt: new Date(),
        notes: validation?.ok ? validation.notes : "",
        ...usage,
      })
      tracker.record(validation?.ok ? "succeeded" : "errored")
      tracker.finish(status)
    } catch (error) {
      const status = controller.signal.aborted ? "canceled" : "failed"
      if (status === "failed") {
        console.warn("[aiGrading] 項目の案を作れませんでした:", error)
      }
      await updateAiGradingRun(run.id, { status, endedAt: new Date() })
      tracker.finish(status)
    } finally {
      activeControllers.delete(run.id)
    }
    const finished = await getAiGradingRunForProcessing(run.id)
    return finished ? narrowAiGradingRun(finished) : null
  }

  /** 走っている2段目を止める。止めたら true（その run が走っていなければ false） */
  function cancelGrouping(runId: string): boolean {
    const controller = activeControllers.get(runId)
    if (!controller) return false
    controller.abort()
    return true
  }

  /**
   * 1段目の直後に自動で続けるときの口。失敗は記録だけ残し、呼び出し側（1段目の後始末）へは
   * 投げない
   */
  async function runGroupingAfterGrading(
    gradeRunId: string,
    actorUserId: string
  ): Promise<void> {
    try {
      await runGrouping(gradeRunId, actorUserId)
    } catch (error) {
      console.warn(
        `[aiGrading] 項目の案の作成を始められませんでした: ${errorMessageOf(error)}`
      )
    }
  }

  return { runGrouping, runGroupingAfterGrading, cancelGrouping }
}
