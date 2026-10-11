/**
 * 1つの設問について、1段目の記録から2段目を1回走らせ、検証して指標を求める。
 */

import {
  buildStage2OutputSchema,
  buildStage2RequestParts,
  type Stage2AnswerInput,
} from "../../src/lib/shared/aiGrading/stage2Grouping"
import { validateStage2Response } from "../../src/lib/shared/aiGrading/stage2ResponseValidator"
import { toJsonSchemaObject } from "../../electron-src/lib/aiGrading/gradingRequestFactory"
import type {
  JsonObject,
  PromptPart,
} from "../../electron-src/lib/aiGrading/providers/types"

import type { ClaudeCliResult } from "./claudeCli"
import type { Stage1EvalRecord } from "./stage1Metrics"
import { computeStage2Metrics, type Stage2Metrics } from "./stage2Metrics"

export interface Stage2QuestionReport {
  label: string
  metrics: Stage2Metrics | null
  reasons: readonly string[]
  costUsd: number
  wallMs: number
  summaryLine: string
  readable: string
  detail: unknown
}

type CliRunner = (request: {
  systemText: string
  parts: PromptPart[]
  schema: JsonObject
}) => Promise<ClaudeCliResult>

const EMPTY_PROMPT = {
  questionText: "",
  modelAnswerText: "",
  rubricText: "",
  annotationInstruction: "",
}

function referenceStatusOf(record: Stage1EvalRecord): string | null {
  return record.reference.kind === "decided" ||
    record.reference.kind === "agreed"
    ? record.reference.verdict.status
    : null
}

export async function runStage2Question(input: {
  records: readonly Stage1EvalRecord[]
  systemTextOverride: string | null
  runCli: CliRunner
}): Promise<Stage2QuestionReport> {
  const usable = input.records
    .flatMap((record) =>
      record.verdict?.ok ? [{ record, verdict: record.verdict }] : []
    )
    .sort((left, right) =>
      left.record.examStudentId.localeCompare(right.record.examStudentId)
    )
  const [first] = input.records
  const label = first.label
  const points = first.points
  const answers: Stage2AnswerInput[] = usable.map(({ verdict }) => ({
    status: verdict.status,
    partialScore: verdict.partialScore,
    confidence: verdict.confidence,
    transcription: verdict.transcription,
    observation: verdict.observation,
    matchedRubricItemIds: [],
  }))
  const { systemText, fixedParts, answerKeys } = buildStage2RequestParts({
    prompt: EMPTY_PROMPT,
    points,
    rubricItems: [],
    answers,
  })
  const result = await input.runCli({
    systemText: input.systemTextOverride ?? systemText,
    parts: fixedParts,
    schema: toJsonSchemaObject(buildStage2OutputSchema(answerKeys)),
  })
  const validation = result.ok
    ? validateStage2Response(result.structuredOutput, {
        maxPoints: points,
        rubricItemIds: [],
        answers,
      })
    : null

  const metricAnswers = usable.map(({ record, verdict }, answerIndex) => ({
    answerKey: answerKeys[answerIndex],
    referenceStatus: referenceStatusOf(record),
    aiStatus: verdict.status,
    transcription: verdict.transcription,
  }))
  const metrics = validation?.ok
    ? computeStage2Metrics({
        answers: metricAnswers,
        proposals: validation.proposals.map((proposal) => ({
          memberAnswerKeys: proposal.memberAnswerKeys,
          recommendedSetStatus:
            proposal.options.find(
              (option) => option.recommended && option.effectKind === "set"
            )?.setStatus ?? null,
        })),
        uncoveredAnswerKeys: validation.uncoveredAnswerKeys,
      })
    : null
  const reasons = !result.ok
    ? [result.errorText]
    : validation && !validation.ok
      ? validation.reasons
      : []

  const answerLines = metricAnswers.map(
    (answer, answerIndex) =>
      `[${answer.answerKey}] 教員=${answer.referenceStatus ?? "割れ/無し"} AI=${answer.aiStatus} 読み取り=${answers[answerIndex].transcription} ／ 所見=${answers[answerIndex].observation}`
  )
  const proposalLines = validation?.ok
    ? validation.proposals.map(
        (proposal) =>
          `- ${proposal.label} [${proposal.memberAnswerKeys.join(",")}] 助言=「${proposal.adviceDraft}」\n  ${proposal.description}\n  ` +
          proposal.options
            .map(
              (option) =>
                `${option.recommended ? "★" : ""}${option.effectKind === "adjust" ? `${option.pointDelta}点` : `${option.setStatus}${option.setScore === null ? "" : `(${option.setScore})`}`}: ${option.rationale}`
            )
            .join(" ／ ")
      )
    : [`（検証で外れた: ${reasons.join(" / ")}）`]
  const readable = [
    `# ${label}（配点 ${points ?? "なし"}）`,
    ...answerLines,
    "",
    "## 案",
    ...proposalLines,
    "",
    `notes: ${validation?.ok ? validation.notes : ""}`,
    `取りこぼし: ${validation?.ok ? validation.uncoveredAnswerKeys.join(",") : ""}`,
  ].join("\n")

  return {
    label,
    metrics,
    reasons,
    costUsd: result.costUsd,
    wallMs: result.wallMs,
    summaryLine: metrics
      ? `案${metrics.proposalCount} 取りこぼし${metrics.uncoveredCount} 純度${metrics.purity?.toFixed(2)} ${(result.wallMs / 1000).toFixed(1)}s`
      : `外れた: ${reasons.join(" / ").slice(0, 200)}`,
    readable,
    detail: {
      label,
      answerKeyToExamStudentId: Object.fromEntries(
        usable.map(({ record }, answerIndex) => [
          answerKeys[answerIndex],
          record.examStudentId,
        ])
      ),
      structuredOutput: result.structuredOutput,
      validation,
      metrics,
      usage: result.usage,
      costUsd: result.costUsd,
      wallMs: result.wallMs,
    },
  }
}
