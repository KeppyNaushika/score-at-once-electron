/**
 * 大津の二値化法（Otsu's method）による境界の自動決定
 *
 * ヒストグラムを2クラスに分ける境界のうち、クラス間分散が最大になる位置を返す。
 * OMRでは輝度（色しきい値）と塗りつぶし率（面積しきい値）の双方に使う。
 *
 * 1次元 k-means（k=2）と目的関数が等価（クラス内分散の最小化＝クラス間分散の最大化）
 * なので、両者を別々に実装する必要はない。
 */

export interface OtsuResult {
  /** 算出された境界値（入力と同じスケール） */
  threshold: number
  /**
   * 2クラスの平均値の差（入力と同じスケール）。
   *
   * 大津法は分布が単峰でも必ず境界を返すため、自動決定を採用してよいかは
   * 「2つの群がどれだけ離れているか」で判断する。クラス間分散比（η）は
   * スケール不変で、密集した1群を割っても大きな値になるので判定に使えない。
   */
  meanDistance: number
}

export interface OtsuOptions {
  /** ヒストグラムの下限（この値未満は無視） */
  min: number
  /** ヒストグラムの上限（この値を超える値は無視） */
  max: number
  /** ビン数 */
  bins: number
}

/** サンプル数がこれ未満なら自動決定しない */
const MIN_SAMPLES = 8

/**
 * 値の配列から大津法で境界を算出する
 *
 * @returns サンプル不足・全て同一値の場合は null
 */
export function computeOtsuThreshold(
  values: number[],
  options: OtsuOptions
): OtsuResult | null {
  const histogram = buildHistogram(values, options)
  if (histogram === null) return null

  return computeOtsuFromHistogram(histogram, options)
}

/**
 * 度数分布から大津法で境界を算出する
 *
 * 画像のように値を配列に展開すると重い場合、呼び出し側でビンに積んでから渡す。
 *
 * @param histogram 長さ options.bins の度数配列
 */
export function computeOtsuFromHistogram(
  histogram: number[],
  options: OtsuOptions
): OtsuResult | null {
  const { min, max, bins } = options
  const total = histogram.reduce((acc, count) => acc + count, 0)
  if (total < MIN_SAMPLES) return null

  const binWidth = (max - min) / bins
  /** ビン中心の代表値 */
  const binValue = (bin: number) => min + binWidth * (bin + 0.5)

  const sumAll = histogram.reduce(
    (acc, count, bin) => acc + count * binValue(bin),
    0
  )

  let weightBelow = 0
  let sumBelow = 0
  let maxBetweenVariance = -1
  // 空ビンが続く区間ではクラス間分散が同値で並ぶ。端に寄せず中央を採るため合算する
  let bestBinSum = 0
  let bestBinCount = 0
  let lastTiedBin = -1
  let meanDistance = 0

  for (let bin = 0; bin < bins; bin++) {
    weightBelow += histogram[bin]
    sumBelow += histogram[bin] * binValue(bin)

    const weightAbove = total - weightBelow
    if (weightBelow === 0 || weightAbove === 0) continue

    const meanBelow = sumBelow / weightBelow
    const meanAbove = (sumAll - sumBelow) / weightAbove
    const meanDiff = meanBelow - meanAbove
    const betweenVariance = weightBelow * weightAbove * meanDiff * meanDiff

    if (betweenVariance > maxBetweenVariance) {
      maxBetweenVariance = betweenVariance
      bestBinSum = bin
      bestBinCount = 1
      lastTiedBin = bin
      meanDistance = Math.abs(meanDiff)
    } else if (
      betweenVariance === maxBetweenVariance &&
      bin === lastTiedBin + 1 &&
      histogram[bin] === 0
    ) {
      // 合算するのは最大値の直後に続く「空ビン」だけ。度数ゼロなら分割の中身は
      // 変わらないので、同じ分割を指す区間の中央を採ることになる。
      // 度数のあるビンは別の分割なので、同値でも混ぜない
      // （等間隔・等量の山が並ぶ分布では別の分割が同値になり、
      // 平均すると境界が山の中へ落ちて何も分離しなくなる）
      bestBinSum += bin
      bestBinCount++
      lastTiedBin = bin
    }
  }

  // 全て同一ビンに入る等、分割点が見つからない
  if (bestBinCount === 0) return null

  const bestBin = bestBinSum / bestBinCount

  return {
    // 境界は「下位クラスの最終ビン」の上端。同値が並ぶ区間ではその中央に置く
    threshold: min + binWidth * (bestBin + 1),
    meanDistance,
  }
}

/**
 * 値の配列を度数分布に積む
 *
 * @returns 有効サンプルが MIN_SAMPLES 未満なら null
 */
function buildHistogram(
  values: number[],
  options: OtsuOptions
): number[] | null {
  const { min, max, bins } = options
  const binWidth = (max - min) / bins
  const histogram = new Array<number>(bins).fill(0)

  let sampleCount = 0
  for (const value of values) {
    if (value < min || value > max) continue
    const bin = Math.min(bins - 1, Math.floor((value - min) / binWidth))
    histogram[bin]++
    sampleCount++
  }

  return sampleCount < MIN_SAMPLES ? null : histogram
}
