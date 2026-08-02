/**
 * 採点のページ scoped 解決。
 *
 * 採点は答案画像ではなく `(cropRegionId, studentId)` / `(compoundAnswerId, studentId)` に
 * 紐づくため、ページ（や答案画像）から採点へ辿るには必ずこの経由が要る。
 * 削除（crud.ts）と配置適用（placementApply.ts）の双方が同じ定義を使うようここへ集約する。
 */
import type prisma from "../client"
import type { Tx } from "../transactionClient"

/** ページ1枚に属する採点の座標軸 */
export interface PageScoreScope {
  cropRegionIds: string[]
  compoundAnswerIds: string[]
}

/** 指定ページの CropRegion / CompoundAnswer の id を引く */
export async function getPageScoreScope(
  client: typeof prisma | Tx,
  examPageId: string
): Promise<PageScoreScope> {
  const [cropRegions, compoundAnswers] = await Promise.all([
    client.cropRegion.findMany({
      where: { examPageId },
    }),
    client.compoundAnswer.findMany({
      where: { examPageId },
    }),
  ])
  return {
    cropRegionIds: cropRegions.map((cropRegion) => cropRegion.id),
    compoundAnswerIds: compoundAnswers.map(
      (compoundAnswer) => compoundAnswer.id
    ),
  }
}
