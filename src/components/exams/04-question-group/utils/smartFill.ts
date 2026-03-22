/**
 * スマートフィル機能
 * チェックボックス用のExcel風フィルハンドル動作を実現
 */

/**
 * チェックボックスのスマートフィル処理
 * Excelのような動作を実現：パターン検出または値のコピー
 *
 * @param values - 元のセルの値（ドラッグ選択元）
 * @param targetLength - フィル対象の最終的な長さ
 * @returns フィル後の値の配列
 *
 * @example
 * // 単一値のコピー
 * smartFillCheckbox([true], 4) // => [true, true, true, true]
 *
 * @example
 * // 交互パターンの継続
 * smartFillCheckbox([true, false], 6) // => [true, false, true, false, true, false]
 *
 * @example
 * // パターンなし（最終値をコピー）
 * smartFillCheckbox([true, true, false], 5) // => [true, true, false, false, false]
 */
export function smartFillCheckbox(
  values: boolean[],
  targetLength: number
): boolean[] {
  // 空配列の場合
  if (values.length === 0) return []

  // 単一値の場合はそのままコピー
  if (values.length === 1) {
    return Array(targetLength).fill(values[0])
  }

  // パターン検出: 交互パターン (true, false, true, false...)
  const isAlternating = values.every((val, idx) => {
    if (idx === 0) return true
    return val !== values[idx - 1]
  })

  if (isAlternating) {
    // 交互パターンを継続
    const result: boolean[] = [...values]
    while (result.length < targetLength) {
      result.push(!result[result.length - 1])
    }
    return result.slice(0, targetLength)
  }

  // 連続同一値パターン検出 (true, true, false, false...)
  const sequenceLength = detectSequenceLength(values)
  if (sequenceLength > 1) {
    const result: boolean[] = [...values]
    let currentIndex = values.length
    while (result.length < targetLength) {
      // 現在のシーケンス位置を計算
      const positionInPattern = currentIndex % (sequenceLength * 2)
      const currentValue = positionInPattern < sequenceLength
      result.push(currentValue)
      currentIndex++
    }
    return result.slice(0, targetLength)
  }

  // パターンなし → 最終値をコピー
  const lastValue = values[values.length - 1]
  return Array(targetLength).fill(lastValue)
}

/**
 * 連続同一値のシーケンス長を検出
 * 例: [true, true, false, false] -> 2
 * 例: [true, true, true, false, false, false] -> 3
 *
 * @param values - チェック対象の値の配列
 * @returns シーケンス長（検出されない場合は0）
 */
function detectSequenceLength(values: boolean[]): number {
  if (values.length < 4) return 0

  // 最初の連続同一値の長さを検出
  let firstSequenceLength = 1
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[0]) {
      firstSequenceLength++
    } else {
      break
    }
  }

  // 次の連続同一値の長さを検出
  let secondSequenceLength = 1
  const secondValue = values[firstSequenceLength]
  for (let i = firstSequenceLength + 1; i < values.length; i++) {
    if (values[i] === secondValue) {
      secondSequenceLength++
    } else {
      break
    }
  }

  // 両方のシーケンス長が一致し、パターンが繰り返されている場合のみ有効
  if (
    firstSequenceLength === secondSequenceLength &&
    firstSequenceLength + secondSequenceLength <= values.length
  ) {
    return firstSequenceLength
  }

  return 0
}
