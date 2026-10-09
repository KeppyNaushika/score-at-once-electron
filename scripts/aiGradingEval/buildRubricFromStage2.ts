/**
 * 2段目の案を、ルーブリック項目にする（次の往復の測定の準備。docs/vlm-grading-design.md §3-6・§12）。
 * 開発者が手で走らせるもので、アプリからは使わない。外部へは何も送らない。
 *
 * 教員が問いかけで「推奨の選択肢」を選んだとみなして、案ごとに項目を1つ作る
 * （id は uuidv4。名前は案の名前、効き方は推奨の選択肢）。項目ごとに、2段目がその案に入れた
 * 答案（ExamStudent の uuid）も持つ。氏名は扱わない。
 *
 * 使い方:
 *   npx tsx scripts/aiGradingEval/buildRubricFromStage2.ts \
 *     --stage2-run <runStage2 の出力の stage2/<tag>__<model>> \
 *     --stage1-run <その2段目の元の stage1/<tag>__<model>> --out <scratchpad の JSON>
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import type { ValidatedStage2Proposal } from "../../src/lib/shared/aiGrading/stage2ResponseValidator"
import { toRubricItemForPrompt } from "../../src/lib/shared/aiGrading/rubricItemsText"

import { readArgs, requireArg, resolveOutsideRepository } from "./evalArgs"
import type { RubricFile } from "./rubricFile"
import type { Stage1EvalRecord } from "./stage1Metrics"

/** runStage2 が設問ごとに書く JSON のうち、ここで読むもの */
interface Stage2QuestionDetail {
  label: string
  answerKeyToExamStudentId: Record<string, string>
  validation: { ok: boolean; proposals?: ValidatedStage2Proposal[] } | null
}

function main() {
  const args = readArgs(process.argv.slice(2))
  const stage2RunDir = resolveOutsideRepository(
    requireArg(args, "stage2-run"),
    "--stage2-run "
  )
  const stage1RunDir = resolveOutsideRepository(
    requireArg(args, "stage1-run"),
    "--stage1-run "
  )
  const outPath = resolveOutsideRepository(requireArg(args, "out"), "--out ")

  const recordsDir = path.join(stage1RunDir, "records")
  const questionByLabel = new Map<
    string,
    { cropRegionId: string; points: number | null }
  >()
  fs.readdirSync(recordsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .forEach((fileName) => {
      const record: Stage1EvalRecord = JSON.parse(
        fs.readFileSync(path.join(recordsDir, fileName), "utf8")
      )
      questionByLabel.set(record.label, {
        cropRegionId: record.cropRegionId,
        points: record.points,
      })
    })

  const rubricFile: RubricFile = {}
  let skipped = 0
  fs.readdirSync(stage2RunDir)
    .filter(
      (fileName) => fileName.endsWith(".json") && fileName !== "summary.json"
    )
    .forEach((fileName) => {
      const detail: Stage2QuestionDetail = JSON.parse(
        fs.readFileSync(path.join(stage2RunDir, fileName), "utf8")
      )
      const question = questionByLabel.get(detail.label)
      const proposals = detail.validation?.ok
        ? (detail.validation.proposals ?? [])
        : null
      if (!question || proposals === null) {
        skipped += 1
        return
      }
      const memberExamStudentIds: Record<string, string[]> = {}
      const items = proposals.flatMap((proposal) => {
        const recommended = proposal.options.find(
          (option) => option.recommended
        )
        if (!recommended) return []
        const id = crypto.randomUUID()
        memberExamStudentIds[id] = proposal.memberAnswerKeys.flatMap(
          (answerKey) => {
            const examStudentId = detail.answerKeyToExamStudentId[answerKey]
            return examStudentId ? [examStudentId] : []
          }
        )
        return [
          toRubricItemForPrompt({
            id,
            label: proposal.label,
            effectKind: recommended.effectKind,
            pointDelta: recommended.pointDelta,
            setStatus: recommended.setStatus,
            setScore: recommended.setScore,
          }),
        ]
      })
      rubricFile[question.cropRegionId] = {
        label: detail.label,
        points: question.points,
        items,
        memberExamStudentIds,
      }
    })

  fs.writeFileSync(outPath, JSON.stringify(rubricFile, null, 2))
  const itemCount = Object.values(rubricFile).reduce(
    (acc, question) => acc + question.items.length,
    0
  )
  console.log(
    `設問 ${Object.keys(rubricFile).length}（2段目が外れて飛ばした設問 ${skipped}）・項目 ${itemCount}`
  )
}

main()
