/**
 * 答案の採点領域の「白さ」（空欄らしさ）算出
 *
 * グリッド採点の白さ順ソート用。空欄・白紙の答案を先頭に集めるためのソートキーを作る。
 *
 * 画像1枚につきデコードは必ず1回だけ行い、そのページの全採点領域分をまとめて算出する。
 * PNGは画像全体が1本の圧縮ストリームで途中打ち切りができないため、領域ごとにsharpの
 * extractを呼ぶとデコードが領域数だけ繰り返され、実測で20倍以上遅くなる（1684x2382の
 * 答案52枚・10設問で 1.3秒 → 33秒）。一方、デコード済みバッファに対する領域の走査は
 * 1領域あたり0.2ms程度で、設問数はコストにほぼ影響しない。
 *
 * 指標は平均輝度のみ。閾値を持たないので、調整の必要な定数がひとつも無い。
 * これは意図的な選択で、実採点データ（数学の単元/定期テスト直近6件・129設問・
 * 無答1225件/記入10052件）で教員の付けた「無答」を正解ラベルに比較した結果、
 * 閾値を導入しても得るものが無かったことによる。
 *   - 平均輝度が最良（無答の平均順位0.091、先頭20%に無答の87.5%、
 *     最後の無答も平均23.2%の位置まで。無作為な並びなら平均順位0.50）
 *   - 暗画素率は僅差で下（閾値245で平均順位0.093、200で0.096）。
 *     閾値を160〜245で振っても頭打ちで、平均輝度を超えない
 *   - 領域を5%内側に詰める・孤立点を収縮で消す、はいずれも改善しない
 *     （収縮は明確に悪化。細い鉛筆線ごと消えるため）
 *   - 指標の差より試験ごとの差の方が一桁大きい（先頭20%の捕捉率が試験別に
 *     83.9%〜94.2%）。残差は指標選択ではなく答案・設問の性質側にある
 * 領域内の画素を測る系の指標はこの辺りが上限で、これ以上は答案の位置合わせを伴う
 * 模範解答との差分など、別の系統が必要になる。
 */

import sharp from "sharp"

import type {
  AnswerWhiteness,
  RegionWhiteness,
  WhitenessTargetRegion,
} from "../../../src/types/answerWhiteness.types"

/** 測定対象の答案画像（imagePathは解決済みの絶対パス） */
interface WhitenessTargetImage {
  studentAnswerImageId: string
  imagePath: string
}

/**
 * グレースケール1chのRAWバッファから、相対矩形の平均輝度を求める。
 * 矩形は画像の範囲でクランプする。
 */
function measureRegion(
  pixels: Buffer,
  imageWidth: number,
  imageHeight: number,
  region: WhitenessTargetRegion
): RegionWhiteness {
  const x0 = Math.max(0, Math.floor(region.x * imageWidth))
  const y0 = Math.max(0, Math.floor(region.y * imageHeight))
  const x1 = Math.min(
    imageWidth,
    Math.ceil((region.x + region.width) * imageWidth)
  )
  const y1 = Math.min(
    imageHeight,
    Math.ceil((region.y + region.height) * imageHeight)
  )

  let luminanceSum = 0
  let pixelCount = 0

  for (let y = y0; y < y1; y += 1) {
    const rowOffset = y * imageWidth
    for (let x = x0; x < x1; x += 1) {
      luminanceSum += pixels[rowOffset + x]
      pixelCount += 1
    }
  }

  // 画像の外に出た領域など、画素が1つも無い場合。空欄側（先頭）に紛れ込ませないよう
  // 「最も暗い」扱いにして末尾へ送る。
  if (pixelCount === 0) {
    return { cropRegionId: region.cropRegionId, meanLuminance: 0 }
  }

  return {
    cropRegionId: region.cropRegionId,
    meanLuminance: luminanceSum / pixelCount,
  }
}

/**
 * 答案画像ごとに、指定された全採点領域の白さを算出する。
 *
 * 読み込めない画像はスキップする（結果に含めない）。呼び出し側は白さ不明として扱う。
 * メモリ上に載るのは常に1枚分のRAWバッファのみになるよう逐次処理する。
 */
export async function measureAnswerWhiteness(
  answerImages: WhitenessTargetImage[],
  regions: WhitenessTargetRegion[]
): Promise<AnswerWhiteness[]> {
  if (regions.length === 0) return []

  const results: AnswerWhiteness[] = []

  for (const answerImage of answerImages) {
    try {
      const { data, info } = await sharp(answerImage.imagePath)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true })

      results.push({
        studentAnswerImageId: answerImage.studentAnswerImageId,
        regions: regions.map((region) =>
          measureRegion(data, info.width, info.height, region)
        ),
      })
    } catch (error) {
      console.warn(
        `答案画像の白さ算出に失敗しました: ${answerImage.imagePath}`,
        error
      )
    }
  }

  return results
}
