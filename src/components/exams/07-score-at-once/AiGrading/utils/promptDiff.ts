/**
 * プロンプトの欄ごとの、行単位の差分（改訂の結果を元のプロンプトと見比べる。設計 §3-1）。
 *
 * 最長共通部分列で行を対応させる。プロンプトの欄は数十行までなので、表は O(n·m) でよい。
 */

export type PromptDiffLineKind = "same" | "added" | "removed"

export interface PromptDiffLine {
  kind: PromptDiffLineKind
  text: string
  /**
   * 差分の中で一意な目印（元の行番号・新しい行番号の組）。描画のキーに使う
   * （同じ文面の行が何度現れても重ならない）
   */
  lineKey: string
}

function splitLines(text: string): string[] {
  return text === "" ? [] : text.split(/\r?\n/)
}

/** 2つの文面の行単位の差分 */
export function diffPromptLines(
  beforeText: string,
  afterText: string
): PromptDiffLine[] {
  const beforeLines = splitLines(beforeText)
  const afterLines = splitLines(afterText)

  // commonLengths[beforeIndex][afterIndex] = beforeLines[beforeIndex..] と
  // afterLines[afterIndex..] の共通部分列の長さ（表を埋めるので添字で回す）
  const commonLengths = Array.from({ length: beforeLines.length + 1 }, () =>
    new Array<number>(afterLines.length + 1).fill(0)
  )
  for (
    let beforeIndex = beforeLines.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    for (
      let afterIndex = afterLines.length - 1;
      afterIndex >= 0;
      afterIndex -= 1
    ) {
      commonLengths[beforeIndex][afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? commonLengths[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(
              commonLengths[beforeIndex + 1][afterIndex],
              commonLengths[beforeIndex][afterIndex + 1]
            )
    }
  }

  const diffLines: PromptDiffLine[] = []
  let beforeIndex = 0
  let afterIndex = 0
  while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
    const hasBefore = beforeIndex < beforeLines.length
    const hasAfter = afterIndex < afterLines.length
    if (
      hasBefore &&
      hasAfter &&
      beforeLines[beforeIndex] === afterLines[afterIndex]
    ) {
      diffLines.push({
        kind: "same",
        text: beforeLines[beforeIndex],
        lineKey: `${beforeIndex}:${afterIndex}`,
      })
      beforeIndex += 1
      afterIndex += 1
    } else if (
      hasBefore &&
      (!hasAfter ||
        commonLengths[beforeIndex + 1][afterIndex] >=
          commonLengths[beforeIndex][afterIndex + 1])
    ) {
      // 消えた行を先に出す（直した行が「消した行 → 足した行」の順に並ぶ）
      diffLines.push({
        kind: "removed",
        text: beforeLines[beforeIndex],
        lineKey: `${beforeIndex}:-`,
      })
      beforeIndex += 1
    } else {
      diffLines.push({
        kind: "added",
        text: afterLines[afterIndex],
        lineKey: `-:${afterIndex}`,
      })
      afterIndex += 1
    }
  }
  return diffLines
}

/** 差分のある行が1つでもあるか */
export function hasPromptChanges(
  diffLines: readonly PromptDiffLine[]
): boolean {
  return diffLines.some((diffLine) => diffLine.kind !== "same")
}
