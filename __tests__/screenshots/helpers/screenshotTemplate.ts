/**
 * 撮影に使う解答用紙の雛形を読む
 *
 * 雛形（`data/asb-template.json`）は手で置いた素材で、書き出した当時の設定のまま
 * 固まっている。撮影で見せたい設定はここで上書きする。種蒔き（`setup-data.ts`）と
 * 答案画像の生成（`generate-images.ts`）は**必ずこれを通して読む**。片方だけ上書き
 * すると、書き出した解答用紙と、答えを書き込む位置の計算とでレイアウトが食い違う。
 */

import * as fs from "fs"

/**
 * 雛形の設定に重ねる、撮影で見せたい設定
 *
 * - OMR マーカー（四隅の位置合わせ）をオン。使い方ガイドで、マーカー入りの
 *   解答用紙と「6. 生徒答案」のマーカー補正を見せるため
 */
const SCREENSHOT_TEMPLATE_OVERRIDES = {
  omrMarkersEnabled: true,
} as const

/**
 * 撮影用の設定を重ねた雛形を読む
 *
 * 型は `JSON.parse` の結果のまま返す。雛形は書き出した当時の形で、読む側がそれぞれ
 * 必要な形へ当てはめている（`templateToDefinition` など）。
 */
export function readScreenshotTemplate(
  templatePath: string
): ReturnType<typeof JSON.parse> {
  const template = JSON.parse(fs.readFileSync(templatePath, "utf-8"))
  return { ...template, ...SCREENSHOT_TEMPLATE_OVERRIDES }
}
