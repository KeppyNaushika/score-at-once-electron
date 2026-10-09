/**
 * 2段目のプロンプトの案を、1段目の評価の記録から測る（docs/vlm-grading-design.md §12）。
 * 開発者が手で走らせるもので、アプリからは使わない。画像は送らない。
 *
 * 使い方:
 *   npx tsx scripts/aiGradingEval/runStage2.ts \
 *     --stage1-run <runStage1 の出力の stage1/<tag>__<model>> --out <scratchpad の出力先> \
 *     --model haiku|sonnet [--effort low] [--questions 1-1,2-3] [--tag <出力の名前>] \
 *     [--system-file <指示の差し替え>] [--concurrency 3]
 *
 * 出力（--out/stage2/<tag>__<model>/ の下）: 設問ごとの JSON（送った答案の番号と
 * ExamStudent の対応・応答・検証・指標）と読みやすい文の報告、全体の summary.json。
 * 氏名は扱わない（答案は仮の番号と ExamStudent の uuid だけ）。
 */

import * as fs from "fs"
import * as path from "path"

import { runClaudeCli } from "./claudeCli"
import {
  readArgs,
  readIntegerArg,
  readListArg,
  requireArg,
  resolveOutsideRepository,
  runWithConcurrency,
} from "./evalArgs"
import type { Stage1EvalRecord } from "./stage1Metrics"
import { runStage2Question, type Stage2QuestionReport } from "./stage2Question"

async function main() {
  const args = readArgs(process.argv.slice(2))
  const stage1RunDir = resolveOutsideRepository(
    requireArg(args, "stage1-run"),
    "--stage1-run "
  )
  const outDir = resolveOutsideRepository(requireArg(args, "out"), "--out ")
  const model = requireArg(args, "model")
  const effort = args.get("effort") ?? "low"
  const tag = args.get("tag") ?? path.basename(stage1RunDir)
  const systemFile = args.get("system-file")
  const systemTextOverride = systemFile
    ? fs
        .readFileSync(
          resolveOutsideRepository(systemFile, "--system-file "),
          "utf8"
        )
        .trim()
    : null
  const questionLabels = readListArg(args, "questions")

  const recordsDir = path.join(stage1RunDir, "records")
  const records: Stage1EvalRecord[] = fs
    .readdirSync(recordsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) =>
      JSON.parse(fs.readFileSync(path.join(recordsDir, fileName), "utf8"))
    )
  const recordsByQuestion = records.reduce<Map<string, Stage1EvalRecord[]>>(
    (acc, record) => {
      if (questionLabels !== null && !questionLabels.includes(record.label))
        return acc
      return acc.set(record.cropRegionId, [
        ...(acc.get(record.cropRegionId) ?? []),
        record,
      ])
    },
    new Map()
  )

  const runDir = path.join(outDir, "stage2", `${tag}__${model}`)
  fs.mkdirSync(runDir, { recursive: true })
  const workDir = path.join(outDir, "cli-work")
  fs.mkdirSync(workDir, { recursive: true })

  const reports: Stage2QuestionReport[] = []
  const questionGroups = [...recordsByQuestion.values()]
  await runWithConcurrency(
    questionGroups,
    Math.min(3, readIntegerArg(args, "concurrency", 3)),
    async (questionRecords) => {
      const report = await runStage2Question({
        records: questionRecords,
        systemTextOverride,
        runCli: (request) =>
          runClaudeCli({
            ...request,
            model,
            effort,
            timeoutMs: readIntegerArg(args, "timeout-ms", 300000),
            workDir,
          }),
      })
      reports.push(report)
      fs.writeFileSync(
        path.join(runDir, `${report.label}.json`),
        JSON.stringify(report.detail, null, 2)
      )
      fs.writeFileSync(
        path.join(runDir, `${report.label}.txt`),
        report.readable
      )
      console.log(`${report.label}: ${report.summaryLine}`)
    }
  )

  const ordered = reports.sort((left, right) =>
    left.label.localeCompare(right.label, "ja", { numeric: true })
  )
  const summary = {
    questions: ordered.length,
    validated: ordered.filter((report) => report.metrics !== null).length,
    totalCostUsd: ordered.reduce((acc, report) => acc + report.costUsd, 0),
    meanWallMs:
      ordered.reduce((acc, report) => acc + report.wallMs, 0) /
      Math.max(1, ordered.length),
    perQuestion: ordered.map((report) => ({
      label: report.label,
      metrics: report.metrics,
      reasons: report.reasons,
      costUsd: report.costUsd,
      wallMs: report.wallMs,
    })),
  }
  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    JSON.stringify(summary, null, 2)
  )
  console.log(JSON.stringify({ ...summary, perQuestion: undefined }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
