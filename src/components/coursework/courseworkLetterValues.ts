import type {
  CourseworkItemWithLetterScales,
  CourseworkScoreWithCourseworkStudent,
} from "@/types/coursework.types"

/**
 * 文字評価（評語）の扱いを1箇所に集める。
 *
 * 点数入力（04）と評価項目（03）の両方が同じ判断を使う。片方だけで判定すると、
 * 「マスは赤いのに評価項目の画面には出ない」のような食い違いが起きる。
 *
 * **入力された文字は推測で変えない。** `A` と `a` は別の評語でありうるし、
 * 全角の `Ａ` も同じ。表記を寄せるかどうかは貼り付けのときに人へ尋ね、
 * 承諾されたときだけ寄せる（`toHalfWidth`）。ここでの照合は、成績算出
 * （`rawScoreCalculator` の `label === letterValue`）と同じ**そのままの比較**に
 * 揃える。照合だけ緩めると、マスが赤くならないまま成績側で欠測になる。
 */

/** 貼り付けで確認を促す全角文字（英数・長音／マイナス・全角ピリオド） */
const FULL_WIDTH_PATTERN = /[Ａ-Ｚａ-ｚ０-９－ー−．]/

/** 全角文字を含むか */
export function containsFullWidth(text: string): boolean {
  return FULL_WIDTH_PATTERN.test(text)
}

/** 全角英数・全角記号を半角へ寄せる（人が承諾したときだけ通す） */
export function toHalfWidth(text: string): string {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (fullWidthChar) =>
      String.fromCharCode(fullWidthChar.charCodeAt(0) - 0xfee0)
    )
    .replace(/[－ー−]/g, "-")
    .replace(/[．]/g, ".")
}

/**
 * 保存する評語。
 *
 * 落とすのは前後の空白だけ（Excel の桁揃えで入る空白は評語ではない）。
 * 大小文字も全角半角もそのまま残す。
 */
export function letterValueOf(input: string): string {
  return input.trim()
}

/** 変換表のラベル集合 */
function letterLabelsOf(
  item: CourseworkItemWithLetterScales
): ReadonlySet<string> {
  return new Set(item.letterScales.map((letterScale) => letterScale.label))
}

/**
 * 変換表に無い評語か。
 *
 * **変換表が1つも無いときは判定しない。** 変換表を作る前の段階で全マスが赤くても、
 * 直しようがないので意味がない。
 */
export function isUnknownLetterValue(
  item: CourseworkItemWithLetterScales,
  input: string
): boolean {
  const letterValue = letterValueOf(input)
  if (letterValue === "") return false
  if (item.letterScales.length === 0) return false
  return !letterLabelsOf(item).has(letterValue)
}

/** 変換表に無い評語の一覧（多い順）と、それが入っている点数の件数 */
export interface UnknownLetterValues {
  /** 入力された評語のうち変換表に無いもの（多い順） */
  values: string[]
  /** その評語が入っている点数の件数（＝何人分か） */
  count: number
}

/**
 * その評価項目に入力された評語のうち、変換表に無いものを数える。
 *
 * 計算は renderer 側で行う（main は元データを返すだけ）ので、点数の行を
 * そのまま受け取ってここで数える。
 */
export function collectUnknownLetterValues(
  item: CourseworkItemWithLetterScales,
  scores: readonly CourseworkScoreWithCourseworkStudent[]
): UnknownLetterValues {
  const countByValue = new Map<string, number>()
  for (const score of scores) {
    if (score.letterValue == null) continue
    if (!isUnknownLetterValue(item, score.letterValue)) continue
    const letterValue = letterValueOf(score.letterValue)
    countByValue.set(letterValue, (countByValue.get(letterValue) ?? 0) + 1)
  }
  const values = [...countByValue.entries()]
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .map(([letterValue]) => letterValue)
  const count = [...countByValue.values()].reduce(
    (total, valueCount) => total + valueCount,
    0
  )
  return { values, count }
}
