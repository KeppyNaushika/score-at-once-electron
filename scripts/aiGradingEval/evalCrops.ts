/**
 * 送る画像を切り出して、出力先（scratchpad）に置く。
 *
 * 切り出しはアプリの送信と同じ `cropRegionForSending`（余白 0.008・原寸）を使う。
 * 一度切り出した画像は使い回す。ファイル名は採点枠と ExamStudent の uuid だけで、氏名を含めない。
 */

import * as fs from "fs"
import * as path from "path"

import { cropRegionForSending } from "../../electron-src/lib/aiGrading/answerImage"
import type { PromptImage } from "../../src/lib/shared/aiGrading/promptBuilder"

import type { EvalCell, EvalQuestion } from "./devData"

export interface EvalCrops {
  answerImage: (cropRegionId: string, examStudentId: string) => PromptImage
  masterImage: (cropRegionId: string) => PromptImage | null
}

const toPromptImage = (png: Buffer): PromptImage => ({
  mediaType: "image/png",
  base64Data: png.toString("base64"),
})

async function cropOnce(
  outputPath: string,
  sourcePath: string,
  rect: EvalQuestion["rect"],
  imageScale: number
): Promise<void> {
  if (fs.existsSync(outputPath)) return
  const crop = await cropRegionForSending(sourcePath, rect, { imageScale })
  fs.writeFileSync(outputPath, crop.png)
}

/** 選んだ設問・マスの画像をそろえる */
export async function ensureCrops(
  cropsDir: string,
  questions: readonly EvalQuestion[],
  cells: readonly EvalCell[],
  /** 拡大率（アプリの既定は 1。拡大の効き目を測るときだけ変える） */
  imageScale: number
): Promise<EvalCrops> {
  const scaleSuffix = imageScale === 1 ? "" : `-x${imageScale}`
  const answersDir = path.join(cropsDir, `answers${scaleSuffix}`)
  const mastersDir = path.join(cropsDir, `masters${scaleSuffix}`)
  fs.mkdirSync(answersDir, { recursive: true })
  fs.mkdirSync(mastersDir, { recursive: true })
  const questionById = new Map(
    questions.map((question) => [question.cropRegionId, question])
  )
  const answerPath = (cropRegionId: string, examStudentId: string) =>
    path.join(answersDir, `${cropRegionId}__${examStudentId}.png`)
  const masterPath = (cropRegionId: string) =>
    path.join(mastersDir, `${cropRegionId}.png`)

  for (const question of questions) {
    if (question.masterImagePath) {
      await cropOnce(
        masterPath(question.cropRegionId),
        question.masterImagePath,
        question.rect,
        imageScale
      )
    }
  }
  for (const cell of cells) {
    const question = questionById.get(cell.cropRegionId)
    if (question) {
      await cropOnce(
        answerPath(cell.cropRegionId, cell.examStudentId),
        cell.answerImagePath,
        question.rect,
        imageScale
      )
    }
  }

  return {
    answerImage: (cropRegionId, examStudentId) =>
      toPromptImage(fs.readFileSync(answerPath(cropRegionId, examStudentId))),
    masterImage: (cropRegionId) =>
      fs.existsSync(masterPath(cropRegionId))
        ? toPromptImage(fs.readFileSync(masterPath(cropRegionId)))
        : null,
  }
}
