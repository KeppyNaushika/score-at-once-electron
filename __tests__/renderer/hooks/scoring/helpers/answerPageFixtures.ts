/**
 * 07 個別表示のページ配置のテスト用: 寸法だけを持つ画像と、ページを持つ採点領域
 */
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

/** naturalWidth・naturalHeight はゲッターなので、要素に定義し直して寸法を持たせる */
export function buildImage(width: number, height: number): HTMLImageElement {
  const image = document.createElement("img")
  Object.defineProperty(image, "naturalWidth", { value: width })
  Object.defineProperty(image, "naturalHeight", { value: height })
  return image
}

/**
 * ページ（examPageId）とページ番号を持つ採点領域。
 * ページ番号は「添字に使われない」ことを確かめるために、わざと持たせる
 */
export function buildCropRegion(
  examPageId: string,
  pageNumber: number,
  id = `region-${examPageId}`
): QuestionAnswerRegionRow {
  // 配置に要る項目だけを持つ偽物を採点領域として渡す
  return {
    id,
    examPageId,
    label: id,
    x: 0.25,
    y: 0.5,
    width: 0.2,
    height: 0.1,
    examPage: { id: examPageId, pageNumber },
  } as unknown as QuestionAnswerRegionRow
}
