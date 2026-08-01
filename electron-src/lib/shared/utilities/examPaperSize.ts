/**
 * 試験の用紙サイズの決め方（main / renderer 共通）
 *
 * 注釈の fontSize・strokeWidth は mm で保持し、描画時に「mm ÷ 用紙幅」で
 * ピクセルへ換算する。そのため採点画面・プレビュー・PDF出力で同じ用紙サイズを
 * 使わないと、同じ注釈が経路ごとに違う大きさで出る。過去に2度ずれを修正しており、
 * 3度目は畳み込みの際に「画像を持つページだけを見る」という条件を落として起きた。
 * 選び方をこの1箇所に集約する。
 */

/** 用紙サイズの判定に必要なページの情報 */
export interface PaperSizeCandidatePage {
  pageNumber: number
  /** 模範解答画像のパス。旧バージョンで模範解答だけを削除されたページは null */
  imagePath: string | null
  pageSize: string
}

/** ページを1枚も特定できなかったときの用紙サイズ */
export const DEFAULT_PAPER_SIZE = "A4"

/**
 * 試験の用紙サイズを決める。
 *
 * 模範解答画像を持つページのうち、ページ番号が最小のものを採る。
 * - 画像の無いページを除くのは、そのページの pageSize が既定値のまま放置されており
 *   実際の用紙と食い違うため（模範解答だけを削除された幽霊ページ）
 * - 番号で決めるのは、取得順が include の orderBy 有無で変わり不定なため
 */
export function resolveExamPaperSize(
  pages: readonly PaperSizeCandidatePage[] | undefined | null
): string {
  if (!pages || pages.length === 0) return DEFAULT_PAPER_SIZE

  return (
    [...pages]
      .filter((page) => page.imagePath)
      .sort((pageA, pageB) => pageA.pageNumber - pageB.pageNumber)[0]
      ?.pageSize ?? DEFAULT_PAPER_SIZE
  )
}
