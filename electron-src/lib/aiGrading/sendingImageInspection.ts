/**
 * 答案画像の測定（朱書きの配置に使う占有グリッド・送る画像の大きさ）。
 *
 * どれも外部へは何も送らない。金額や件数の計算・白紙の判断は renderer が行うので、
 * ここが返すのは測った値と画像そのものだけ。
 */

import { readImageHeader } from "../imageOps"
import { getCropRegionWithAnswerImages } from "../prisma/aiGradingSource"
import { getAiPrompt } from "../prisma/aiPrompt"
import { measureAnswerInk, measureSendingCropSize } from "./answerImage"
import type { ResolveDataPath } from "./gradingRequestFactory"

/**
 * 設問のある答案の占有グリッドを測る（ページの答案画像すべて）。ルーブリック項目の助言から
 * 作る朱書きを、手書きに重ねない位置へ置くのに使う（docs/vlm-grading-design.md §9）。
 * 答案画像1枚につき、この設問の枠1つぶんの結果が返る
 */
export async function measureCropRegionInk(
  cropRegionId: string,
  resolveDataPath: ResolveDataPath
) {
  const cropRegion = await getCropRegionWithAnswerImages(cropRegionId)
  if (!cropRegion) throw new Error("設問が見つかりません")
  return measureAnswerInk(
    cropRegion.examPage.studentAnswerImages.map((studentAnswerImage) => ({
      studentAnswerImageId: studentAnswerImage.id,
      imagePath: resolveDataPath(studentAnswerImage.imagePath),
    })),
    [
      {
        cropRegionId: cropRegion.id,
        x: cropRegion.x,
        y: cropRegion.y,
        width: cropRegion.width,
        height: cropRegion.height,
      },
    ],
    { paperSize: cropRegion.examPage.pageSize }
  )
}

/**
 * 見積もりの材料。送る画像ごとの大きさ（画素）だけを返す
 * （トークン数・金額は renderer が事業者ごとの式で求める）。
 * 答案画像の無い答案は `answerImages` に現れない
 */
export async function measureRunImageSizes(
  input: { promptId: string; examStudentIds: string[]; imageScale: number },
  resolveDataPath: ResolveDataPath
) {
  const prompt = await getAiPrompt(input.promptId)
  if (!prompt) throw new Error("採点指示が見つかりません")
  const cropRegion = await getCropRegionWithAnswerImages(
    prompt.cropRegionId,
    input.examStudentIds
  )
  if (!cropRegion) throw new Error("設問が見つかりません")

  const answerImages = []
  for (const studentAnswerImage of cropRegion.examPage.studentAnswerImages) {
    const size = await measureSendingCropSize(
      resolveDataPath(studentAnswerImage.imagePath),
      cropRegion,
      { imageScale: input.imageScale }
    )
    answerImages.push({
      examStudentId: studentAnswerImage.examStudentId,
      ...size,
    })
  }

  // 問題の画像は並び順に全部（送るときと同じ順）
  const questionImages: { width: number; height: number }[] = []
  for (const questionImage of prompt.questionImages) {
    const header = await readImageHeader(
      resolveDataPath(questionImage.imagePath)
    )
    questionImages.push({ width: header.width, height: header.height })
  }
  const masterImagePath = cropRegion.examPage.imagePath
  const modelAnswerImage =
    prompt.sendModelAnswerImage && masterImagePath
      ? await measureSendingCropSize(
          resolveDataPath(masterImagePath),
          cropRegion,
          { imageScale: input.imageScale }
        )
      : null

  return { answerImages, questionImages, modelAnswerImage }
}
