/**
 * 採点指示の問題の画像のうち、どの行からも指されなくなったファイルを消す（docs/vlm-grading-design.md §3-1・§5-5）。
 *
 * 画像は取り込んだ時点でファイルだけができ、行（`AiPromptQuestionImage`）は採点指示を保存したときに作る。
 * 行の無いファイルが残るのは次の2つで、どちらもここを通して消す:
 *
 * - 採点指示の画面で取り込んだが、保存しなかった（やめた・保存前に外した・切り出し直した）
 * - 採点枠・模範解答のページを消して、採点指示と画像の行が cascade で消えた
 *
 * **消すのは、呼び出し側が名指ししたファイルだけ。** フォルダを見回して行の無いファイルを掃除することはしない。
 * 共有フォルダでは、別の端末が取り込んだ画像の行がまだ同期で届いていないことがあり、見回すとそれを消してしまう。
 * 名指ししたファイルでも、まだどれかの行が指していれば残す（直した採点指示は元の画像のパスを引き継ぐ）。
 */

import * as fsPromises from "fs/promises"
import * as path from "path"

import { AI_QUESTION_IMAGES_DIRECTORY_NAME } from "./aiPrompt"
import prisma from "./client"

/** 問題の画像の取り込み先（`exams/<試験>/ai-question-images/<ファイル>`）を指すパスか */
function isQuestionImagePath(imagePath: string): boolean {
  const segments = imagePath.split("/")
  return (
    segments.length === 4 &&
    segments[0] === "exams" &&
    segments[2] === AI_QUESTION_IMAGES_DIRECTORY_NAME &&
    segments.every((segment) => segment !== "" && segment !== "..") &&
    !imagePath.includes("\\")
  )
}

/**
 * 名指しした問題の画像のうち、どの行からも指されていないファイルを消し、消した数を返す。
 * 取り込み先の外を指すパスは無視する。`filesDirectory` は共有するファイルの根（テストでは一時ディレクトリ）
 */
export async function removeUnreferencedQuestionImages(
  imagePaths: readonly string[],
  filesDirectory: string
): Promise<number> {
  const candidatePaths = [...new Set(imagePaths)].filter(isQuestionImagePath)
  if (candidatePaths.length === 0) return 0
  const referencedRows = await prisma.aiPromptQuestionImage.findMany({
    where: { imagePath: { in: candidatePaths } },
  })
  const referencedPaths = new Set(
    referencedRows.map((questionImage) => questionImage.imagePath)
  )
  const removedCounts = await Promise.all(
    candidatePaths
      .filter((imagePath) => !referencedPaths.has(imagePath))
      .map(async (imagePath) => {
        try {
          await fsPromises.unlink(
            path.join(filesDirectory, ...imagePath.split("/"))
          )
          return 1
        } catch (fileError: unknown) {
          if (!(
            fileError &&
            typeof fileError === "object" &&
            "code" in fileError &&
            fileError.code === "ENOENT"
          )) {
            console.warn(
              `Failed to delete AI question image ${imagePath}:`,
              fileError
            )
          }
          return 0
        }
      })
  )
  return removedCounts.reduce<number>((acc, count) => acc + count, 0)
}

/** 採点枠（複数可）の採点指示が持つ問題の画像のパス。枠を消す前に読み、消したあとで `removeUnreferencedQuestionImages` に渡す */
export async function questionImagePathsOfCropRegions(
  where: { cropRegionId: string } | { examPageId: string }
): Promise<string[]> {
  const questionImages = await prisma.aiPromptQuestionImage.findMany({
    where: {
      prompt: {
        cropRegion:
          "cropRegionId" in where
            ? { id: where.cropRegionId }
            : { examPageId: where.examPageId },
      },
    },
  })
  return questionImages.map((questionImage) => questionImage.imagePath)
}
