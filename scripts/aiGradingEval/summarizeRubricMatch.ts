/**
 * 項目を送った1段目の記録から、当てはまりの指標を求める（`rubricMatchMetrics.ts`）。
 * 開発者が手で走らせるもので、外部へは何も送らない。
 *
 * 使い方:
 *   npx tsx scripts/aiGradingEval/summarizeRubricMatch.ts \
 *     --stage1-run <runStage1 --rubric-file の出力の stage1/<tag>__<model>> \
 *     --rubric-file <buildRubricFromStage2.ts の出力>
 * 結果は --stage1-run の下の rubric-match.json と標準出力へ。
 */

import * as fs from "fs"
import * as path from "path"

import { readArgs, requireArg, resolveOutsideRepository } from "./evalArgs"
import { readRubricFile } from "./rubricFile"
import {
  computeRubricMatchMetrics,
  type RubricMatchQuestion,
} from "./rubricMatchMetrics"
import type { Stage1EvalRecord } from "./stage1Metrics"

function main() {
  const args = readArgs(process.argv.slice(2))
  const stage1RunDir = resolveOutsideRepository(
    requireArg(args, "stage1-run"),
    "--stage1-run "
  )
  const rubricFile = readRubricFile(
    resolveOutsideRepository(requireArg(args, "rubric-file"), "--rubric-file ")
  )
  const recordsDir = path.join(stage1RunDir, "records")
  const records: Stage1EvalRecord[] = fs
    .readdirSync(recordsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) =>
      JSON.parse(fs.readFileSync(path.join(recordsDir, fileName), "utf8"))
    )

  const questions: RubricMatchQuestion[] = Object.entries(rubricFile).map(
    ([cropRegionId, question]) => ({
      points: question.points,
      items: question.items,
      cells: records.flatMap((record) => {
        if (record.cropRegionId !== cropRegionId || !record.verdict?.ok) {
          return []
        }
        const referenceStatus =
          record.reference.kind === "decided" ||
          record.reference.kind === "agreed"
            ? record.reference.verdict.status
            : null
        return [
          {
            matchedItemIds: record.verdict.matchedRubricItemIds ?? [],
            expectedItemIds: question.items
              .filter((item) =>
                (question.memberExamStudentIds[item.id] ?? []).includes(
                  record.examStudentId
                )
              )
              .map((item) => item.id),
            aiStatus: record.verdict.status,
            referenceStatus,
          },
        ]
      }),
    })
  )
  const metrics = computeRubricMatchMetrics(questions)
  fs.writeFileSync(
    path.join(stage1RunDir, "rubric-match.json"),
    JSON.stringify(metrics, null, 2)
  )
  console.log(JSON.stringify(metrics, null, 2))
}

main()
