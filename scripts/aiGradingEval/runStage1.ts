/**
 * 1段目のプロンプトの案を、開発用の写しで測る（docs/vlm-grading-design.md §12）。
 * 開発者が手で走らせるもので、アプリからは使わない。API には送らず、Claude Code の CLI で測る。
 *
 * 使い方:
 *   npx tsx scripts/aiGradingEval/runStage1.ts \
 *     --db <写しの database.db> --data-dir <写しのフォルダ> --exam <examId> \
 *     --out <scratchpad の出力先> --tag <出力の名前> --model haiku|sonnet \
 *     [--effort low] [--questions 1-1,2-3] [--students 9] [--concurrency 3] \
 *     [--system-file <指示の差し替え>] [--rerun-failed]
 *     [--rubric-file <buildRubricFromStage2.ts の出力>]（項目を送る次の往復の測定）
 *     [--image-scale 1]（送る画像の拡大率。アプリの既定は 1）
 *
 * 出力（すべて --out の下）:
 *   crops/            送る画像（答案の切り出し・模範解答の切り出し）
 *   stage1/<tag>__<model>/records/*.json   マスごとの応答・検証・比べる相手・使用量
 *   stage1/<tag>__<model>/summary.json     指標
 * 記録が既にあるマスは飛ばす（途中で止めても続きから走る）。
 */

import * as fs from "fs"
import * as path from "path"

import { runClaudeCli } from "./claudeCli"
import { loadEvalExamData } from "./devData"
import {
  readArgs,
  readIntegerArg,
  readListArg,
  requireArg,
  resolveOutsideRepository,
  runWithConcurrency,
} from "./evalArgs"
import { ensureCrops } from "./evalCrops"
import { resolveReferenceScore } from "./referenceScore"
import { computeStage1Metrics, type Stage1EvalRecord } from "./stage1Metrics"
import { readRubricFile } from "./rubricFile"
import { buildStage1EvalRequest } from "./stage1Variants"

async function main() {
  const args = readArgs(process.argv.slice(2))
  const dbPath = resolveOutsideRepository(requireArg(args, "db"), "--db ")
  const dataDir = resolveOutsideRepository(
    requireArg(args, "data-dir"),
    "--data-dir "
  )
  const outDir = resolveOutsideRepository(requireArg(args, "out"), "--out ")
  const examId = requireArg(args, "exam")
  const model = requireArg(args, "model")
  const effort = args.get("effort") ?? "low"
  const tag = requireArg(args, "tag")
  const rubricFile = args.get("rubric-file")
  const rubricByQuestion = rubricFile
    ? readRubricFile(resolveOutsideRepository(rubricFile, "--rubric-file "))
    : null
  const concurrency = Math.min(3, readIntegerArg(args, "concurrency", 3))
  const timeoutMs = readIntegerArg(args, "timeout-ms", 240000)
  const systemFile = args.get("system-file")
  const systemTextOverride = systemFile
    ? fs
        .readFileSync(
          resolveOutsideRepository(systemFile, "--system-file "),
          "utf8"
        )
        .trim()
    : null

  const { questions, cells } = loadEvalExamData(dbPath, dataDir, examId)
  const questionLabels = readListArg(args, "questions")
  const selectedQuestions = questions.filter(
    (question) =>
      questionLabels === null || questionLabels.includes(question.label)
  )
  const studentIds = [...new Set(cells.map((cell) => cell.examStudentId))]
    .sort()
    .slice(0, readIntegerArg(args, "students", Number.MAX_SAFE_INTEGER))
  const questionById = new Map(
    selectedQuestions.map((question) => [question.cropRegionId, question])
  )
  const selectedCells = cells
    .filter(
      (cell) =>
        questionById.has(cell.cropRegionId) &&
        studentIds.includes(cell.examStudentId)
    )
    .sort((left, right) =>
      `${left.cropRegionId}${left.examStudentId}`.localeCompare(
        `${right.cropRegionId}${right.examStudentId}`
      )
    )

  const runDir = path.join(outDir, "stage1", `${tag}__${model}`)
  const recordsDir = path.join(runDir, "records")
  fs.mkdirSync(recordsDir, { recursive: true })
  const workDir = path.join(outDir, "cli-work")
  fs.mkdirSync(workDir, { recursive: true })
  const crops = await ensureCrops(
    path.join(outDir, "crops"),
    selectedQuestions,
    selectedCells,
    Number(args.get("image-scale") ?? "1")
  )

  const recordPath = (cropRegionId: string, examStudentId: string) =>
    path.join(recordsDir, `${cropRegionId}__${examStudentId}.json`)
  const readRecord = (filePath: string): Stage1EvalRecord | null => {
    if (!fs.existsSync(filePath)) return null
    const parsed: Stage1EvalRecord = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    )
    return parsed
  }
  const pendingCells = selectedCells.filter((cell) => {
    const existing = readRecord(
      recordPath(cell.cropRegionId, cell.examStudentId)
    )
    return existing === null || (args.has("rerun-failed") && !existing.cliOk)
  })
  console.log(
    `${tag}__${model}: ${selectedCells.length}マス（未実行 ${pendingCells.length}）`
  )

  let doneCount = 0
  await runWithConcurrency(pendingCells, concurrency, async (cell) => {
    const question = questionById.get(cell.cropRegionId)
    if (!question) return
    const request = buildStage1EvalRequest({
      question,
      rubricItems: rubricByQuestion?.[cell.cropRegionId]?.items ?? [],
      modelAnswerImage: crops.masterImage(cell.cropRegionId),
      answerImage: crops.answerImage(cell.cropRegionId, cell.examStudentId),
      systemTextOverride,
    })
    const result = await runClaudeCli({
      ...request,
      model,
      effort,
      timeoutMs,
      workDir,
    })
    const verdict = result.ok
      ? request.readVerdict(result.structuredOutput)
      : null
    const record: Stage1EvalRecord & { structuredOutput: unknown } = {
      cropRegionId: cell.cropRegionId,
      examStudentId: cell.examStudentId,
      label: question.label,
      points: question.points,
      cliOk: result.ok,
      errorText: result.errorText,
      verdict,
      reference: resolveReferenceScore(cell, question.points),
      usage: result.usage,
      costUsd: result.costUsd,
      wallMs: result.wallMs,
      structuredOutput: result.structuredOutput,
    }
    fs.writeFileSync(
      recordPath(cell.cropRegionId, cell.examStudentId),
      JSON.stringify(record, null, 2)
    )
    doneCount += 1
    const utilization = result.rateLimitUtilization
    console.log(
      `[${doneCount}/${pendingCells.length}] ${question.label} ${result.ok ? (verdict?.ok ? verdict.status : "形が外れた") : `失敗: ${result.errorText}`} ` +
        `${(result.wallMs / 1000).toFixed(1)}s 5h=${utilization.fiveHour ?? "-"} 7d=${utilization.sevenDay ?? "-"}`
    )
  })

  const records = selectedCells.flatMap((cell) => {
    const record = readRecord(recordPath(cell.cropRegionId, cell.examStudentId))
    return record ? [record] : []
  })
  const metrics = computeStage1Metrics(records)
  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    JSON.stringify(metrics, null, 2)
  )
  console.log(JSON.stringify(metrics, null, 2))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
